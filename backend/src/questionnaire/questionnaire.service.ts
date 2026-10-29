import { Injectable } from '@nestjs/common';
import { LoanCategory, Prisma, QuestionType, type Question } from '@prisma/client';
import { DomainException, MirroredListMinValuesException } from '@/common/errors/domain.exceptions';
import { ERROR_CODES } from '@/common/errors/error-codes';
import { sortCategories } from '@/common/loan-category.util';
import {
  DEBT_TYPES_QUESTION_CODE,
  DEBT_TYPE_NONE_OPTION,
  MONEY_FIELD_BINDINGS,
  ASKED_MONEY_FIELD_BINDING_KEYS,
  obligationItemQuestionFor,
} from '@/matching/pipeline/money-field-bindings';
import {
  SURROGATE_FACT_KEYS,
  SURROGATE_FACT_SPECS,
  type SurrogateBindingWarningReason,
  type SurrogateFact,
  type SurrogateFactSpec,
} from '@/matching/pipeline/surrogate-fact-bindings';
import { isBindableQuestionType } from '@/matching/pipeline/surrogate-fact-registry';
import { PlatformEnumerationsRepository } from '@/platform-enumerations/platform-enumerations.repository';
import { EngineContractService } from './engine-contract.service';
import { QuestionnaireRepository, type OptionEffectColumns } from './questionnaire.repository';
import { uniqueSlug } from './slug.util';
import {
  MIN_CHOICE_OPTIONS,
  assertBranchSourceIsChoice,
  assertQuestionTypeRules,
  isChoiceType,
} from './validation/question-type-rules';
import {
  resolveQuestionType,
  validateAnswer,
  type AnswerableQuestion,
  type NormalisedAnswer,
  type SubmittedAnswerValue,
} from './validation/answer-validation';
import { isQuestionVisible } from './validation/question-visibility';
import {
  narrowAskedQuestions,
  orderServed,
  type NarrowingScope,
} from './validation/question-scope';
import {
  fixedServedOnOf,
  frozenFixedServedOn,
  surrogateSideCodes,
  type FixedServedOn,
} from './validation/fixed-questions';
import { sameText } from './validation/engine-contract';
import {
  numberEffectRangesProblem,
  type AnswerEffectSource,
  type NumberEffectRange,
} from '@/matching/pipeline/answer-effects';
import type {
  CreateGroupDto,
  CreateOptionDto,
  CreateQuestionDto,
  CreateQuestionWithOptionsDto,
  NumericRulesDto,
  OptionEffectDto,
  SetNumberEffectsDto,
  TextRulesDto,
  UpdateGroupDto,
  UpdateOptionDto,
  UpdateQuestionDto,
} from './dto/questionnaire.dto';

@Injectable()
export class QuestionnaireService {
  constructor(
    private readonly repo: QuestionnaireRepository,
    /**
     * Feature 011 — the registries the two choice FACTS draw their option codes from.
     * Needed to warn when the two lists drift (FR-017): the admin's table keys and the
     * customer's answers are supposed to be ONE list by construction, and a rename on
     * either side must surface here rather than as a silent non-match.
     */
    private readonly enums: PlatformEnumerationsRepository,
    /**
     * The engine-input contract: refuses a write that would change a question the loan engine
     * reads, or leave it without an answer it gets today. Every write publishes on the spot, so
     * this runs BEFORE each one lands. Always injected by Nest; absent only where a test builds
     * this service by hand around fake repositories.
     */
    private readonly contract?: EngineContractService,
  ) {}

  /**
   * The option codes and registry members the surrogate-fact
   * checks read. Built once and shared by `publish()` and `bindingWarnings()`, so the
   * banner in the editor and the payload on publish cannot disagree.
   */
  private async surrogateBindingContext(
    activeQuestions: ReadonlyArray<{ id: string; code: string }>,
  ): Promise<SurrogateBindingContext> {
    // WHICH facts exist is the registry's answer now, not a code constant's. Read with
    // the broken rows included (`getActiveMembers`, not `surrogateFactRegistry`): an
    // unbound fact is exactly what this check exists to report, and the engine's read
    // filters those out by design.
    const facts = await this.enums.getActiveMembers('surrogate_fact');
    const wanted = new Set<string>(
      facts.flatMap((f) => (f.boundQuestion ? [f.boundQuestion.code] : [])),
    );
    const optionCodesByQuestion = new Map<string, readonly string[]>();
    for (const q of activeQuestions) {
      if (!wanted.has(q.code)) continue;
      const options = await this.repo.optionsByQuestion(q.id);
      optionCodesByQuestion.set(
        q.code,
        options.filter((o) => o.isActive).map((o) => o.code),
      );
    }

    // The enumeration each of the two LEGACY choice facts draws its option codes from.
    // Only they have one: a fact an operator adds keys its table off the bound
    // question's own options, so the two lists are one list by construction and there
    // is no second list to drift from. Kept for the two that DO pair with an
    // enumeration, because that pairing is real and its drift is silent.
    const registryMembers = new Map<string, readonly string[]>();
    for (const fact of SURROGATE_FACT_KEYS) {
      const registry = SURROGATE_FACT_SPECS[fact].registry;
      if (registry === null || registryMembers.has(registry)) continue;
      const members = await this.enums.getActiveMembers(
        registry as Parameters<PlatformEnumerationsRepository['getActiveMembers']>[0],
      );
      registryMembers.set(
        registry,
        members.map((m) => m.key),
      );
    }

    return {
      facts: facts.map((f) => ({
        key: f.key,
        questionCode: f.boundQuestion?.code ?? null,
        questionType: f.boundQuestion?.type ?? null,
      })),
      optionCodesByQuestion,
      registryMembers,
    };
  }

  // ---- Public read --------------------------------------------------------
  /**
   * Customer-facing snapshot of the GLOBAL questionnaire, narrowed to the questions the picked
   * PROGRAM asks (`programNameKey` under `category`, `question-scope.ts`), in that program's own
   * order. Questions/answers are pure content (MVP) — anything a program configures stays
   * server-side, never in the snapshot — so this is a shape passthrough with no IP left to strip.
   *
   * A category with no name is served the BASELINE (the fixed questions and the money core).
   * No category at all is the whole pool, in the pool's order — what every client got before any
   * narrowing existed. The controller refuses a name without a category.
   */
  async activeSnapshot(category?: LoanCategory, programNameKey?: string): Promise<unknown> {
    const version = await this.repo.activeVersion();
    if (!version) throw new DomainException(ERROR_CODES.QUESTIONNAIRE_NOT_PUBLISHED);
    const scope =
      programNameKey === undefined || category === undefined
        ? null
        : await this.enums.narrowingScopeFor(programNameKey, category);
    return toCustomerSnapshot(version.snapshot, category, scope);
  }

  /**
   * What an applicant of one catalog name is actually served, per loan type the name is
   * offered under — read off the same projection `activeSnapshot` serves, so the admin reports
   * what is SERVED and not a second opinion about it. An unknown or retired name serves nothing.
   *
   * `pages` is the served snapshot's groups themselves, in the program's own order — the app
   * renders one step per group (`questionnaire_state.dart`), so the admin lists (and reorders)
   * the applicant's pages exactly as they appear, with the `isRequired` that already folds in
   * what a programme under the name reads.
   *
   * `fixedQuestionCodes` are the served questions the admin marked fixed — read off the same
   * frozen snapshot, because the customer payload leaves the mark out (the app has no use for
   * it). The rest are asked because a programme under the name reads them or it ticked them.
   */
  async servedForProgramName(programNameKey: string): Promise<
    {
      category: LoanCategory;
      servedTotal: number;
      servedRequired: number;
      servedQuestionCodes: string[];
      fixedQuestionCodes: string[];
      pages: unknown[];
    }[]
  > {
    const member = (await this.enums.getActiveMembers('program_name')).find(
      (m) => m.key === programNameKey,
    );
    if (member === undefined) return [];
    const version = await this.repo.activeVersion();
    if (!version) throw new DomainException(ERROR_CODES.QUESTIONNAIRE_NOT_PUBLISHED);
    const out = [];
    for (const category of sortCategories(member.categories)) {
      // A fixed mark as this loan type reads it (an old snapshot froze the car questions'
      // marks for car alone).
      const fixed = new Set(
        ((version.snapshot as StoredSnapshot).groups ?? [])
          .flatMap((g) => g.questions ?? [])
          .filter((q) => frozenFixedServedOn(q, category) !== null)
          .map((q) => q.code),
      );
      const scope = await this.enums.narrowingScopeFor(programNameKey, category);
      const served = toCustomerSnapshot(version.snapshot, category, scope);
      const counted = countServed(served);
      out.push({
        category,
        servedTotal: counted.total,
        servedRequired: counted.required,
        servedQuestionCodes: counted.codes,
        fixedQuestionCodes: counted.codes.filter((code) => fixed.has(code)),
        pages: (served as { groups?: unknown[] }).groups ?? [],
      });
    }
    return out;
  }

  // ---- Groups -------------------------------------------------------------
  async createGroup(dto: CreateGroupDto, actor: string) {
    const existing = new Set((await this.repo.groupCodes()).map((g) => g.code));
    const code = uniqueSlug(dto.titleEn, existing);
    const created = await this.repo.createGroup({
      code,
      titleAr: dto.titleAr,
      titleEn: dto.titleEn,
      displayOrder: dto.displayOrder,
    });
    await this.publish(actor);
    return created;
  }

  async updateGroup(id: string, dto: UpdateGroupDto, actor: string) {
    const group = await this.repo.findGroup(id);
    if (!group) throw new DomainException(ERROR_CODES.QUESTION_GROUP_NOT_FOUND);
    // Deactivating a group is a delete in effect — block while it holds questions.
    if (dto.isActive === false && group.isActive) {
      const active = (await this.repo.questions()).filter((q) => q.groupId === id && q.isActive);
      if (active.length > 0) {
        throw new DomainException(ERROR_CODES.QUESTION_GROUP_NOT_EMPTY, {
          questionCount: active.length,
        });
      }
    }
    const updated = await this.repo.updateGroup(id, {
      titleAr: dto.titleAr,
      titleEn: dto.titleEn,
      displayOrder: dto.displayOrder,
      isActive: dto.isActive,
    });
    await this.publish(actor);
    return updated;
  }

  /** Soft-delete a group; blocked while it still holds active questions. */
  async softDeleteGroup(id: string, actor: string) {
    const group = await this.repo.findGroup(id);
    if (!group) throw new DomainException(ERROR_CODES.QUESTION_GROUP_NOT_FOUND);
    const active = (await this.repo.questions()).filter((q) => q.groupId === id && q.isActive);
    if (active.length > 0) {
      throw new DomainException(ERROR_CODES.QUESTION_GROUP_NOT_EMPTY, {
        questionCount: active.length,
      });
    }
    const deleted = await this.repo.updateGroup(id, { isActive: false });
    await this.publish(actor);
    return deleted;
  }

