import { Injectable } from '@nestjs/common';
import { LoanCategory, Prisma, QuestionType } from '@prisma/client';
import {
  DomainException,
  MirroredListMinValuesException,
} from '@/common/errors/domain.exceptions';
import { ERROR_CODES } from '@/common/errors/error-codes';
import {
  ALL_LOAN_CATEGORIES,
  dedupeCategories,
  sortCategories,
} from '@/common/loan-category.util';
import {
  DEBT_TYPES_QUESTION_CODE,
  DEBT_TYPE_NONE_OPTION,
  MONEY_FIELD_BINDINGS,
  MONEY_FIELD_BINDING_KEYS,
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
import { QuestionnaireRepository } from './questionnaire.repository';
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
import type {
  CreateGroupDto,
  CreateOptionDto,
  CreateQuestionDto,
  CreateQuestionWithOptionsDto,
  NumericRulesDto,
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
  ) {}

  /**
   * The option codes, category assignments and registry members the surrogate-fact
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

    const assignments = await this.repo.categoryAssignments();
    const categoriesByQuestion = new Map<string, readonly string[]>();
    for (const q of activeQuestions) {
      if (!wanted.has(q.code)) continue;
      categoriesByQuestion.set(q.code, assignments.get(q.id) ?? []);
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
      categoriesByQuestion,
      registryMembers,
    };
  }

  // ---- Public read --------------------------------------------------------
  /**
   * Customer-facing snapshot of the GLOBAL questionnaire, narrowed to the
   * questions assigned to `category` when one is given. Questions/answers are
   * pure content (MVP) — per-program per-answer scores live in
   * `ScoringWeightSet`, never in the snapshot — so this is a shape passthrough
   * with no IP left to strip.
   *
   * `category` is OPTIONAL: a client that does not send one gets the whole pool,
   * which is what every client got before per-category assignment existed. The
   * pool itself stays one canonical list; assignment decides which of its
   * questions a given applicant is asked (A33 as amended).
   */
  async activeSnapshot(category?: LoanCategory): Promise<unknown> {
    const version = await this.repo.activeVersion();
    if (!version) throw new DomainException(ERROR_CODES.QUESTIONNAIRE_NOT_PUBLISHED);
    return toCustomerSnapshot(version.snapshot, category);
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
    const groupId = dto.groupId ?? (await this.resolveDefaultGroupId());
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
      displayOrder,
      enabledWhen: dto.enabledWhen ? (dto.enabledWhen as unknown as Prisma.InputJsonValue) : Prisma.DbNull,
      ...numericColumns(type, dto.numeric ?? null),
      ...textColumns(type, dto.text ?? null),
    });
    // A question with no assignment is asked for nothing, so a create that named
    // no categories would add an invisible row. Default to ALL FOUR: the admin
    // adds questions on one tab and narrows them on the other, never the reverse.
    await this.repo.setCategories(created.id, dto.categories ?? ALL_LOAN_CATEGORIES);
    await this.publish(actor);
    return { ...created, categories: dto.categories ?? [...ALL_LOAN_CATEGORIES] };
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
  async createQuestionWithOptions(dto: CreateQuestionWithOptionsDto, actor: string) {
    const groupId = dto.groupId ?? (await this.resolveDefaultGroupId());
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
        return { code: optionCode, labelAr: o.labelAr, labelEn: o.labelEn };
      });

    // Same default as `createQuestion`: a question assigned to nothing is asked
    // by nobody, so an omitted set means all four rather than none.
    const categories = dedupeCategories(dto.categories ?? [...ALL_LOAN_CATEGORIES]);

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
        displayOrder,
        enabledWhen: dto.enabledWhen
          ? (dto.enabledWhen as unknown as Prisma.InputJsonValue)
          : Prisma.DbNull,
        ...numericColumns(type, dto.numeric ?? null),
        ...textColumns(type, dto.text ?? null),
      },
      optionRows,
      categories,
    );
    if (mirroredType !== null) {
      // AFTER the question exists, because the link needs its id. A failure here leaves a
      // live question whose options are already right and a list that will not re-sync —
      // recoverable by pointing the list at the question again, which is what the product
      // screen offers.
      await this.enums.updateTypeDefinition(mirroredType, { mirrorQuestionId: created.id });
    }
    await this.publish(actor);
    return {
      ...created,
      categories,
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
  async syncMirroredOptions(typeKey: string, actor: string): Promise<boolean> {
    const defs = await this.enums.typeDefinitions();
    const questionId = defs.get(typeKey)?.mirrorQuestionId ?? null;
    if (questionId === null) return false;

    const rows = await this.mirroredOptionRows(typeKey);
    const changed = await this.repo.syncMirroredOptions(questionId, rows);
    // A publish that changes nothing is still a new ACTIVE version, and version history is
    // how an operator reads what they did. Skipped when nothing moved.
    if (changed) await this.publish(actor);
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

  // ---- Loan-category assignment -------------------------------------------
  /**
   * Replace which loan categories a question is asked for. The submitted set is
   * authoritative and MAY be empty — an empty set parks the question (kept, with
   * its wording and options, but asked for nothing), which is the non-destructive
   * alternative to deleting it. The admin tab flags those rows.
   */
  async setQuestionCategories(id: string, categories: LoanCategory[], actor: string) {
    const question = await this.repo.findQuestion(id);
    if (!question) throw new DomainException(ERROR_CODES.QUESTION_NOT_FOUND);
    const unique = dedupeCategories(categories);
    await this.repo.setCategories(id, unique);
    await this.publish(actor);
    return { ...question, categories: unique };
  }

  /**
   * Replace the assignment of MANY questions in one transaction + one publish.
   * The column actions ("assign every question to mortgage", "clear car") would
   * otherwise fire one publish per row and churn a version per question.
   */
  async setQuestionCategoriesBulk(
    assignments: ReadonlyArray<{ questionId: string; categories: LoanCategory[] }>,
    actor: string,
  ) {
    const known = new Set((await this.repo.questions()).map((q) => q.id));
    for (const a of assignments) {
      if (!known.has(a.questionId)) {
        throw new DomainException(ERROR_CODES.QUESTION_NOT_FOUND, { questionId: a.questionId });
      }
    }
    await this.repo.setCategoriesBulk(
      assignments.map((a) => ({
        questionId: a.questionId,
        categories: dedupeCategories(a.categories),
      })),
    );
    await this.publish(actor);
    return this.draftTree();
  }

  async updateQuestion(id: string, dto: UpdateQuestionDto, actor: string) {
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
    const data: Prisma.QuestionUpdateInput = {
      questionAr: dto.questionAr,
      questionEn: dto.questionEn,
      helperTextAr: dto.helperTextAr,
      helperTextEn: dto.helperTextEn,
      isRequired: dto.isRequired,
      displayOrder: dto.displayOrder,
      isActive: dto.isActive,
    };
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
    // `code` is immutable post-creation (A33).
    const updated = await this.repo.updateQuestion(id, data);
    await this.publish(actor);
    return updated;
  }

  async softDeleteQuestion(id: string, actor: string) {
    const question = await this.repo.findQuestion(id);
    if (!question) throw new DomainException(ERROR_CODES.QUESTION_NOT_FOUND);
    const dependents = await this.repo.dependentsOf(question.code);
    const others = dependents.filter((c) => c !== question.code);
    if (others.length > 0) {
      throw new DomainException(ERROR_CODES.QUESTION_IN_USE, { dependents: others });
    }
    const deleted = await this.repo.updateQuestion(id, { isActive: false });
    await this.publish(actor);
    return deleted;
  }

  listQuestions() {
    return this.repo.questions();
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
    const existing = new Set((await this.repo.optionCodes(questionId)).map((o) => o.code));
    const code = uniqueSlug(dto.labelEn, existing);
    const created = await this.repo.createOption({
      questionId,
      code,
      labelAr: dto.labelAr,
      labelEn: dto.labelEn,
      // Same reason as questions: the flat editor appends options instead of
      // asking the admin to type an order, and 0 would front-load every new one.
      displayOrder: dto.displayOrder ?? (await this.repo.maxOptionOrder(questionId)) + 1,
    });
    await this.publish(actor);
    return created;
  }

  async updateOption(id: string, dto: UpdateOptionDto, actor: string) {
    const option = await this.repo.findOption(id);
    if (!option) throw new DomainException(ERROR_CODES.QUESTION_OPTION_NOT_FOUND);
    const question = await this.repo.findQuestion(option.questionId);
    if (!question) throw new DomainException(ERROR_CODES.QUESTION_NOT_FOUND);
    // Deactivating an option must honour the same branch guard as delete (A33).
    if (dto.isActive === false && option.isActive) {
      const dependents = await this.repo.optionDependentsOf(question.code, option.code);
      if (dependents.length > 0) {
        throw new DomainException(ERROR_CODES.QUESTION_OPTION_IN_USE, { dependents });
      }
    }
    const updated = await this.repo.updateOption(id, {
      labelAr: dto.labelAr,
      labelEn: dto.labelEn,
      displayOrder: dto.displayOrder,
      isActive: dto.isActive,
    });
    await this.publish(actor);
    return updated;
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
   * Publish NEVER fails on a missing money-field binding — it returns a warning
   * (FR-049), because blocking publish would leave the admin unable to ship any
   * questionnaire while a binding is being renamed.
   */
  async publish(publishedBy: string): Promise<PublishResult> {
    const groups = (await this.repo.groups()).filter((g) => g.isActive);
    const questions = (await this.repo.questions()).filter((q) => q.isActive);
    // Frozen INTO the snapshot: the customer read filters on it, so a later
    // reassignment must not retroactively change what an older version asked.
    const assignments = await this.repo.categoryAssignments();

    const snapshotGroups = [];
    for (const g of groups) {
      const gQuestions = questions.filter((q) => q.groupId === g.id);
      const qOut = [];
      for (const q of gQuestions) {
        const options = (await this.repo.optionsByQuestion(q.id)).filter((o) => o.isActive);
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
          categories: sortCategories(assignments.get(q.id) ?? []),
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
    const assignments = await this.repo.categoryAssignments();
    const result = [];
    for (const g of groups) {
      const gQuestions = [];
      for (const q of questions.filter((qq) => qq.groupId === g.id)) {
        const options = (await this.repo.optionsByQuestion(q.id)).filter((o) => o.isActive);
        // `categories` rides along on the tree rather than on its own endpoint:
        // the assign tab and the pool tab render the same rows, so a second fetch
        // would only give the two tabs two ways to disagree.
        gQuestions.push({ ...q, options, categories: sortCategories(assignments.get(q.id) ?? []) });
      }
      result.push({ ...g, questions: gQuestions });
    }
    return result;
  }

  history() {
    return this.repo.versionHistory();
  }

  async rollback(versionId: string) {
    const version = await this.repo.versionById(versionId);
    if (!version) {
      throw new DomainException(ERROR_CODES.QUESTIONNAIRE_NOT_PUBLISHED);
    }
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
   * scorer and the admin answer views keep working unchanged (FR-045).
   *
   * `category` narrows the pool to the questions actually ASKED for this
   * application's loan category. It has to: required-question enforcement runs
   * here, so without the filter a personal-loan applicant would be rejected for
   * not answering a mortgage-only question they were never shown.
   *
   * Returns that asked set alongside the resolved rows. It is the scoring
   * denominator (Constitution V, v13.0.0) and cannot be recovered from
   * `resolved` afterwards: a skipped optional question is asked but produces no
   * row (`validateAnswer` returns null), and it must still cost the applicant
   * its weight. Non-scoreable codes are left in — a weight set can only name
   * SINGLE_SELECT questions, so the scorer's intersection drops them anyway.
   */
  async resolveAnswers(
    answers: ReadonlyArray<SubmittedAnswerValue>,
    category?: LoanCategory,
  ): Promise<{ resolved: ResolvedAnswer[]; askedQuestionCodes: string[] }> {
    const questions = await this.repo.questions();
    const assignments = category ? await this.repo.categoryAssignments() : null;
    const active = questions.filter(
      (q) =>
        q.isActive &&
        (assignments === null || (assignments.get(q.id) ?? []).includes(category as LoanCategory)),
    );
    const byCode = new Map(active.map((q) => [q.code, q]));
    const submitted = new Map(answers.map((a) => [a.questionCode, a]));

    // Unknown codes fail before anything else: a stale client must be told. A
    // code that exists in the pool but is not asked for this category counts as
    // unknown here — accepting it would store an answer to a question this
    // applicant was never shown.
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
      const options = optionsByQuestionId.get(q.id) ?? [];
      const visible = isQuestionVisible(q, submitted, byCode);
      const answer = submitted.get(q.code);

      if (!visible) {
        // Hidden questions are neither required nor stored — and never scored,
        // so they stay out of the denominator too.
        continue;
      }
      // Asked = active, in-category, and visible. Recorded BEFORE validation so
      // a skipped optional question still counts against the applicant.
      askedQuestionCodes.push(q.code);

      const normalised = validateAnswer(
        {
          code: q.code,
          type: q.type,
          isRequired: q.isRequired,
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
    source: { versionId: string | null; category: string },
    answers: ReadonlyArray<ApplicantAnswerInput>,
  ): Promise<ApplicantQuestionnaireView | null> {
    // Prefer the exact submit-time snapshot; fall back to the active published
    // version when the application did not record a version id (the codes on the
    // answer rows are stable across versions).
    const version = source.versionId
      ? await this.repo.versionById(source.versionId)
      : await this.repo.activeVersion();
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
  private async assertEnabledWhenValid(
    selfOrder: number,
    rule: { questionCode: string; operator: string; optionCode: string },
  ): Promise<void> {
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
    if (!options.some((o) => o.code === rule.optionCode)) {
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

export function numericRulesOf(
  q: QuestionRuleColumns,
): { minValue: string | null; maxValue: string | null; step: string | null; unitAr: string | null; unitEn: string | null } | null {
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

/** Only the owning type keeps its rule columns; everything else is nulled out. */
function numericColumns(
  type: QuestionType,
  numeric: NumericRulesDto | { minValue?: string | null; maxValue?: string | null; step?: string | null; unitAr?: string | null; unitEn?: string | null } | null,
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
  for (const binding of MONEY_FIELD_BINDING_KEYS) {
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
 * ar and en. The category assignment matters because assignment is authoritative
 * (v12.0.0): a question assigned to nothing is asked by nobody, however correctly it
 * is otherwise configured.
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
  /** Categories each question is assigned to, per `question_loan_category`. */
  readonly categoriesByQuestion: ReadonlyMap<string, readonly string[]>;
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
 * The assignment check asks only whether the fact is asked by ANY category. It used to
 * be a set difference against a hardcoded surrogate-capable list, which is wrong now
 * that capability is derived from these very assignments (v16.0.0): a fact absent from
 * `mortgage` is a category that does not sell no-payslip mortgages, not a defect, and
 * warning about it would make the correct configuration noisy. A fact assigned to
 * NOTHING is still a real break — no program anywhere can read it — so that one stands.
 *
 * The per-category question moved to where it can be answered precisely and acted on: the
 * admin bank-program form tells the operator, as they pick the method, whether their own
 * loan category asks the fact that method reads. Publish knows nothing about which
 * programs exist, so it could only ever have guessed.
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
      // Keep going: a wrong-typed question can also be unassigned, and an admin
      // fixing one only to find the other on the next publish is a wasted round.
    }

    const categories = ctx.categoriesByQuestion.get(questionCode);
    // ABSENT and EMPTY differ. Absent means this caller does not know the
    // assignments (nothing to say); an EMPTY array means the question is assigned to
    // nothing, which is authoritative for "asked by nobody".
    if (categories !== undefined && categories.length === 0) {
      warnings.push({
        code: ERROR_CODES.SURROGATE_FACT_BINDING_MISSING,
        meta: {
          fact,
          questionCode,
          reason: 'not_asked_by_any_category' satisfies SurrogateBindingWarningReason,
          assignedCategories: [],
        },
      });
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
  const fraction = rawFraction && /[1-9]/.test(rawFraction) ? `.${rawFraction.replace(/0+$/, '')}` : '';
  return `${negative ? '-' : ''}${grouped}${fraction}`;
}

/**
 * Is a snapshot question asked for `category`? A snapshot published BEFORE
 * per-category assignment existed carries no `categories` key at all — those
 * questions were asked of everyone, so a missing key reads as "all categories"
 * rather than "none" (the same backward-compatibility posture as the missing
 * `type` key below). An explicitly EMPTY array means parked: asked for nothing.
 */
function askedFor(q: StoredQuestion, category: LoanCategory | undefined): boolean {
  if (category === undefined) return true;
  const raw = q['categories'];
  if (!Array.isArray(raw)) return true;
  return raw.includes(category);
}

/**
 * Project the stored snapshot into the customer payload, keeping only the
 * questions assigned to `category` (all of them when it is undefined). Questions
 * and answers are pure content (MVP) so the rest is a shape passthrough — no IP
 * fields to strip. A group left with no questions is dropped: the mobile wizard
 * renders one step per group, so an empty one is a blank screen with a live Next
 * button.
 */
function toCustomerSnapshot(raw: unknown, category?: LoanCategory): unknown {
  const snap = raw as StoredSnapshot;
  const groups = (snap.groups ?? [])
    .map((g) => ({ ...g, questions: (g.questions ?? []).filter((q) => askedFor(q, category)) }))
    .filter((g) => g.questions.length > 0);
  return {
    versionNumber: snap.versionNumber,
    groups: groups.map((g) => ({
      code: g.code,
      titleAr: g.titleAr,
      titleEn: g.titleEn,
      displayOrder: g.displayOrder,
      questions: g.questions.map((q) => ({
        code: q.code,
        // A snapshot published before feature 010 has no `type` — it reads as
        // single choice, which is exactly what it was (FR-045).
        type: resolveQuestionType(q['type'] as string | null | undefined),
        questionAr: q['questionAr'],
        questionEn: q['questionEn'],
        helperTextAr: q['helperTextAr'],
        helperTextEn: q['helperTextEn'],
        isRequired: q['isRequired'],
        displayOrder: q['displayOrder'],
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
