import { Injectable } from '@nestjs/common';
import { Prisma, QuestionType } from '@prisma/client';
import { DomainException } from '@/common/errors/domain.exceptions';
import { ERROR_CODES } from '@/common/errors/error-codes';
import {
  MONEY_FIELD_BINDINGS,
  MONEY_FIELD_BINDING_KEYS,
} from '@/matching/pipeline/money-field-bindings';
import { QuestionnaireRepository } from './questionnaire.repository';
import { uniqueSlug } from './slug.util';
import {
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
import type {
  CreateGroupDto,
  CreateOptionDto,
  CreateQuestionDto,
  NumericRulesDto,
  TextRulesDto,
  UpdateGroupDto,
  UpdateOptionDto,
  UpdateQuestionDto,
} from './dto/questionnaire.dto';

@Injectable()
export class QuestionnaireService {
  constructor(private readonly repo: QuestionnaireRepository) {}

  // ---- Public read --------------------------------------------------------
  /**
   * Customer-facing snapshot of the single GLOBAL questionnaire. Questions/answers
   * are pure content (MVP) — per-program per-answer scores live in
   * `ScoringWeightSet`, never in the snapshot — so this is a shape passthrough
   * with no IP left to strip. The chosen loan category only filters which
   * programs get matched; every applicant answers the same questionnaire.
   */
  async activeSnapshot(): Promise<unknown> {
    const version = await this.repo.activeVersion();
    if (!version) throw new DomainException(ERROR_CODES.QUESTIONNAIRE_NOT_PUBLISHED);
    return toCustomerSnapshot(version.snapshot);
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

  // ---- Questions ----------------------------------------------------------
  async createQuestion(dto: CreateQuestionDto, actor: string) {
    const group = await this.repo.findGroup(dto.groupId);
    if (!group) {
      throw new DomainException(ERROR_CODES.QUESTION_GROUP_NOT_FOUND);
    }
    if (dto.enabledWhen) {
      await this.assertEnabledWhenValid(dto.displayOrder, dto.enabledWhen);
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
      groupId: dto.groupId,
      code,
      type,
      questionAr: dto.questionAr,
      questionEn: dto.questionEn,
      helperTextAr: dto.helperTextAr ?? null,
      helperTextEn: dto.helperTextEn ?? null,
      isRequired: dto.isRequired ?? true,
      displayOrder: dto.displayOrder,
      enabledWhen: dto.enabledWhen ? (dto.enabledWhen as unknown as Prisma.InputJsonValue) : Prisma.DbNull,
      ...numericColumns(type, dto.numeric ?? null),
      ...textColumns(type, dto.text ?? null),
    });
    await this.publish(actor);
    return created;
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
      displayOrder: dto.displayOrder,
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

    const warnings = collectPublishWarnings(questions);

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
    return collectPublishWarnings(active);
  }

  /**
   * Editable working tree for the admin editor + preview. Only ACTIVE nodes are
   * returned — soft-deleted groups/questions/options are excluded so a delete
   * visibly removes the row, consistent with what `publish` snapshots.
   */
  async draftTree() {
    const groups = (await this.repo.groups()).filter((g) => g.isActive);
    const questions = (await this.repo.questions()).filter((q) => q.isActive);
    const result = [];
    for (const g of groups) {
      const gQuestions = [];
      for (const q of questions.filter((qq) => qq.groupId === g.id)) {
        const options = (await this.repo.optionsByQuestion(q.id)).filter((o) => o.isActive);
        gQuestions.push({ ...q, options });
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
   */
  async resolveAnswers(
    answers: ReadonlyArray<SubmittedAnswerValue>,
  ): Promise<ResolvedAnswer[]> {
    const questions = await this.repo.questions();
    const active = questions.filter((q) => q.isActive);
    const byCode = new Map(active.map((q) => [q.code, q]));
    const submitted = new Map(answers.map((a) => [a.questionCode, a]));

    // Unknown codes fail before anything else: a stale client must be told.
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
    for (const q of active) {
      const options = optionsByQuestionId.get(q.id) ?? [];
      const visible = isQuestionVisible(q, submitted, byCode);
      const answer = submitted.get(q.code);

      if (!visible) {
        // Hidden questions are neither required nor stored.
        continue;
      }

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
    return resolved;
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
    answers: ReadonlyArray<{ questionCode: string; selectedOptionCode: string | null }>,
  ): Promise<ApplicantQuestionnaireView | null> {
    // Prefer the exact submit-time snapshot; fall back to the active published
    // version when the application did not record a version id (the codes on the
    // answer rows are stable across versions).
    const version = source.versionId
      ? await this.repo.versionById(source.versionId)
      : await this.repo.activeVersion();
    if (!version) return null;
    const snap = version.snapshot as unknown as StoredSnapshot;
    const picked = new Map(answers.map((a) => [a.questionCode, a.selectedOptionCode]));

    const orderOf = (x: unknown): number =>
      Number((x as Record<string, unknown>)['displayOrder'] ?? 0);

    const groups: ApplicantAnswerGroup[] = [];
    for (const g of [...(snap.groups ?? [])].sort((a, b) => orderOf(a) - orderOf(b))) {
      const items: ApplicantAnswerItem[] = [];
      for (const q of [...(g.questions ?? [])].sort((a, b) => orderOf(a) - orderOf(b))) {
        if (!picked.has(q.code)) continue;
        const optCode = picked.get(q.code) ?? null;
        const opt = optCode ? (q.options ?? []).find((o) => o.code === optCode) : undefined;
        items.push({
          questionCode: q.code,
          questionAr: String(q['questionAr'] ?? q.code),
          questionEn: String(q['questionEn'] ?? q.code),
          answerAr: opt ? opt.labelAr : null,
          answerEn: opt ? opt.labelEn : null,
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
function isQuestionVisible(
  q: { enabledWhen: Prisma.JsonValue | null },
  submitted: ReadonlyMap<string, SubmittedAnswerValue>,
  byCode: ReadonlyMap<string, unknown>,
): boolean {
  const rule = q.enabledWhen as { questionCode?: string; operator?: string; optionCode?: string } | null;
  if (!rule?.questionCode || !rule.optionCode) return true;
  if (!byCode.has(rule.questionCode)) return true; // dangling rule: never hide

  const source = submitted.get(rule.questionCode);
  const picked = source
    ? [...(source.optionCodes ?? []), ...(source.optionCode ? [source.optionCode] : [])]
    : [];
  const matches = picked.includes(rule.optionCode);
  return rule.operator === 'not_equals' ? !matches : matches;
}

/**
 * FR-048 / FR-049: every money-field binding must resolve to an ACTIVE NUMERIC
 * question. A miss is a warning, not a publish failure — but a quote for an
 * affected applicant then fails with `MONEY_FIGURE_MISSING` rather than being
 * silently defaulted to zero (FR-044).
 */
function collectPublishWarnings(
  activeQuestions: ReadonlyArray<{ code: string; type: QuestionType }>,
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
 * Project the stored snapshot into the customer payload. Questions/answers are
 * pure content (MVP) so this is a shape passthrough — no IP fields to strip.
 */
function toCustomerSnapshot(raw: unknown): unknown {
  const snap = raw as StoredSnapshot;
  return {
    versionNumber: snap.versionNumber,
    groups: (snap.groups ?? []).map((g) => ({
      code: g.code,
      titleAr: g.titleAr,
      titleEn: g.titleEn,
      displayOrder: g.displayOrder,
      questions: (g.questions ?? []).map((q) => ({
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