  listGroups() {
    return this.repo.groups();
  }

  /**
   * Where a question goes when the caller names no group.
   *
   * The pool is authored FLAT (one ordered list, no sections in the editor), but
   * `Question.groupId` is a required FK and the published snapshot still pages the
   * mobile wizard by group. So a flat client's question joins the FIRST active
   * group rather than inventing a new one — inventing one would add an extra step
   * to every applicant's wizard. Only a genuinely empty pool creates a group.
   */
  private async resolveDefaultGroupId(): Promise<string> {
    const first = await this.repo.firstActiveGroup();
    if (first) return first.id;
    const existing = await this.repo.findGroupByCode(DEFAULT_GROUP_CODE);
    if (existing) {
      return existing.isActive
        ? existing.id
        : (await this.repo.updateGroup(existing.id, { isActive: true })).id;
    }
    const created = await this.repo.createGroup({
      code: DEFAULT_GROUP_CODE,
      titleAr: DEFAULT_GROUP_TITLE_AR,
      titleEn: DEFAULT_GROUP_TITLE_EN,
      displayOrder: 0,
    });
    return created.id;
  }

  // ---- Questions ----------------------------------------------------------
  async createQuestion(dto: CreateQuestionDto, actor: string) {
    const groupId = await this.groupBesideTrigger(
      dto.groupId ?? (await this.resolveDefaultGroupId()),
      dto.enabledWhen,
    );
    const group = await this.repo.findGroup(groupId);
    if (!group) {
      throw new DomainException(ERROR_CODES.QUESTION_GROUP_NOT_FOUND);
    }
    // Omitted order means "append": the flat editor sets order by drag, so it has
    // no number to send, and 0 would silently jump the new question to the front.
    const displayOrder = dto.displayOrder ?? (await this.repo.maxQuestionOrder()) + 1;
    if (dto.enabledWhen) {
      await this.assertEnabledWhenValid(displayOrder, dto.enabledWhen);
    }
    const type = dto.type ?? 'SINGLE_SELECT';
    // A question is created before its options exist, so the ">=2 options" rule
    // cannot bite here — it is enforced at publish time instead. What IS checked
    // now is that the per-type rule blocks match `type`.
    assertQuestionTypeRules({
      type,
      numeric: dto.numeric ?? null,
      text: dto.text ?? null,
      activeOptionCount: isChoiceType(type) ? MIN_CHOICE_OPTIONS_AT_CREATE : 0,
    });
    const fixedServedOn = dto.fixedServedOn ?? null;
    if (fixedServedOn !== null) await this.assertFixedAtCreate(dto);
    const existing = new Set((await this.repo.questionCodes()).map((q) => q.code));
    const code = uniqueSlug(dto.questionEn, existing);
    const created = await this.repo.createQuestion({
      groupId,
      code,
      type,
      questionAr: dto.questionAr,
      questionEn: dto.questionEn,
      helperTextAr: dto.helperTextAr ?? null,
      helperTextEn: dto.helperTextEn ?? null,
      isRequired: dto.isRequired ?? true,
      fixedServedOn,
      displayOrder,
      enabledWhen: dto.enabledWhen
        ? (dto.enabledWhen as unknown as Prisma.InputJsonValue)
        : Prisma.DbNull,
      ...numericColumns(type, dto.numeric ?? null),
      ...textColumns(type, dto.text ?? null),
    });
    await this.publish(actor);
    return created;
  }

  /**
   * Create a question AND its answers in one transaction, then publish ONCE.
   *
   * Backs the catalog's "New question" dialog, which authors a whole question —
   * wording, type rules and every answer — before it commits anything. Composing
   * it out of `createQuestion` + N × `createOption` would publish N+1 times, and
   * the intermediate versions are not merely noisy: `GET /v1/questionnaire`
   * serves the ACTIVE version, so each one is a real questionnaire, briefly
   * asking a choice question that has one answer.
   *
   * The second reason it is not sugar: `createQuestion` cannot know how many
   * options are coming, so it passes `MIN_CHOICE_OPTIONS_AT_CREATE` to satisfy
   * the rule check. Here the count IS known, so a one-answer choice question and
   * a NUMERIC arriving with answers are both refused before a row is written,
   * instead of being published and flagged afterwards.
   *
   * `optionsFromEnumerationType` is the third: it makes the question's answers BE a registry
   * list, `question_option.code` === `platform_enumeration.key`. That equality is what the
   * engine's `factChoiceTable` and `factParentTable` look a bank's table up by, and what
   * `attachOptionsEnumerationType` recognises a question's list from — and it is unreachable
   * through the ordinary path, which mints a code by slugifying a label. Only the seed could
   * guarantee it before; now a product screen can. The link is remembered
   * (`EnumerationTypeDef.mirrorQuestionId`) so a value added later re-syncs rather than
   * becoming an answer nobody can pick.
   */
  /**
   * `opts.publish: false` writes the question and does NOT cut a version.
   *
   * For the one caller that creates SEVERAL questions in a row — building a predefined
   * product, which may add six — where a publish each would cut six versions of a
   * questionnaire nobody served in between, and version history is how an operator reads
   * what they did. That caller publishes once when it is finished.
   */
  async createQuestionWithOptions(
    dto: CreateQuestionWithOptionsDto,
    actor: string,
    opts: { publish?: boolean } = {},
  ) {
    const groupId = await this.groupBesideTrigger(
      dto.groupId ?? (await this.resolveDefaultGroupId()),
      dto.enabledWhen,
    );
    const group = await this.repo.findGroup(groupId);
    if (!group) {
      throw new DomainException(ERROR_CODES.QUESTION_GROUP_NOT_FOUND);
    }
    const displayOrder = dto.displayOrder ?? (await this.repo.maxQuestionOrder()) + 1;
    if (dto.enabledWhen) {
      await this.assertEnabledWhenValid(displayOrder, dto.enabledWhen);
    }
    const type = dto.type ?? 'SINGLE_SELECT';
    const mirroredType = dto.optionsFromEnumerationType ?? null;
    if (mirroredType !== null && (dto.options?.length ?? 0) > 0) {
      // Two authorities for one list is how they come to disagree. Refused rather than
      // merged: a merge would mint slugged codes beside registry keys in the same question,
      // and half a mirrored list is worse than none.
      throw new DomainException(ERROR_CODES.VALIDATION_FAILED, {
        field: 'optionsFromEnumerationType',
        reason: 'options_also_given',
      });
    }
    if (mirroredType !== null) {
      // Validated BEFORE the transaction, because every one of these fails silently
      // afterwards. The link is stamped after the question is created, so a bad type key
      // returned `null` from `updateTypeDefinition` and was discarded — a 201 for a question
      // that mirrors nothing and will never re-sync.
      const def = (await this.enums.typeDefinitions()).get(mirroredType);
      if (def === undefined) {
        throw new DomainException(ERROR_CODES.VALIDATION_FAILED, {
          field: 'optionsFromEnumerationType',
          reason: 'unknown_type',
        });
      }
      if (!isChoiceType(type)) {
        // A value type has no options to mirror. Left unchecked it passed creation (0 active
        // values satisfies `value_types_must_have_no_options`) and the NEXT value write then
        // created `question_option` rows on a NUMERIC question and published them.
        throw new DomainException(ERROR_CODES.VALIDATION_FAILED, {
          field: 'optionsFromEnumerationType',
          reason: 'type_not_choice',
        });
      }
      if (def.mirrorQuestionId !== null) {
        // One list, one mirroring question. Re-pointing it silently froze the first
        // question's options forever — live, with nothing on any screen saying so.
        throw new DomainException(ERROR_CODES.VALIDATION_FAILED, {
          field: 'optionsFromEnumerationType',
          reason: 'already_mirrored',
        });
      }
    }
    const mirrored = mirroredType === null ? null : await this.mirroredOptionRows(mirroredType);
    const options = dto.options ?? [];
    // The real count, unlike `createQuestion`. Both directions bite: a choice
    // type below MIN_CHOICE_OPTIONS, and a value type carrying answers at all.
    assertQuestionTypeRules({
      type,
      numeric: dto.numeric ?? null,
      text: dto.text ?? null,
      activeOptionCount: mirrored ? mirrored.length : options.length,
    });

    const existing = new Set((await this.repo.questionCodes()).map((q) => q.code));
    const code = uniqueSlug(dto.questionEn, existing);
    // Option codes are unique per QUESTION (`@@unique([questionId, code])`), so
    // they collide only with their own siblings — accumulated as we go, because
    // the question does not exist yet and has nothing to read them from.
    const optionCodes = new Set<string>();
    const optionRows =
      mirrored ??
      options.map((o) => {
        const optionCode = uniqueSlug(o.labelEn, optionCodes);
        optionCodes.add(optionCode);
        return {
          code: optionCode,
          labelAr: o.labelAr,
          labelEn: o.labelEn,
          ...effectColumns(o.effect),
        };
      });

    const fixedServedOn = dto.fixedServedOn ?? null;
    if (fixedServedOn !== null) await this.assertFixedAtCreate(dto);
    // Only a fixed question's answers change the offer (v31.3.0).
    if (fixedServedOn === null && options.some((o) => effectSet(o.effect))) {
      throw new DomainException(ERROR_CODES.ANSWER_EFFECT_NEEDS_FIXED, {
        questionId: '',
        code: '',
        questionAr: dto.questionAr,
        questionEn: dto.questionEn,
      });
    }

    const created = await this.repo.createQuestionWithOptions(
      {
        groupId,
        code,
        type,
        questionAr: dto.questionAr,
        questionEn: dto.questionEn,
        helperTextAr: dto.helperTextAr ?? null,
        helperTextEn: dto.helperTextEn ?? null,
        isRequired: dto.isRequired ?? true,
        fixedServedOn,
        displayOrder,
        enabledWhen: dto.enabledWhen
          ? (dto.enabledWhen as unknown as Prisma.InputJsonValue)
          : Prisma.DbNull,
        ...numericColumns(type, dto.numeric ?? null),
        ...textColumns(type, dto.text ?? null),
      },
      optionRows,
    );
    if (mirroredType !== null) {
      // AFTER the question exists, because the link needs its id. A failure here leaves a
      // live question whose options are already right and a list that will not re-sync —
      // recoverable by pointing the list at the question again, which is what the product
      // screen offers.
      await this.enums.updateTypeDefinition(mirroredType, { mirrorQuestionId: created.id });
    }
    if (opts.publish !== false) await this.publish(actor);
    return {
      ...created,
      options: optionRows.map((o, i) => ({ ...o, displayOrder: i })),
    };
  }

