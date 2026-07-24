import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { DomainException } from '@/common/errors/domain.exceptions';
import { ERROR_CODES } from '@/common/errors/error-codes';
import { QuestionnaireRepository } from './questionnaire.repository';
import { uniqueSlug } from './slug.util';
import type {
  CreateGroupDto,
  CreateOptionDto,
  CreateQuestionDto,
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
    const existing = new Set((await this.repo.questionCodes()).map((q) => q.code));
    const code = uniqueSlug(dto.questionEn, existing);
    const created = await this.repo.createQuestion({
      groupId: dto.groupId,
      code,
      type: dto.type ?? 'SINGLE_SELECT',
      questionAr: dto.questionAr,
      questionEn: dto.questionEn,
      helperTextAr: dto.helperTextAr ?? null,
      helperTextEn: dto.helperTextEn ?? null,
      isRequired: dto.isRequired ?? true,
      displayOrder: dto.displayOrder,
      enabledWhen: dto.enabledWhen ? (dto.enabledWhen as unknown as Prisma.InputJsonValue) : Prisma.DbNull,
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
    const data: Prisma.QuestionUpdateInput = {
      questionAr: dto.questionAr,
      questionEn: dto.questionEn,
      helperTextAr: dto.helperTextAr,
      helperTextEn: dto.helperTextEn,
      isRequired: dto.isRequired,
      displayOrder: dto.displayOrder,
      isActive: dto.isActive,
    };
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
  async publish(publishedBy: string) {
    const groups = (await this.repo.groups()).filter((g) => g.isActive);
    const questions = (await this.repo.questions()).filter((q) => q.isActive);

    const snapshotGroups = [];
    for (const g of groups) {
      const gQuestions = questions.filter((q) => q.groupId === g.id);
      const qOut = [];
      for (const q of gQuestions) {
        const options = (await this.repo.optionsByQuestion(q.id)).filter((o) => o.isActive);
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
          options: options.map((o) => ({
            code: o.code,
            labelAr: o.labelAr,
            labelEn: o.labelEn,
            displayOrder: o.displayOrder,
          })),
        });
      }
      snapshotGroups.push({
        code: g.code,
        titleAr: g.titleAr,
        titleEn: g.titleEn,
        displayOrder: g.displayOrder,
        questions: qOut,
      });
    }

    const versionNumber = await this.repo.nextVersionNumber();
    const snapshot = { versionNumber, groups: snapshotGroups };
    return this.repo.publishVersion({
      versionNumber,
      snapshot: snapshot as unknown as Prisma.InputJsonValue,
      publishedBy,
    });
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
   * resolve stable ids for persistence as `application_answer` rows. Throws
   * UNKNOWN_QUESTION_CODE / UNKNOWN_OPTION_CODE. Used by the apply transaction.
   */
  async resolveAnswers(
    answers: ReadonlyArray<{ questionCode: string; optionCode: string }>,
  ): Promise<
    Array<{
      questionId: string;
      questionCode: string;
      selectedOptionId: string;
      selectedOptionCode: string;
    }>
  > {
    const questions = await this.repo.questions();
    const byCode = new Map(questions.map((q) => [q.code, q]));
    const resolved = [];
    for (const a of answers) {
      const q = byCode.get(a.questionCode);
      if (!q) throw new DomainException(ERROR_CODES.UNKNOWN_QUESTION_CODE, { code: a.questionCode });
      const options = await this.repo.optionsByQuestion(q.id);
      const opt = options.find((o) => o.code === a.optionCode);
      if (!opt) throw new DomainException(ERROR_CODES.UNKNOWN_OPTION_CODE, { code: a.optionCode });
      resolved.push({
        questionId: q.id,
        questionCode: q.code,
        selectedOptionId: opt.id,
        selectedOptionCode: opt.code,
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
    const options = await this.repo.optionsByQuestion(ref.id);
    if (!options.some((o) => o.code === rule.optionCode)) {
      throw new DomainException(ERROR_CODES.ENABLED_WHEN_INVALID, { reason: 'unknown_option' });
    }
  }
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
        type: q['type'],
        questionAr: q['questionAr'],
        questionEn: q['questionEn'],
        helperTextAr: q['helperTextAr'],
        helperTextEn: q['helperTextEn'],
        isRequired: q['isRequired'],
        displayOrder: q['displayOrder'],
        enabledWhen: q['enabledWhen'] ?? null,
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
