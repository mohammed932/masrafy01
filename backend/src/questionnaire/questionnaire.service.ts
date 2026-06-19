import { Injectable } from '@nestjs/common';
import { LoanCategory, Prisma } from '@prisma/client';
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
   * Customer-facing snapshot. Questions/answers are now pure content (MVP) — the
   * per-program per-answer points live in `ScoringWeightSet`, never in the
   * snapshot — so this is a shape passthrough with no IP left to strip.
   */
  async activeSnapshot(category: LoanCategory): Promise<unknown> {
    const version = await this.repo.activeVersion(category);
    if (!version) throw new DomainException(ERROR_CODES.QUESTIONNAIRE_NOT_PUBLISHED);
    return toCustomerSnapshot(version.snapshot);
  }

  // ---- Groups -------------------------------------------------------------
  async createGroup(dto: CreateGroupDto, actor: string) {
    const existing = new Set((await this.repo.groupCodes(dto.category)).map((g) => g.code));
    const code = uniqueSlug(dto.titleEn, existing);
    const created = await this.repo.createGroup({
      category: dto.category,
      code,
      titleAr: dto.titleAr,
      titleEn: dto.titleEn,
      displayOrder: dto.displayOrder,
    });
    await this.publish(dto.category, actor);
    return created;
  }

  async updateGroup(id: string, dto: UpdateGroupDto, actor: string) {
    const group = await this.repo.findGroup(id);
    if (!group) throw new DomainException(ERROR_CODES.QUESTION_GROUP_NOT_FOUND);
    // Deactivating a group is a delete in effect — block while it holds questions.
    if (dto.isActive === false && group.isActive) {
      const active = (await this.repo.questionsByCategory(group.category)).filter(
        (q) => q.groupId === id && q.isActive,
      );
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
    await this.publish(group.category, actor);
    return updated;
  }

  /** Soft-delete a group; blocked while it still holds active questions. */
  async softDeleteGroup(id: string, actor: string) {
    const group = await this.repo.findGroup(id);
    if (!group) throw new DomainException(ERROR_CODES.QUESTION_GROUP_NOT_FOUND);
    const questions = await this.repo.questionsByCategory(group.category);
    const active = questions.filter((q) => q.groupId === id && q.isActive);
    if (active.length > 0) {
      throw new DomainException(ERROR_CODES.QUESTION_GROUP_NOT_EMPTY, {
        questionCount: active.length,
      });
    }
    const deleted = await this.repo.updateGroup(id, { isActive: false });
    await this.publish(group.category, actor);
    return deleted;
  }

  listGroups(category: LoanCategory) {
    return this.repo.groupsByCategory(category);
  }

  // ---- Questions ----------------------------------------------------------
  async createQuestion(dto: CreateQuestionDto, actor: string) {
    const group = await this.repo.findGroup(dto.groupId);
    if (!group || group.category !== dto.category) {
      throw new DomainException(ERROR_CODES.QUESTION_GROUP_NOT_FOUND);
    }
    if (dto.enabledWhen) {
      await this.assertEnabledWhenValid(dto.category, dto.displayOrder, dto.enabledWhen);
    }
    const existing = new Set((await this.repo.questionCodes(dto.category)).map((q) => q.code));
    const code = uniqueSlug(dto.questionEn, existing);
    const created = await this.repo.createQuestion({
      groupId: dto.groupId,
      category: dto.category,
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
    await this.publish(dto.category, actor);
    return created;
  }

  async updateQuestion(id: string, dto: UpdateQuestionDto, actor: string) {
    const question = await this.repo.findQuestion(id);
    if (!question) throw new DomainException(ERROR_CODES.QUESTION_NOT_FOUND);
    if (dto.enabledWhen) {
      await this.assertEnabledWhenValid(
        question.category,
        dto.displayOrder ?? question.displayOrder,
        dto.enabledWhen,
      );
    }
    // Deactivation must honour the same branch-integrity guard as delete (A33).
    if (dto.isActive === false && question.isActive) {
      const dependents = (await this.repo.dependentsOf(question.category, question.code)).filter(
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
    // `code` and `category` are immutable post-creation (A33).
    const updated = await this.repo.updateQuestion(id, data);
    await this.publish(question.category, actor);
    return updated;
  }

  async softDeleteQuestion(id: string, actor: string) {
    const question = await this.repo.findQuestion(id);
    if (!question) throw new DomainException(ERROR_CODES.QUESTION_NOT_FOUND);
    const dependents = await this.repo.dependentsOf(question.category, question.code);
    const others = dependents.filter((c) => c !== question.code);
    if (others.length > 0) {
      throw new DomainException(ERROR_CODES.QUESTION_IN_USE, { dependents: others });
    }
    const deleted = await this.repo.updateQuestion(id, { isActive: false });
    await this.publish(question.category, actor);
    return deleted;
  }

  listQuestions(category: LoanCategory) {
    return this.repo.questionsByCategory(category);
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
    await this.publish(question.category, actor);
    return created;
  }

  async updateOption(id: string, dto: UpdateOptionDto, actor: string) {
    const option = await this.repo.findOption(id);
    if (!option) throw new DomainException(ERROR_CODES.QUESTION_OPTION_NOT_FOUND);
    const question = await this.repo.findQuestion(option.questionId);
    if (!question) throw new DomainException(ERROR_CODES.QUESTION_NOT_FOUND);
    // Deactivating an option must honour the same branch guard as delete (A33).
    if (dto.isActive === false && option.isActive) {
      const dependents = await this.repo.optionDependentsOf(
        question.category,
        question.code,
        option.code,
      );
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
    await this.publish(question.category, actor);
    return updated;
  }

  /** Soft-delete an option; blocked while a branch (enabledWhen) references it. */
  async softDeleteOption(id: string, actor: string) {
    const option = await this.repo.findOption(id);
    if (!option) throw new DomainException(ERROR_CODES.QUESTION_OPTION_NOT_FOUND);
    const question = await this.repo.findQuestion(option.questionId);
    if (!question) throw new DomainException(ERROR_CODES.QUESTION_NOT_FOUND);
    const dependents = await this.repo.optionDependentsOf(
      question.category,
      question.code,
      option.code,
    );
    if (dependents.length > 0) {
      throw new DomainException(ERROR_CODES.QUESTION_OPTION_IN_USE, { dependents });
    }
    const deleted = await this.repo.updateOption(id, { isActive: false });
    await this.publish(question.category, actor);
    return deleted;
  }

  listOptions(questionId: string) {
    return this.repo.optionsByQuestion(questionId);
  }

  // ---- Versioning ---------------------------------------------------------
  async publish(category: LoanCategory, publishedBy: string) {
    const groups = (await this.repo.groupsByCategory(category)).filter((g) => g.isActive);
    const questions = (await this.repo.questionsByCategory(category)).filter((q) => q.isActive);

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

    const versionNumber = await this.repo.nextVersionNumber(category);
    const snapshot = { category, versionNumber, groups: snapshotGroups };
    return this.repo.publishVersion({
      category,
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
  async draftTree(category: LoanCategory) {
    const groups = (await this.repo.groupsByCategory(category)).filter((g) => g.isActive);
    const questions = (await this.repo.questionsByCategory(category)).filter((q) => q.isActive);
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

  history(category: LoanCategory) {
    return this.repo.versionHistory(category);
  }

  async rollback(category: LoanCategory, versionId: string) {
    const version = await this.repo.versionById(versionId);
    if (!version || version.category !== category) {
      throw new DomainException(ERROR_CODES.QUESTIONNAIRE_NOT_PUBLISHED);
    }
    return this.repo.activateExisting(category, versionId);
  }

  /**
   * Validate submitted answers against the LIVE questions/options for a category
   * and resolve stable ids for persistence as `application_answer` rows. Throws
   * UNKNOWN_QUESTION_CODE / UNKNOWN_OPTION_CODE. Used by the apply transaction.
   */
  async resolveAnswers(
    category: LoanCategory,
    answers: ReadonlyArray<{ questionCode: string; optionCode: string }>,
  ): Promise<
    Array<{
      questionId: string;
      questionCode: string;
      selectedOptionId: string;
      selectedOptionCode: string;
    }>
  > {
    const questions = await this.repo.questionsByCategory(category);
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

  // ---- Internals ----------------------------------------------------------
  private async assertEnabledWhenValid(
    category: LoanCategory,
    selfOrder: number,
    rule: { questionCode: string; operator: string; optionCode: string },
  ): Promise<void> {
    const questions = await this.repo.questionsByCategory(category);
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
  category?: unknown;
  versionNumber?: unknown;
  groups?: StoredGroup[];
}

/**
 * Project the stored snapshot into the customer payload. Questions/answers are
 * pure content (MVP) so this is a shape passthrough — no IP fields to strip.
 */
function toCustomerSnapshot(raw: unknown): unknown {
  const snap = raw as StoredSnapshot;
  return {
    category: snap.category,
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