  // ---- Mirrored option lists ----------------------------------------------
  /**
   * Re-sync every question that mirrors `typeKey`, then publish once if anything moved.
   *
   * Called by `PlatformEnumerationsAdminService` after ANY write to a value of a mirrored
   * kind — create, relabel, reorder, deactivate, delete. Without it a compound added a week
   * after the product was built would be a registry row the customer can never pick and the
   * engine can never key a table by: the option list is what the questionnaire serves, and
   * nothing else re-derives it.
   *
   * Silent no-op when the kind mirrors nothing, which is every builtin and every list made on
   * the Manage-values rail. The caller checks that too — cheaply, off the cached definitions
   * — so this is the second line of defence rather than the first.
   *
   * NOT transactional across the two tables, and it does not need to be: the registry write
   * has already committed, and the worst interleaving leaves the options one write behind
   * with the next write to that list putting them right. Holding a questionnaire publish
   * inside a registry transaction would be the more expensive kind of wrong.
   */
  async syncMirroredOptions(
    typeKey: string,
    actor: string,
    opts: { publish?: boolean } = {},
  ): Promise<boolean> {
    const defs = await this.enums.typeDefinitions();
    const questionId = defs.get(typeKey)?.mirrorQuestionId ?? null;
    if (questionId === null) return false;

    const rows = await this.mirroredOptionRows(typeKey);
    const changed = await this.repo.syncMirroredOptions(questionId, rows);
    // A publish that changes nothing is still a new ACTIVE version, and version history is
    // how an operator reads what they did. Skipped when nothing moved — and deferred
    // entirely when the caller is going to publish once for several lists.
    if (changed && opts.publish !== false) await this.publish(actor);
    return changed;
  }

  /**
   * Refuse a registry write that would leave a mirrored choice question short of answers.
   *
   * `syncMirroredOptions` runs AFTER the value write has committed and re-checks nothing, so
   * without this an operator emptying a product-authored list one value at a time published a
   * live `SINGLE_SELECT` with no options — unanswerable by the applicant, unkeyable by a
   * bank's table, and refused outright had the same shape been asked for at create
   * (`choice_types_need_at_least_two_active_options`). It is the same rule, checked at the
   * only door that can still say no.
   *
   * Called BEFORE the write, from the registry service, with the key that is going. A value
   * type mirroring a list is not a state this can reach — `assertQuestionTypeRules` refuses
   * `activeOptionCount > 0` on one — but it is checked by type rather than assumed, since the
   * mirror link can be pointed at any question.
   *
   * Silent for an unmirrored kind, which is every builtin and every list on the Manage-values
   * rail.
   */
  async assertMirroredListSurvives(typeKey: string, removingKey: string): Promise<void> {
    const defs = await this.enums.typeDefinitions();
    const questionId = defs.get(typeKey)?.mirrorQuestionId ?? null;
    if (questionId === null) return;

    const question = await this.repo.findQuestion(questionId);
    // A dangling link is not this write's problem: the FK is `ON DELETE SET NULL`, so a
    // deleted question clears it, and a link pointing at nothing blocks nothing.
    if (!question || !isChoiceType(question.type)) return;

    const rows = await this.mirroredOptionRows(typeKey);
    const remaining = rows.filter((row) => row.code !== removingKey).length;
    if (remaining < MIN_CHOICE_OPTIONS) {
      throw new MirroredListMinValuesException({
        type: typeKey,
        key: removingKey,
        questionCode: question.code,
        remaining,
        minimum: MIN_CHOICE_OPTIONS,
      });
    }
  }

  /**
   * A registry type's live values, as question options.
   *
   * `code` IS the enumeration key — never slugged, never minted. `getActiveMembers` returns
   * them already ordered by `sortOrder`, so the array index is the display order and the two
   * screens cannot disagree about which value comes first.
   */
  private async mirroredOptionRows(
    typeKey: string,
  ): Promise<{ code: string; labelAr: string; labelEn: string }[]> {
    const members = await this.enums.getActiveMembers(typeKey);
    return members.map((member) => ({
      code: member.key,
      labelAr: member.labelAr,
      labelEn: member.labelEn,
    }));
  }

  async updateQuestion(
    id: string,
    dto: UpdateQuestionDto,
    actor: string,
    opts: { publish?: boolean } = {},
  ) {
    const question = await this.repo.findQuestion(id);
    if (!question) throw new DomainException(ERROR_CODES.QUESTION_NOT_FOUND);
    if (dto.enabledWhen) {
      await this.assertEnabledWhenValid(dto.displayOrder ?? question.displayOrder, dto.enabledWhen);
    }
    // Deactivation must honour the same branch-integrity guard as delete (A33).
    if (dto.isActive === false && question.isActive) {
      const dependents = (await this.repo.dependentsOf(question.code)).filter(
        (c) => c !== question.code,
      );
      if (dependents.length > 0) {
        throw new DomainException(ERROR_CODES.QUESTION_IN_USE, { dependents });
      }
    }
    const type = dto.type ?? question.type;
    const options = await this.repo.optionsByQuestion(id);
    assertQuestionTypeRules({
      type,
      numeric: dto.numeric !== undefined ? dto.numeric : numericRulesOf(question),
      text: dto.text !== undefined ? dto.text : textRulesOf(question),
      activeOptionCount: options.filter((o) => o.isActive).length,
    });
    // Fixed, moved or un-fixed (v31.1.0: the admin's both ways); `undefined` = left as it is.
    const marking = this.fixedMarkingOf(question, dto.fixedServedOn);
    await this.contract?.assertWrite({
      kind: 'question',
      questionId: id,
      patch: {
        type: dto.type,
        isRequired: dto.isRequired,
        isActive: dto.isActive,
        enabledWhen: dto.enabledWhen,
        unitChanged: numericUnitChanges(question, type, dto),
        ...(marking !== undefined ? { fixedServedOn: marking } : {}),
        questionAr: dto.questionAr,
        questionEn: dto.questionEn,
        helperTextAr: dto.helperTextAr,
        helperTextEn: dto.helperTextEn,
      },
    });
    const data: Prisma.QuestionUpdateInput = {
      questionAr: dto.questionAr,
      questionEn: dto.questionEn,
      helperTextAr: dto.helperTextAr,
      helperTextEn: dto.helperTextEn,
      isRequired: dto.isRequired,
      displayOrder: dto.displayOrder,
      isActive: dto.isActive,
      ...(marking !== undefined ? { fixedServedOn: marking } : {}),
    };
    // A fixed question is asked on every program: no per-program tick of it survives the mark.
    // Un-fixing restores none — a program asks it again only once it is ticked or read there.
    if (marking != null && question.fixedServedOn === null) {
      await this.repo.clearNamePolicyFor(id);
    }
    if (dto.type !== undefined) {
      data.type = dto.type;
    }
    // Switching type must not leave stale rules from the previous type behind.
    if (dto.numeric !== undefined || dto.type !== undefined) {
      Object.assign(data, numericColumns(type, dto.numeric ?? numericRulesOf(question)));
    }
    if (dto.text !== undefined || dto.type !== undefined) {
      Object.assign(data, textColumns(type, dto.text ?? textRulesOf(question)));
    }
    if (dto.enabledWhen !== undefined) {
      data.enabledWhen =
        dto.enabledWhen === null
          ? Prisma.DbNull
          : (dto.enabledWhen as unknown as Prisma.InputJsonValue);
    }
    if (dto.enabledWhen) {
      const groupId = await this.groupBesideTrigger(question.groupId, dto.enabledWhen);
      if (groupId !== question.groupId) data.group = { connect: { id: groupId } };
    }
    // `code` is immutable post-creation (A33).
    const updated = await this.repo.updateQuestion(id, data);
    // An ordinary question's answers change nothing (v31.3.0): un-fixing takes every offer
    // effect off it — its answers' and its number ranges — so a later re-fix starts clean
    // instead of silently reviving figures the admin last saw on a fixed question.
    if (marking === null) await this.repo.clearAnswerEffects(id);
    if (opts.publish !== false) await this.publish(actor);
    return updated;
  }

  /**
   * Switch a question off. A FIXED one (v31.0.0) only by a super admin who typed its code —
   * GitHub-style — and then even a question the loan engine reads goes: what it breaks was in
   * the warning they read first (`deleteImpact`). It keeps its mark, loan types and answers, so
   * a restore (`isActive: true`) brings it back whole.
   */
  async softDeleteQuestion(
    id: string,
    actor: string,
    confirm: { role?: string; confirmCode?: string } = {},
  ) {
    const question = await this.repo.findQuestion(id);
    if (!question) throw new DomainException(ERROR_CODES.QUESTION_NOT_FOUND);
    const dependents = await this.repo.dependentsOf(question.code);
    const others = dependents.filter((c) => c !== question.code);
    if (others.length > 0) {
      throw new DomainException(ERROR_CODES.QUESTION_IN_USE, { dependents: others });
    }
    if (question.fixedServedOn !== null) {
      if (confirm.role !== 'super_admin') throw new DomainException(ERROR_CODES.FORBIDDEN);
      if (confirm.confirmCode !== question.code) {
        throw new DomainException(ERROR_CODES.QUESTION_FIXED_DELETE_CONFIRM_REQUIRED, {
          questionId: question.id,
          code: question.code,
          questionAr: question.questionAr,
          questionEn: question.questionEn,
        });
      }
      await this.contract?.assertWrite({ kind: 'fixed_delete', questionId: id });
    } else {
      await this.contract?.assertWrite({
        kind: 'question',
        questionId: id,
        patch: { isActive: false },
      });
    }
    const deleted = await this.repo.updateQuestion(id, { isActive: false });
    await this.publish(actor);
    return deleted;
  }

  /**
   * What deleting a question would do — what the typed-confirm dialog says BEFORE the super
   * admin types the code: the questions that must go first (a
   * delete is refused while one is gated on it), who reads it (the lock, the bank programmes'
   * names, the products asking it) and what the engine-input ratchet would report, and how many
   * answers stay stored on applications.
   */
  async deleteImpact(id: string) {
    const question = await this.repo.findQuestion(id);
    if (!question) throw new DomainException(ERROR_CODES.QUESTION_NOT_FOUND);
    const [rows, answersStored, productAsks, impact] = await Promise.all([
      this.repo.questions(),
      this.repo.answerCount(id),
      this.repo.productAsksFor(id),
      this.contract?.fixedDeleteImpact(id) ?? Promise.resolve({ lock: null, wouldBreak: [] }),
    ]);
    const byCode = new Map(rows.map((r) => [r.code, r]));
    const blockedBy = (await this.repo.dependentsOf(question.code))
      .filter((code) => code !== question.code)
      .map((code) => ({
        code,
        questionEn: byCode.get(code)?.questionEn ?? code,
        questionAr: byCode.get(code)?.questionAr ?? code,
      }));
    const wouldBreak = [
      ...new Set(
        impact.wouldBreak.map((v) =>
          [v.rule, v.questionCode || v.factKey, v.category, v.programNameKey]
            .filter((part) => part !== undefined && part !== '')
            .join(':'),
        ),
      ),
    ];
    return {
      code: question.code,
      fixedServedOn: question.fixedServedOn,
      confirmationRequired: question.fixedServedOn !== null,
      blockedBy,
      engineReads: impact.lock !== null || wouldBreak.length > 0 || productAsks.length > 0,
      programNames: [...(impact.lock?.programNameKeys ?? [])],
      productAsks,
      wouldBreak,
      answersStored,
    };
  }

  /** The FIXED questions a super admin deleted, for Restore. */
  async deletedFixedQuestions() {
    const rows = await this.repo.deletedFixedQuestions();
    return rows.map((q) => ({
      id: q.id,
      code: q.code,
      questionEn: q.questionEn,
      questionAr: q.questionAr,
      fixedServedOn: q.fixedServedOn,
    }));
  }

  /**
   * The mark an update would WRITE — `undefined` = none (not sent, or already what it is), a
   * value to fix or move it, `null` to un-fix it. The admin's both ways since v31.1.0
   * (operator decision 2026-10-27, "everything dynamic"), program-catalog questions included.
   * The rule that holds while it is fixed (its show-when source is fixed too) is the
   * contract's (`fixed-questions.ts`), judged on the write.
   */
  private fixedMarkingOf(
    question: Question,
    requested: FixedServedOn | null | undefined,
  ): FixedServedOn | null | undefined {
    if (requested === undefined) return undefined;
    return requested === fixedServedOnOf(question.fixedServedOn) ? undefined : requested;
  }

  /**
   * A question CREATED fixed is shown only after another fixed question's answer — the rule the
   * contract holds every later write to (`fixed-questions.ts`), judged here because a create is
   * not played through the contract.
   */
  private async assertFixedAtCreate(dto: CreateQuestionDto): Promise<void> {
    const at = { questionId: '', code: '', questionAr: dto.questionAr, questionEn: dto.questionEn };
    const sourceCode = dto.enabledWhen?.questionCode;
    if (sourceCode === undefined) return;
    const source = (await this.repo.questions()).find((q) => q.code === sourceCode);
    if (source === undefined || !source.isActive || source.fixedServedOn === null) {
      throw new DomainException(ERROR_CODES.QUESTION_FIXED_GATE_NOT_FIXED, {
        ...at,
        sourceCode,
        sourceAr: source?.questionAr ?? sourceCode,
        sourceEn: source?.questionEn ?? sourceCode,
      });
    }
  }

  listQuestions() {
    return this.repo.questions();
  }

  /** Every answer that changes the offer, live — see the repository method (v31.2.0). */
  answerEffectSources(): Promise<AnswerEffectSource[]> {
    return this.repo.answerEffectSources();
  }

  /** The id of the questionnaire version customers are served now, or `null` before the first. */
  async activeVersionId(): Promise<string | null> {
    return (await this.repo.activeVersion())?.id ?? null;
  }

  /**
   * Reorder the flat pool. `ids` is the whole new sequence and every ACTIVE
   * question must appear in it exactly once: a partial list would leave the
   * omitted questions holding orders that collide with the rewritten ones, and the
   * flat editor is the only caller — it always holds the complete list.
   */
  async reorderQuestions(ids: string[], actor: string) {
    const active = (await this.repo.questions()).filter((q) => q.isActive);
    const activeIds = new Set(active.map((q) => q.id));
    const seen = new Set<string>();
    for (const id of ids) {
      if (!activeIds.has(id) || seen.has(id)) {
        throw new DomainException(ERROR_CODES.VALIDATION_FAILED, { field: 'ids', value: id });
      }
      seen.add(id);
    }
    if (seen.size !== activeIds.size) {
      throw new DomainException(ERROR_CODES.VALIDATION_FAILED, {
        field: 'ids',
        expected: activeIds.size,
        received: seen.size,
      });
    }
    await this.repo.reorderQuestions(ids);
    await this.publish(actor);
    return this.draftTree();
  }

  // ---- Options ------------------------------------------------------------
  async createOption(questionId: string, dto: CreateOptionDto, actor: string) {
    const question = await this.repo.findQuestion(questionId);
    if (!question) throw new DomainException(ERROR_CODES.QUESTION_NOT_FOUND);
    if (effectSet(dto.effect)) assertEffectAllowed(question);
    const existing = new Set((await this.repo.optionCodes(questionId)).map((o) => o.code));
    const code = uniqueSlug(dto.labelEn, existing);
    await this.contract?.assertWrite({
      kind: 'option',
      questionId,
      optionCode: code,
      active: true,
    });
    const created = await this.repo.createOption({
      questionId,
      code,
      labelAr: dto.labelAr,
      labelEn: dto.labelEn,
      // Same reason as questions: the flat editor appends options instead of
      // asking the admin to type an order, and 0 would front-load every new one.
      displayOrder: dto.displayOrder ?? (await this.repo.maxOptionOrder(questionId)) + 1,
      ...effectColumns(dto.effect),
    });
    await this.publish(actor);
    return created;
  }

  async updateOption(id: string, dto: UpdateOptionDto, actor: string) {
    const option = await this.repo.findOption(id);
    if (!option) throw new DomainException(ERROR_CODES.QUESTION_OPTION_NOT_FOUND);
    const question = await this.repo.findQuestion(option.questionId);
    if (!question) throw new DomainException(ERROR_CODES.QUESTION_NOT_FOUND);
    if (effectSet(dto.effect)) assertEffectAllowed(question);
    // Deactivating an option must honour the same branch guard as delete (A33).
    if (dto.isActive === false && option.isActive) {
      const dependents = await this.repo.optionDependentsOf(question.code, option.code);
      if (dependents.length > 0) {
        throw new DomainException(ERROR_CODES.QUESTION_OPTION_IN_USE, { dependents });
      }
    }
    if (dto.isActive !== undefined && dto.isActive !== option.isActive) {
      await this.contract?.assertWrite({
        kind: 'option',
        questionId: question.id,
        optionCode: option.code,
        active: dto.isActive,
      });
    }
    // A relabel is judged too (v30.12.0): on a question the engine reads, the quantities in a
    // label stay. Only a label that actually changes — a resend of the same one reads nothing.
    const labelAr =
      dto.labelAr !== undefined && dto.labelAr !== option.labelAr ? dto.labelAr : undefined;
    const labelEn =
      dto.labelEn !== undefined && dto.labelEn !== option.labelEn ? dto.labelEn : undefined;
    if (labelAr !== undefined || labelEn !== undefined) {
      await this.contract?.assertWrite({
        kind: 'option_label',
        questionId: question.id,
        optionCode: option.code,
        labelAr,
        labelEn,
      });
    }
    const updated = await this.repo.updateOption(id, {
      labelAr: dto.labelAr,
      labelEn: dto.labelEn,
      displayOrder: dto.displayOrder,
      isActive: dto.isActive,
      ...effectColumns(dto.effect),
    });
    // An effect is pricing, not snapshot content (v31.2.0): a write that changed ONLY the
    // effect would mint a version identical to the live one, so it publishes nothing.
    const contentChanged =
      labelAr !== undefined ||
      labelEn !== undefined ||
      (dto.displayOrder !== undefined && dto.displayOrder !== option.displayOrder) ||
      (dto.isActive !== undefined && dto.isActive !== option.isActive);
    if (contentChanged) await this.publish(actor);
    return updated;
  }

  /**
   * A FIXED number question's offer ranges (v31.3.0): the whole list, replaced. Pricing, not
   * content — never in the snapshot, so nothing publishes; the engine reads them live
   * (`answerEffectSources`). An empty list removes them.
   */
  async setNumberEffects(questionId: string, dto: SetNumberEffectsDto) {
    const question = await this.repo.findQuestion(questionId);
    if (!question) throw new DomainException(ERROR_CODES.QUESTION_NOT_FOUND);
    if (question.type !== 'NUMERIC') {
      throw new DomainException(ERROR_CODES.ANSWER_EFFECT_RANGES_INVALID, { reason: 'not_number' });
    }
    if (dto.ranges.length > 0) assertEffectAllowed(question);
    const ranges: NumberEffectRange[] = dto.ranges.map((r) => ({
      fromInclusive: r.fromInclusive ?? null,
      toExclusive: r.toExclusive ?? null,
      ...(r.maxLoanPercent != null ? { maxLoanPercent: r.maxLoanPercent } : {}),
      ...(r.ratePoints != null ? { ratePoints: r.ratePoints } : {}),
      ...(r.maxTenorMonths != null ? { maxTenorMonths: r.maxTenorMonths } : {}),
    }));
    const problem = numberEffectRangesProblem(ranges);
    if (problem !== null) {
      throw new DomainException(ERROR_CODES.ANSWER_EFFECT_RANGES_INVALID, { reason: problem });
    }
    await this.repo.setNumberEffects(questionId, ranges);
    return { questionId, ranges };
  }

  /** Soft-delete an option; blocked while a branch (enabledWhen) references it. */
  async softDeleteOption(id: string, actor: string) {
    const option = await this.repo.findOption(id);
    if (!option) throw new DomainException(ERROR_CODES.QUESTION_OPTION_NOT_FOUND);
    const question = await this.repo.findQuestion(option.questionId);
    if (!question) throw new DomainException(ERROR_CODES.QUESTION_NOT_FOUND);
    const dependents = await this.repo.optionDependentsOf(question.code, option.code);
    if (dependents.length > 0) {
      throw new DomainException(ERROR_CODES.QUESTION_OPTION_IN_USE, { dependents });
    }
    if (option.isActive) {
      await this.contract?.assertWrite({
        kind: 'option',
        questionId: question.id,
        optionCode: option.code,
        active: false,
      });
    }
    const deleted = await this.repo.updateOption(id, { isActive: false });
    await this.publish(actor);
    return deleted;
  }

  listOptions(questionId: string) {
    return this.repo.optionsByQuestion(questionId);
  }

  // ---- Versioning (one global questionnaire) ------------------------------
  /**
   * Freeze the active pool into an immutable snapshot. Feature 010: each question
   * carries its `type` and, where relevant, its `numeric` / `text` rule block.
   * Publish itself never fails on a missing money-field binding — it returns a warning
   * (FR-049). What stops one being INTRODUCED is the engine-input contract, which every
   * write above runs before it lands (`EngineContractService`); the warnings report what
   * was already broken before it existed, or broke from outside the questionnaire.
   */
  async publish(publishedBy: string): Promise<PublishResult> {
    const groups = (await this.repo.groups()).filter((g) => g.isActive);
    const questions = (await this.repo.questions()).filter((q) => q.isActive);
    // No loan types and no per-loan-type order are frozen any more (v32.0.0): a question has
    // none, and WHERE a program asks it is the program's, read live (`question-scope.ts`).
    // ONE query for every question's options, not one per question. This runs on every write
    // to a mirrored list, and the snapshot it builds is the largest object in the system.
    const optionsOf = await this.repo.optionsByQuestions(questions.map((q) => q.id));

    const snapshotGroups = [];
    for (const g of groups) {
      const gQuestions = questions.filter((q) => q.groupId === g.id);
      const qOut = [];
      for (const q of gQuestions) {
        const options = (optionsOf.get(q.id) ?? []).filter((o) => o.isActive);
        const numeric = numericRulesOf(q);
        const text = textRulesOf(q);
        qOut.push({
          code: q.code,
          type: q.type,
          questionAr: q.questionAr,
          questionEn: q.questionEn,
          helperTextAr: q.helperTextAr,
          helperTextEn: q.helperTextEn,
          isRequired: q.isRequired,
          displayOrder: q.displayOrder,
          enabledWhen: q.enabledWhen ?? null,
          // FIXED (v31.0.0): frozen like the rest of the question, `null` included, so the
          // narrowing serves it as core and a rollback across the mark is judged on it.
          fixedServedOn: q.fixedServedOn,
          // Emitted only for the type that owns them, so the payload stays honest.
          ...(q.type === 'NUMERIC' && numeric ? { numeric } : {}),
          ...(q.type === 'TEXT' && text ? { text } : {}),
          options: options.map((o) => ({
            code: o.code,
            labelAr: o.labelAr,
            labelEn: o.labelEn,
            displayOrder: o.displayOrder,
          })),
        });
      }
      // A group with nothing to ask never reaches the applicant: the mobile
      // wizard renders one step per snapshot group, so an empty one is a blank
      // screen with a live Next button. Feature 010 makes this reachable — the
      // global pool merges a question into the FIRST group that claims its code,
      // leaving later groups (e.g. `credit_status`, `financial_status`) empty —
      // and an admin deleting a group's last question does the same. The group
      // row stays ACTIVE and editable in the admin tree.
      if (qOut.length === 0) continue;
      snapshotGroups.push({
        code: g.code,
        titleAr: g.titleAr,
        titleEn: g.titleEn,
        displayOrder: g.displayOrder,
        questions: qOut,
      });
    }

    // Read the debt-type options off the snapshot just built, so the check runs
    // against exactly what was frozen rather than a second read of the pool.
    const warnings = collectPublishWarnings(
      questions,
      snapshotGroups
        .flatMap((g) => g.questions)
        .find((q) => q.code === DEBT_TYPES_QUESTION_CODE)
        ?.options.map((o) => o.code) ?? [],
      await this.surrogateBindingContext(questions),
    );

    const versionNumber = await this.repo.nextVersionNumber();
    const snapshot = { versionNumber, groups: snapshotGroups };
    const version = await this.repo.publishVersion({
      versionNumber,
      snapshot: snapshot as unknown as Prisma.InputJsonValue,
      publishedBy,
    });
    return Object.assign(version, { warnings });
  }

  /**
   * The money-field binding warnings for the CURRENT pool, without publishing.
   *
   * Every admin edit auto-publishes, so a save-time toast would fire the same
   * warning on every unrelated keystroke. An unclaimed binding is a standing
   * condition, not an event, so the editor renders this as a persistent banner
   * instead (FR-048 / FR-049).
   */
  /**
   * Every question in the pool, as the predefined-product library and the program-name board
   * need it: whether a question already exists (and is live), what it is gated on, and whether
   * it is fixed. Where it is ASKED is no longer a question's own fact (v32.0.0) — a program asks
   * it when it is fixed, a programme there reads it, or the program ticked it.
   */
  async questionAssignments(): Promise<
    Array<{
      id: string;
      code: string;
      type: string;
      isActive: boolean;
      /** The gate, for callers that must close a pick over `enabledWhen`. */
      enabledWhen: unknown;
      /** FIXED (v31.0.0): asked on every program (or every payslip one); `null` = not. */
      fixedServedOn: FixedServedOn | null;
    }>
  > {
    const questions = await this.repo.questions();
    return questions.map((question) => ({
      id: question.id,
      code: question.code,
      type: String(question.type),
      // Carried, not filtered on. A soft-deleted question still holds its code — the unique
      // is global and immutable — so a caller that treated it as absent would try to create
      // a second question with the same wording and get `..._2`: two questions asking one
      // thing, one of them dead. It has to be told apart from a live one, not hidden.
      isActive: question.isActive,
      enabledWhen: question.enabledWhen ?? null,
      fixedServedOn: question.fixedServedOn,
    }));
  }

  /** Cut a version now. The library's one publish, after all its writes have landed. */
  async publishNow(actor: string): Promise<void> {
    await this.publish(actor);
  }

  async bindingWarnings(): Promise<PublishWarning[]> {
    const active = (await this.repo.questions()).filter((q) => q.isActive);
    const debtTypes = active.find((q) => q.code === DEBT_TYPES_QUESTION_CODE);
    const debtTypeOptionCodes = debtTypes
      ? (await this.repo.optionsByQuestion(debtTypes.id))
          .filter((o) => o.isActive)
          .map((o) => o.code)
      : [];
    return collectPublishWarnings(
      active,
      debtTypeOptionCodes,
      await this.surrogateBindingContext(active),
    );
  }

  /**
   * Editable working tree for the admin editor + preview. Only ACTIVE nodes are
   * returned — soft-deleted groups/questions/options are excluded so a delete
   * visibly removes the row, consistent with what `publish` snapshots.
   */
  async draftTree() {
    const groups = (await this.repo.groups()).filter((g) => g.isActive);
    const questions = (await this.repo.questions()).filter((q) => q.isActive);
    const [locks, askScoped, platformCodes] = await Promise.all([
      // What the loan engine reads, so the editor can say so BEFORE an edit is refused.
      this.contract?.lockViews() ?? Promise.resolve(new Map<string, never>()),
      this.enums.askScopedQuestionCodes(),
      this.enums.platformQuestionCodes(),
    ]);
    // The PROGRAM-CATALOG questions (v31.0.0): what a no-payslip product asks — the Questions
    // tab's Surrogate list. Never a fixed one, nor one bound to a fact the platform owns.
    const surrogateSide = surrogateSideCodes(questions, askScoped, platformCodes);
    const result = [];
    for (const g of groups) {
      const gQuestions = [];
      for (const q of questions.filter((qq) => qq.groupId === g.id)) {
        const options = (await this.repo.optionsByQuestion(q.id)).filter((o) => o.isActive);
        gQuestions.push({
          ...q,
          options,
          engineLock: locks.get(q.code) ?? null,
          surrogateSide: surrogateSide.has(q.code),
        });
      }
      result.push({ ...g, questions: gQuestions });
    }
    return result;
  }

  history() {
    return this.repo.versionHistory();
  }

  /**
   * Serve an older version again. Judged like any edit: a version frozen before a question the
   * engine reads today existed would quote without it, so the contract refuses the rollback
   * rather than serving that questionnaire.
   */
  async rollback(versionId: string) {
    const version = await this.repo.versionById(versionId);
    if (!version) {
      throw new DomainException(ERROR_CODES.QUESTIONNAIRE_NOT_PUBLISHED);
    }
    await this.contract?.assertWrite({ kind: 'snapshot', snapshot: version.snapshot });
    return this.repo.activateExisting(versionId);
  }

  /**
   * Validate submitted answers against the LIVE global questions/options and
   * resolve stable ids for persistence as `application_answer` rows.
   *
   * Feature 010: type-aware. Each answer must carry the value key its question's
   * type expects (`ANSWER_TYPE_MISMATCH`), numbers must sit inside the declared
   * bounds (`ANSWER_OUT_OF_RANGE`), text must fit (`ANSWER_TOO_LONG`), and every
   * required, VISIBLE question must be answered (`ANSWER_REQUIRED`). A question
   * hidden by its `enabledWhen` is never required.
   *
   * Single choice still resolves `selectedOptionId`/`selectedOptionCode` so the
   * surrogate-fact mapper and the admin answer views keep working unchanged (FR-045).
   *
   * `programNameKey` + `category` decide which questions this applicant was ASKED — the
   * program they picked (`question-scope.ts`), the same decision the served snapshot came
   * from. It has to: required-question enforcement runs here, so without it a personal-loan
   * applicant would be rejected for not answering a car question they were never shown. With
   * no program the BASELINE is asked (the fixed questions and the money core).
   *
   * Returns that asked set alongside the resolved rows. It is NOT bookkeeping: it is
   * the precise test for "did the snapshot this application was served actually ASK a
   * question", and `resolveApplicantObligations` reads it to tell three states apart —
   * a snapshot predating the itemised-debt question (fall back to the stated lump sum),
   * one that asked it and got no answer (no figure), and one that asked and was answered
   * (sum the items). That distinction shapes the QUOTED AMOUNT.
   *
   * It cannot be recovered from `resolved` afterwards: a skipped optional question is
   * asked but produces no row (`validateAnswer` returns null).
   */
  async resolveAnswers(
    answers: ReadonlyArray<SubmittedAnswerValue>,
    category?: LoanCategory,
    programNameKey?: string,
  ): Promise<{ resolved: ResolvedAnswer[]; askedQuestionCodes: string[] }> {
    const questions = await this.repo.questions();
    // EVERY live question, whatever the program narrows to below. Two reasons, and both are
    // load-bearing. It is the ACCEPTANCE map, and a backend deploy is not atomic with an app
    // release — a build in the field posts what it was served, which may be more than today's
    // program asks, so narrowing what may be answered would answer it with
    // `UNKNOWN_QUESTION_CODE`. It is also what `isQuestionVisible` reads to decide whether a
    // gate is dangling: keeping it wide means a narrowed-away gate SOURCE can never make its
    // target read as unconditionally visible, which is a second guard independent of the
    // narrowing rule's own gate closure.
    const active = questions.filter((q) => q.isActive);
    const byCode = new Map(active.map((q) => [q.code, q]));
    const submitted = new Map(answers.map((a) => [a.questionCode, a]));

    // The program the applicant picked. No program, no read: the baseline is asked.
    const decision = narrowAskedQuestions(
      active.map((q) => ({
        code: q.code,
        enabledWhen: q.enabledWhen,
        fixedServedOn: q.fixedServedOn,
      })),
      programNameKey === undefined || category === undefined
        ? null
        : await this.enums.narrowingScopeFor(programNameKey, category),
    );

    // Unknown codes fail before anything else: a stale client must be told. Only a code the
    // pool does not hold (or holds switched off) is unknown — an answer to a live question this
    // program did not ask is accepted and simply not stored (it is not served, below).
    for (const a of answers) {
      if (!byCode.has(a.questionCode)) {
        throw new DomainException(ERROR_CODES.UNKNOWN_QUESTION_CODE, { code: a.questionCode });
      }
    }

    const optionsByQuestionId = new Map<string, { id: string; code: string }[]>();
    for (const q of active) {
      const opts = (await this.repo.optionsByQuestion(q.id)).filter((o) => o.isActive);
      optionsByQuestionId.set(
        q.id,
        opts.map((o) => ({ id: o.id, code: o.code })),
      );
    }

    const resolved: ResolvedAnswer[] = [];
    const askedQuestionCodes: string[] = [];
    for (const q of active) {
      // Not served: this program does not ask it, so it is neither required, nor stored, nor
      // recorded as asked. `keep` is authoritative with or without a name. Before the visibility test, because a question
      // nobody in scope reads is not a question whose gate is worth evaluating.
      if (!decision.keep.has(q.code)) continue;

      const options = optionsByQuestionId.get(q.id) ?? [];
      const visible = isQuestionVisible(q, submitted, byCode);
      const answer = submitted.get(q.code);

      if (!visible) {
        // Hidden questions are neither required nor stored, so they were never
        // asked and stay out of the asked set.
        continue;
      }
      // Asked = active, served to this program, and visible. Recorded BEFORE validation, so a
      // question the applicant skipped still counts as one they were shown.
      askedQuestionCodes.push(q.code);

      const normalised = validateAnswer(
        {
          code: q.code,
          type: q.type,
          // Required because a program in scope reads it — the same override the served
          // snapshot carries, from the same decision, so the app and the server cannot
          // disagree about which questions the applicant had to answer.
          isRequired: q.isRequired || decision.extraRequired.has(q.code),
          optionCodes: options.map((o) => o.code),
          numeric: numericRulesOf(q),
          text: textRulesOf(q),
        },
        answer,
      );
      if (!normalised) continue;

      resolved.push({
        questionId: q.id,
        questionCode: q.code,
        type: normalised.type,
        selectedOptionCodes: normalised.selectedOptionCodes,
        selectedOptionCode: normalised.selectedOptionCode,
        selectedOptionId:
          normalised.selectedOptionCode !== null
            ? (options.find((o) => o.code === normalised.selectedOptionCode)?.id ?? null)
            : null,
        textValue: normalised.textValue,
        numericValue: normalised.numericValue,
      });
    }
    return { resolved, askedQuestionCodes };
  }

  /**
   * Resolve an application's stored answers into a grouped, labelled view using
   * the FROZEN version snapshot (submit-time-correct content). Input carries the
   * picked codes (`ApplicationAnswer.questionCode` + `selectedOptionCode`); this
   * maps them to question/option labels (bilingual) grouped and ordered exactly
   * as the questionnaire was presented. `category` is echoed into the view for
   * display only (the questionnaire itself is global). Returns null if the
   * version is gone.
   */
  async buildAnswersView(
    source: { versionId: string | null; category: string; createdAt?: Date },
    answers: ReadonlyArray<ApplicantAnswerInput>,
  ): Promise<ApplicantQuestionnaireView | null> {
    // Prefer the exact submit-time snapshot. With no version id recorded (every application
    // before v30.11.0 — the app sends none), the version that was LIVE when the application
    // was made, not today's: a question retired since would otherwise vanish from the answers
    // the applicant actually gave. The active version only when neither is known.
    const version = source.versionId
      ? await this.repo.versionById(source.versionId)
      : ((source.createdAt ? await this.repo.versionLiveAt(source.createdAt) : null) ??
        (await this.repo.activeVersion()));
    if (!version) return null;
    const snap = version.snapshot as unknown as StoredSnapshot;
    const picked = new Map(answers.map((a) => [a.questionCode, a]));

    const orderOf = (x: unknown): number =>
      Number((x as Record<string, unknown>)['displayOrder'] ?? 0);

    const groups: ApplicantAnswerGroup[] = [];
    for (const g of [...(snap.groups ?? [])].sort((a, b) => orderOf(a) - orderOf(b))) {
      const items: ApplicantAnswerItem[] = [];
      for (const q of [...(g.questions ?? [])].sort((a, b) => orderOf(a) - orderOf(b))) {
        const answer = picked.get(q.code);
        if (!answer) continue;
        const rendered = renderAnswer(q, answer);
        items.push({
          questionCode: q.code,
          questionAr: String(q['questionAr'] ?? q.code),
          questionEn: String(q['questionEn'] ?? q.code),
          answerAr: rendered.ar,
          answerEn: rendered.en,
        });
      }
      if (items.length > 0) {
        groups.push({ code: g.code, titleAr: g.titleAr, titleEn: g.titleEn, items });
      }
    }

    return {
      category: source.category,
      versionNumber: Number(snap.versionNumber ?? version.versionNumber),
      groups,
    };
  }

  // ---- Internals ----------------------------------------------------------
  /**
   * The group a gated question must live in: its trigger's, whenever its own would page it
   * on a step no later than the trigger's.
   *
   * The mobile wizard is one step per group. A question revealed by an answer on step 2 but
   * filed under step 1 appears behind the customer — and when it is required, Finish stays
   * grey with nothing on screen to fill. That is how the compound follow-ups shipped: the
   * blueprint builder names no group, so they joined the FIRST one. An equal group order
   * counts as "no later" because a tie is paged in an order nothing pins. A trigger on an
   * EARLIER step reveals ahead of the customer, which is fine, so that placement is kept.
   */
  private async groupBesideTrigger(
    groupId: string,
    rule: { questionCode: string } | null | undefined,
  ): Promise<string> {
    if (!rule) return groupId;
    const trigger = (await this.repo.questions()).find((q) => q.code === rule.questionCode);
    if (!trigger || trigger.groupId === groupId) return groupId;
    const [own, theirs] = await Promise.all([
      this.repo.findGroup(groupId),
      this.repo.findGroup(trigger.groupId),
    ]);
    if (!own || !theirs) return groupId;
    return own.displayOrder <= theirs.displayOrder ? trigger.groupId : groupId;
  }

  private async assertEnabledWhenValid(
    selfOrder: number,
    rule: { questionCode: string; operator: string; optionCode?: string; optionCodes?: string[] },
  ): Promise<void> {
    // The SHAPE first: `in` names several answers and no single one, `equals` / `not_equals`
    // exactly one. A rule of the other shape would read as no gate at all
    // (`enabledWhenGate`), which is a question shown to everyone that the admin meant to hide.
    const isIn = rule.operator === 'in';
    if (
      isIn
        ? rule.optionCode !== undefined || rule.optionCodes === undefined
        : rule.optionCodes !== undefined || rule.optionCode === undefined
    ) {
      throw new DomainException(ERROR_CODES.ENABLED_WHEN_INVALID, { reason: 'shape' });
    }
    const codes = isIn ? (rule.optionCodes ?? []) : [rule.optionCode as string];
    // One answer is `equals`; a list of one would be the same rule under a second spelling.
    if (isIn && new Set(codes).size < 2) {
      throw new DomainException(ERROR_CODES.ENABLED_WHEN_INVALID, { reason: 'in_needs_two' });
    }
    const questions = await this.repo.questions();
    const ref = questions.find((q) => q.code === rule.questionCode);
    if (!ref) {
      throw new DomainException(ERROR_CODES.ENABLED_WHEN_INVALID, { reason: 'unknown_question' });
    }
    // No forward references: the dependency must come earlier (Spec §4.1.1).
    if (ref.displayOrder >= selfOrder) {
      throw new DomainException(ERROR_CODES.ENABLED_WHEN_INVALID, { reason: 'forward_reference' });
    }
    // `enabledWhen` compares an OPTION code, so the source must be a choice
    // question — a text or number question has no options to branch on.
    assertBranchSourceIsChoice(ref.type, ref.code);
    const options = await this.repo.optionsByQuestion(ref.id);
    if (codes.some((code) => !options.some((o) => o.code === code))) {
      throw new DomainException(ERROR_CODES.ENABLED_WHEN_INVALID, { reason: 'unknown_option' });
    }
  }
}

// ---- Feature 010 helpers ---------------------------------------------------

/**
 * A choice question is created before its options exist, so the ">= 2 options"
 * rule cannot be evaluated at create time. We pass this sentinel so the rule
 * passes on create and is enforced on every later update.
 */
const MIN_CHOICE_OPTIONS_AT_CREATE = 2;

/**
 * The group a question joins when the pool is empty and the caller (the flat
 * editor) names none. Looked up by this fixed code rather than slugged from the
 * title, so it resolves to the same row every time instead of accumulating
 * `general-1`, `general-2`, … on each create.
 */
const DEFAULT_GROUP_CODE = 'general';
const DEFAULT_GROUP_TITLE_EN = 'Questions';
const DEFAULT_GROUP_TITLE_AR = 'الأسئلة';

/** Publish-time warning: non-blocking, surfaced in the publish response. */
export interface PublishWarning {
  code: string;
  meta: Record<string, unknown>;
}

export type PublishResult = { warnings: PublishWarning[] } & Record<string, unknown>;

export interface ResolvedAnswer {
  questionId: string;
  questionCode: string;
  type: QuestionType;
  selectedOptionCodes: string[];
  selectedOptionCode: string | null;
  selectedOptionId: string | null;
  textValue: string | null;
  numericValue: string | null;
}

/** Shape of the numeric/text rule columns on a live `Question` row. */
interface QuestionRuleColumns {
  numericMinValue: Prisma.Decimal | null;
  numericMaxValue: Prisma.Decimal | null;
  numericStep: Prisma.Decimal | null;
  numericUnitAr: string | null;
  numericUnitEn: string | null;
  textMaxLength: number | null;
}

/**
 * Whether `updateQuestion` would change a NUMERIC question's unit. The editor resends every
 * rule on each save, so this compares values rather than presence: a resend of the same unit is
 * not a change, and a lock must not refuse it.
 */
function numericUnitChanges(
  question: QuestionRuleColumns & { type: QuestionType },
  type: QuestionType,
  dto: UpdateQuestionDto,
): boolean {
  if (question.type !== 'NUMERIC' || type !== 'NUMERIC' || dto.numeric === undefined) return false;
  return (
    !sameText(dto.numeric?.unitAr, question.numericUnitAr) ||
    !sameText(dto.numeric?.unitEn, question.numericUnitEn)
  );
}

export function numericRulesOf(q: QuestionRuleColumns): {
  minValue: string | null;
  maxValue: string | null;
  step: string | null;
  unitAr: string | null;
  unitEn: string | null;
} | null {
  if (
    q.numericMinValue === null &&
    q.numericMaxValue === null &&
    q.numericStep === null &&
    q.numericUnitAr === null &&
    q.numericUnitEn === null
  ) {
    return null;
  }
  return {
    minValue: q.numericMinValue?.toFixed(2) ?? null,
    maxValue: q.numericMaxValue?.toFixed(2) ?? null,
    step: q.numericStep?.toFixed(2) ?? null,
    unitAr: q.numericUnitAr,
    unitEn: q.numericUnitEn,
  };
}

export function textRulesOf(q: QuestionRuleColumns): { maxLength: number } | null {
  return q.textMaxLength === null ? null : { maxLength: q.textMaxLength };
}

/** True when a request carries an effect with a lever set — null or all-empty sets none. */
function effectSet(effect: OptionEffectDto | null | undefined): boolean {
  return (
    effect != null &&
    (effect.maxLoanPercent != null || effect.ratePoints != null || effect.maxTenorMonths != null)
  );
}

/** Only a FIXED question's answers change the offer (v31.3.0). */
function assertEffectAllowed(question: Question): void {
  if (question.fixedServedOn !== null) return;
  throw new DomainException(ERROR_CODES.ANSWER_EFFECT_NEEDS_FIXED, {
    questionId: question.id,
    code: question.code,
    questionAr: question.questionAr,
    questionEn: question.questionEn,
  });
}

/**
 * An answer's offer effect → its three columns (v31.2.0). Omitted = untouched (no keys);
 * null = cleared; an object REPLACES the whole effect, so a lever it leaves out is cleared.
 */
function effectColumns(effect: OptionEffectDto | null | undefined): OptionEffectColumns {
  if (effect === undefined) return {};
  const dec = (v: string | null | undefined) =>
    v === undefined || v === null ? null : new Prisma.Decimal(v);
  return {
    effectMaxLoanPercent: dec(effect?.maxLoanPercent),
    effectRatePoints: dec(effect?.ratePoints),
    effectMaxTenorMonths: effect?.maxTenorMonths ?? null,
  };
}

/** Only the owning type keeps its rule columns; everything else is nulled out. */
function numericColumns(
  type: QuestionType,
  numeric:
    | NumericRulesDto
    | {
        minValue?: string | null;
        maxValue?: string | null;
        step?: string | null;
        unitAr?: string | null;
        unitEn?: string | null;
      }
    | null,
): Pick<
  Prisma.QuestionUncheckedCreateInput,
  'numericMinValue' | 'numericMaxValue' | 'numericStep' | 'numericUnitAr' | 'numericUnitEn'
> {
  if (type !== 'NUMERIC' || !numeric) {
    return {
      numericMinValue: null,
      numericMaxValue: null,
      numericStep: null,
      numericUnitAr: null,
      numericUnitEn: null,
    };
  }
  return {
    numericMinValue: numeric.minValue ?? null,
    numericMaxValue: numeric.maxValue ?? null,
    numericStep: numeric.step ?? null,
    numericUnitAr: numeric.unitAr ?? null,
    numericUnitEn: numeric.unitEn ?? null,
  };
}

function textColumns(
  type: QuestionType,
  text: TextRulesDto | { maxLength?: number | null } | null,
): Pick<Prisma.QuestionUncheckedCreateInput, 'textMaxLength'> {
  if (type !== 'TEXT') return { textMaxLength: null };
  return { textMaxLength: text?.maxLength ?? null };
}

/**
 * A question is visible when it has no branch rule, or when the rule's source
 * question was answered with (or without, for `not_equals`) the named option.
 * Multi-pick satisfies `equals` when ANY picked code matches.
 */
/**
 * FR-048 / FR-049: every money-field binding must resolve to an ACTIVE NUMERIC
 * question. A miss is a warning, not a publish failure — but a quote for an
 * affected applicant then fails with `MONEY_FIGURE_MISSING` rather than being
 * silently defaulted to zero (FR-044).
 */
function collectPublishWarnings(
  activeQuestions: ReadonlyArray<{ code: string; type: QuestionType }>,
  debtTypeOptionCodes: readonly string[],
  /**
   * Feature 011 — what the surrogate-fact checks need beyond code and type: the
   * question's option codes (which must BE the registry keys) and the categories it
   * is assigned to. Optional so a caller that has neither still gets every
   * money-binding warning rather than none.
   */
  surrogateContext?: SurrogateBindingContext,
): PublishWarning[] {
  const byCode = new Map(activeQuestions.map((q) => [q.code, q]));
  const warnings: PublishWarning[] = [];
  // The figures that must be ASKED — not the stated obligations total, which the itemised
  // debts below replace (2026-10-26); a missing debt-type question is warned about there.
  for (const binding of ASKED_MONEY_FIELD_BINDING_KEYS) {
    const questionCode = MONEY_FIELD_BINDINGS[binding];
    const q = byCode.get(questionCode);
    if (!q) {
      warnings.push({
        code: ERROR_CODES.MONEY_FIELD_BINDING_MISSING,
        meta: { binding, questionCode, reason: 'missing_or_inactive' },
      });
      continue;
    }
    if (q.type !== 'NUMERIC') {
      warnings.push({
        code: ERROR_CODES.MONEY_FIELD_BINDING_MISSING,
        meta: { binding, questionCode, reason: 'not_numeric', type: q.type },
      });
    }
  }

  // Itemised obligations: every debt type the applicant can TICK must have a
  // NUMERIC question to state its instalment in. An option with no amount
  // question is the one failure mode that loses money silently — the applicant
  // declares a debt, no question ever asks what it costs, and it contributes 0
  // to the DBR sum. `none` is exempt: it exists precisely to mean "no amounts".
  for (const optionCode of debtTypeOptionCodes) {
    if (optionCode === DEBT_TYPE_NONE_OPTION) continue;
    const itemCode = obligationItemQuestionFor(optionCode);
    if (itemCode === undefined) {
      warnings.push({
        code: ERROR_CODES.MONEY_FIELD_BINDING_MISSING,
        meta: {
          binding: 'existing_obligations',
          questionCode: DEBT_TYPES_QUESTION_CODE,
          optionCode,
          reason: 'debt_type_option_unmapped',
        },
      });
      continue;
    }
    const item = byCode.get(itemCode);
    if (!item) {
      warnings.push({
        code: ERROR_CODES.MONEY_FIELD_BINDING_MISSING,
        meta: {
          binding: 'existing_obligations',
          questionCode: itemCode,
          optionCode,
          reason: 'obligation_item_missing_or_inactive',
        },
      });
      continue;
    }
    if (item.type !== 'NUMERIC') {
      warnings.push({
        code: ERROR_CODES.MONEY_FIELD_BINDING_MISSING,
        meta: {
          binding: 'existing_obligations',
          questionCode: itemCode,
          optionCode,
          reason: 'obligation_item_not_numeric',
          type: item.type,
        },
      });
    }
  }

  warnings.push(...collectSurrogateBindingWarnings(byCode, surrogateContext));
  return warnings;
}

/**
 * What the surrogate-fact checks read, beyond the question's code and type.
 *
 * The option codes matter because they must BE the registry keys the admin's table
 * is keyed by (FR-017): matching by label could never work — there are two labels,
 * ar and en.
 */
export interface SurrogateBindingContext {
  /**
   * The facts as the REGISTRY holds them — every active one, including those whose
   * binding is broken, because those are the ones worth a warning.
   *
   * `questionCode: null` is an unbound fact; `questionType: null` accompanies it, or
   * marks a question of a type no table can be keyed by (the read that produced this
   * drops the type in both cases, so the two collapse into one reported reason).
   */
  readonly facts: ReadonlyArray<{
    key: string;
    questionCode: string | null;
    questionType: string | null;
  }>;
  /** Active option codes per question code. */
  readonly optionCodesByQuestion: ReadonlyMap<string, readonly string[]>;
  /** Active members of each registry a choice fact draws its options from. */
  readonly registryMembers: ReadonlyMap<string, readonly string[]>;
}

/**
 * The `dead_registry_key` half of FR-021 deliberately does NOT live here.
 *
 * It is a per-PROGRAM condition — a saved `keyTable` row pointing at a key the
 * registry has dropped — and its fix is to open that program and re-pick the row.
 * Reporting it from the questionnaire would mean this module reading bank programs,
 * a dependency it has no other reason to carry, and would put the warning on a
 * screen where nothing can be done about it. It is raised on the program read
 * instead: `bank-programs.service.ts#collectIncomeRuleBindingWarnings`.
 */

/**
 * FR-021 — the surrogate-fact bindings, checked exactly as the money bindings are.
 *
 * WARNINGS ONLY. Publishing never fails on a binding, for the reason
 * `MONEY_FIELD_BINDING_MISSING` already records: a half-renamed binding must not lock
 * the pool. The cost of the miss is real but bounded — the rule resolves to
 * `SURROGATE_FACT_MISSING` and the program is listed with a stated reason, never a
 * zero — so the correct response is to tell the admin loudly, not to refuse the
 * publish that might be fixing something else.
 *
 * There is no "is it asked anywhere" check any more (v32.0.0): a question carries no loan
 * type, and a program asks the fact its programmes read on its own (`question-scope.ts`), so a
 * bound question is asked exactly where it is read.
 */
function collectSurrogateBindingWarnings(
  byCode: ReadonlyMap<string, { code: string; type: QuestionType }>,
  ctx: SurrogateBindingContext | undefined,
): PublishWarning[] {
  const warnings: PublishWarning[] = [];
  // No context = no registry read, so there are no facts to check. Not a fallback to
  // the four legacy specs: that would report a fact this environment may have retired.
  if (!ctx) return warnings;

  for (const entry of ctx.facts) {
    const fact = entry.key;
    const questionCode = entry.questionCode;

    // Unbound, or bound to a question that has left the pool / cannot key a table.
    // One reason for all of them because the customer-facing outcome is identical —
    // no figure at all — and the fix always starts on the same screen.
    if (!questionCode || !isBindableQuestionType(entry.questionType ?? '')) {
      warnings.push({
        code: ERROR_CODES.SURROGATE_FACT_BINDING_MISSING,
        meta: {
          fact,
          ...(questionCode ? { questionCode } : {}),
          reason: 'missing_or_inactive' satisfies SurrogateBindingWarningReason,
        },
      });
      continue;
    }

    const q = byCode.get(questionCode);
    if (!q) {
      warnings.push({
        code: ERROR_CODES.SURROGATE_FACT_BINDING_MISSING,
        meta: {
          fact,
          questionCode,
          reason: 'missing_or_inactive' satisfies SurrogateBindingWarningReason,
        },
      });
      continue;
    }

    // The question's type as the POOL holds it, against the type the binding was made
    // with. Normally equal; they part when an operator changes the type of a question
    // some fact is bound to, which silently turns every bank table keyed by it into a
    // table nothing can look up.
    if (q.type !== entry.questionType) {
      warnings.push({
        code: ERROR_CODES.SURROGATE_FACT_BINDING_MISSING,
        meta: {
          fact,
          questionCode,
          reason: 'wrong_type' satisfies SurrogateBindingWarningReason,
          type: q.type,
          expected: entry.questionType,
        },
      });
      // Keep going: a wrong-typed question can also have drifted options, and an admin
      // fixing one only to find the other on the next publish is a wasted round.
    }

    // The enumeration pairing, for the two legacy choice facts that have one. A fact
    // added on Manage values keys its table off this question's own options, so there
    // is no second list for it to drift from — `spec` is undefined and the check is
    // skipped, not defaulted to some enumeration guessed from the key.
    const spec = SURROGATE_FACT_SPECS[fact as SurrogateFact] as SurrogateFactSpec | undefined;
    if (!spec?.registry) continue;
    const members = ctx.registryMembers.get(spec.registry);
    const optionCodes = ctx.optionCodesByQuestion.get(questionCode);
    if (members === undefined || optionCodes === undefined) continue;

    // Drift in the direction that BREAKS the match: an option the registry no longer
    // carries is an answer no table can be keyed by, so that applicant resolves to
    // `no_matching_row` forever. The reverse (a registry key with no option) is NOT
    // warned about here — it means a grade nobody can pick yet, which is a table row
    // waiting for a questionnaire edit, not a broken binding.
    const unknown = optionCodes.filter((code) => !members.includes(code));
    if (unknown.length > 0) {
      warnings.push({
        code: ERROR_CODES.SURROGATE_FACT_BINDING_MISSING,
        meta: {
          fact,
          questionCode,
          reason: 'option_codes_drifted' satisfies SurrogateBindingWarningReason,
          registry: spec.registry,
          unknown,
        },
      });
    }
  }

  return warnings;
}

interface StoredOption extends Record<string, unknown> {
  code: string;
  labelAr: string;
  labelEn: string;
  displayOrder: number;
}
interface StoredQuestion extends Record<string, unknown> {
  code: string;
  options?: StoredOption[];
}
interface StoredGroup {
  code: string;
  titleAr: string;
  titleEn: string;
  displayOrder: number;
  questions?: StoredQuestion[];
}
interface StoredSnapshot {
  versionNumber?: unknown;
  groups?: StoredGroup[];
}

// ---- Applicant answers view (admin detail) --------------------------------

/**
 * One stored `application_answer` row, in the shape the view needs. Every value
 * column is carried: a NUMERIC or TEXT answer has no option code, so reading
 * only `selectedOptionCode` (pre-feature-010 behaviour) rendered those questions
 * blank on the admin detail page.
 */
export interface ApplicantAnswerInput {
  questionCode: string;
  selectedOptionCode: string | null;
  selectedOptionCodes?: readonly string[];
  textValue?: string | null;
  /** Decimal STRING — never a JS number (Principle I). */
  numericValue?: string | null;
}

export interface ApplicantAnswerItem {
  questionCode: string;
  questionAr: string;
  questionEn: string;
  answerAr: string | null;
  answerEn: string | null;
}
export interface ApplicantAnswerGroup {
  code: string;
  titleAr: string;
  titleEn: string;
  items: ApplicantAnswerItem[];
}
export interface ApplicantQuestionnaireView {
  category: string;
  versionNumber: number;
  groups: ApplicantAnswerGroup[];
}

/**
 * Render one stored answer as bilingual display text, using the FROZEN snapshot
 * question it belongs to. Choice answers resolve to option labels; NUMERIC
 * answers render the stored decimal with the question's own unit (the snapshot
 * carries `numeric.unitAr` / `unitEn`); TEXT answers pass through verbatim —
 * an authorised admin reading an application is exactly who the answer was
 * collected for (Principle VI masks on the way OUT to logs, not to the UI).
 */
function renderAnswer(
  q: StoredQuestion,
  answer: ApplicantAnswerInput,
): { ar: string | null; en: string | null } {
  const options = q.options ?? [];
  const labelsFor = (codes: readonly string[]): { ar: string; en: string } | null => {
    const matched = codes
      .map((code) => options.find((o) => o.code === code))
      .filter((o): o is StoredOption => o !== undefined);
    if (matched.length === 0) return null;
    return {
      ar: matched.map((o) => o.labelAr).join('، '),
      en: matched.map((o) => o.labelEn).join(', '),
    };
  };

  if (answer.selectedOptionCode) {
    const one = labelsFor([answer.selectedOptionCode]);
    return { ar: one?.ar ?? null, en: one?.en ?? null };
  }
  if (answer.selectedOptionCodes && answer.selectedOptionCodes.length > 0) {
    const many = labelsFor(answer.selectedOptionCodes);
    return { ar: many?.ar ?? null, en: many?.en ?? null };
  }
  if (answer.numericValue != null && answer.numericValue !== '') {
    const numeric = (q['numeric'] ?? {}) as { unitAr?: unknown; unitEn?: unknown };
    const formatted = formatDecimalString(answer.numericValue);
    const unitAr = typeof numeric.unitAr === 'string' ? numeric.unitAr : null;
    const unitEn = typeof numeric.unitEn === 'string' ? numeric.unitEn : null;
    return {
      ar: unitAr ? `${formatted} ${unitAr}` : formatted,
      en: unitEn ? `${formatted} ${unitEn}` : formatted,
    };
  }
  if (answer.textValue != null && answer.textValue.trim().length > 0) {
    return { ar: answer.textValue, en: answer.textValue };
  }
  return { ar: null, en: null };
}

/**
 * Group a decimal STRING for display without ever going through a float
 * (Principle I / A3): thousands separators on the integer part, trailing
 * `.00` dropped.
 */
function formatDecimalString(value: string): string {
  const [rawInt = '0', rawFraction] = value.split('.');
  const negative = rawInt.startsWith('-');
  const digits = negative ? rawInt.slice(1) : rawInt;
  const grouped = digits.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const fraction =
    rawFraction && /[1-9]/.test(rawFraction) ? `.${rawFraction.replace(/0+$/, '')}` : '';
  return `${negative ? '-' : ''}${grouped}${fraction}`;
}

/**
 * Project the stored snapshot into the customer payload: the questions the picked program asks
 * (`question-scope.ts` — with no program, the baseline), each step in the program's own order.
 * Questions and answers are pure content (MVP), so the rest is a shape passthrough — no IP
 * fields to strip. A group left with no questions is dropped: the mobile wizard renders one
 * step per group, so an empty one is a blank screen with a live Next button.
 *
 * A question carries no loan type since v32.0.0. `category` is read only to honour an OLD
 * snapshot's frozen fixed marks (`frozenFixedServedOn`, the deploy window and a rollback). With
 * neither a category nor a program (the whole-pool read) every question is served, in the pool's
 * order — what every client got before any narrowing existed.
 */
function toCustomerSnapshot(
  raw: unknown,
  category?: LoanCategory,
  scope: NarrowingScope | null = null,
): unknown {
  const snap = raw as StoredSnapshot;
  const num = (value: unknown): number => (typeof value === 'number' ? value : 0);
  // Each step in the POOL's order first (the Questions tab's: `displayOrder`, then the code) —
  // the order `orderServed` places a question the program never placed by.
  const pooled = (snap.groups ?? []).map((g) => ({
    ...g,
    questions: [...(g.questions ?? [])].sort(
      (a, b) => num(a['displayOrder']) - num(b['displayOrder']) || a.code.localeCompare(b.code),
    ),
  }));

  // The program's rule, applied ACROSS groups and in one call: a question's gate may point at a
  // question in another group, so a per-group decision could drop a source and leave its target
  // dangling — which `isQuestionVisible` renders as unconditionally visible.
  const decision =
    category === undefined && scope === null
      ? null
      : narrowAskedQuestions(
          pooled.flatMap((g) =>
            g.questions.map((q) => ({
              code: q.code,
              enabledWhen: q['enabledWhen'] ?? null,
              // Frozen since v31.0.0; a snapshot published before reads as "nothing fixed".
              fixedServedOn: frozenFixedServedOn(q, category),
            })),
          ),
          scope,
        );

  const groups = pooled
    .map((g) => ({
      ...g,
      questions: orderServed(
        g.questions.filter((q) => decision === null || decision.keep.has(q.code)),
        scope?.orderedQuestionCodes,
      ),
    }))
    .filter((g) => g.questions.length > 0);
  return {
    versionNumber: snap.versionNumber,
    groups: groups.map((g) => ({
      code: g.code,
      titleAr: g.titleAr,
      titleEn: g.titleEn,
      displayOrder: g.displayOrder,
      questions: g.questions.map((q, index) => ({
        code: q.code,
        // A snapshot published before feature 010 has no `type` — it reads as
        // single choice, which is exactly what it was (FR-045).
        type: resolveQuestionType(q['type'] as string | null | undefined),
        questionAr: q['questionAr'],
        questionEn: q['questionEn'],
        helperTextAr: q['helperTextAr'],
        helperTextEn: q['helperTextEn'],
        // Required BECAUSE a program in scope reads it: the only reason a narrowed question is
        // on screen is that the picked name's calculation needs the answer, and an unanswered
        // fact is not a smaller quote but no quote at all from that program. The app reads
        // requiredness straight off the snapshot, so this line is the whole of it client-side.
        isRequired: q['isRequired'] === true || (decision?.extraRequired.has(q.code) ?? false),
        // THE PROGRAM'S POSITION within the step, emitted into the field the app sorts by
        // (`questionnaire_snapshot_model.dart`). The array is already in this order
        // (`orderServed` above); the number goes with it so a client that sorts rather than
        // trusts the array agrees with one that does not, and a drag on the admin's program
        // page reaches the applicant with no app change at all.
        displayOrder: index,
        enabledWhen: q['enabledWhen'] ?? null,
        // Rule blocks travel to the client so the app can enforce bounds locally
        // for immediate feedback. The server remains the authority.
        ...(q['numeric'] ? { numeric: q['numeric'] } : {}),
        ...(q['text'] ? { text: q['text'] } : {}),
        options: (q.options ?? []).map((o) => ({
          code: o.code,
          labelAr: o.labelAr,
          labelEn: o.labelEn,
          displayOrder: o.displayOrder,
        })),
      })),
    })),
  };
}

/** Question counts off a customer snapshot's shape (a projection of stored JSON). */
function countServed(snapshot: unknown): { total: number; required: number; codes: string[] } {
  const groups =
    (snapshot as { groups?: { questions?: { code?: unknown; isRequired?: unknown }[] }[] })
      .groups ?? [];
  const questions = groups.flatMap((g) => g.questions ?? []);
  return {
    total: questions.length,
    required: questions.filter((q) => q.isRequired === true).length,
    codes: questions.map((q) => String(q.code)),
  };
}
