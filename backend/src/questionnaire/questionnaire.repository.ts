import { Injectable } from '@nestjs/common';
import { LoanCategory, Prisma } from '@prisma/client';
import type {
  Question,
  QuestionGroup,
  QuestionOption,
  QuestionnaireVersion,
} from '@prisma/client';
import { PrismaService } from '@/infra/prisma/prisma.service';

/**
 * Questionnaire repository (Constitution Principle X). All Prisma access for the
 * admin-editable questionnaire + published version snapshots lives here.
 */
@Injectable()
export class QuestionnaireRepository {
  constructor(private readonly prisma: PrismaService) {}

  // ---- Groups -------------------------------------------------------------
  groupsByCategory(category: LoanCategory): Promise<QuestionGroup[]> {
    return this.prisma.questionGroup.findMany({
      where: { category },
      orderBy: { displayOrder: 'asc' },
    });
  }

  groupCodes(category: LoanCategory): Promise<{ code: string }[]> {
    return this.prisma.questionGroup.findMany({ where: { category }, select: { code: true } });
  }

  createGroup(data: Prisma.QuestionGroupUncheckedCreateInput): Promise<QuestionGroup> {
    return this.prisma.questionGroup.create({ data });
  }

  findGroup(id: string): Promise<QuestionGroup | null> {
    return this.prisma.questionGroup.findUnique({ where: { id } });
  }

  updateGroup(id: string, data: Prisma.QuestionGroupUpdateInput): Promise<QuestionGroup> {
    return this.prisma.questionGroup.update({ where: { id }, data });
  }

  // ---- Questions ----------------------------------------------------------
  createQuestion(data: Prisma.QuestionUncheckedCreateInput): Promise<Question> {
    return this.prisma.question.create({ data });
  }

  findQuestion(id: string): Promise<Question | null> {
    return this.prisma.question.findUnique({ where: { id } });
  }

  questionsByCategory(category: LoanCategory): Promise<Question[]> {
    return this.prisma.question.findMany({
      where: { category },
      orderBy: { displayOrder: 'asc' },
    });
  }

  questionCodes(category: LoanCategory): Promise<{ code: string }[]> {
    return this.prisma.question.findMany({ where: { category }, select: { code: true } });
  }

  updateQuestion(id: string, data: Prisma.QuestionUpdateInput): Promise<Question> {
    return this.prisma.question.update({ where: { id }, data });
  }

  /** Active questions whose enabledWhen references the given question code (delete guard). */
  async dependentsOf(category: LoanCategory, questionCode: string): Promise<string[]> {
    const rows = await this.prisma.question.findMany({
      where: {
        category,
        isActive: true,
        enabledWhen: { path: ['questionCode'], equals: questionCode },
      },
      select: { code: true },
    });
    return rows.map((r) => r.code);
  }

  /**
   * Active questions whose enabledWhen branches on a specific option of a
   * specific question (option delete guard). Matches both questionCode and
   * optionCode so deleting an unreferenced option of a referenced question is
   * still allowed.
   */
  async optionDependentsOf(
    category: LoanCategory,
    questionCode: string,
    optionCode: string,
  ): Promise<string[]> {
    const rows = await this.prisma.question.findMany({
      where: {
        category,
        isActive: true,
        AND: [
          { enabledWhen: { path: ['questionCode'], equals: questionCode } },
          { enabledWhen: { path: ['optionCode'], equals: optionCode } },
        ],
      },
      select: { code: true },
    });
    return rows.map((r) => r.code);
  }

  // ---- Options ------------------------------------------------------------
  createOption(data: Prisma.QuestionOptionUncheckedCreateInput): Promise<QuestionOption> {
    return this.prisma.questionOption.create({ data });
  }

  findOption(id: string): Promise<QuestionOption | null> {
    return this.prisma.questionOption.findUnique({ where: { id } });
  }

  optionsByQuestion(questionId: string): Promise<QuestionOption[]> {
    return this.prisma.questionOption.findMany({
      where: { questionId },
      orderBy: { displayOrder: 'asc' },
    });
  }

  optionCodes(questionId: string): Promise<{ code: string }[]> {
    return this.prisma.questionOption.findMany({ where: { questionId }, select: { code: true } });
  }

  updateOption(id: string, data: Prisma.QuestionOptionUpdateInput): Promise<QuestionOption> {
    return this.prisma.questionOption.update({ where: { id }, data });
  }

  // ---- Versions -----------------------------------------------------------
  activeVersion(category: LoanCategory): Promise<QuestionnaireVersion | null> {
    return this.prisma.questionnaireVersion.findFirst({ where: { category, isActive: true } });
  }

  versionById(id: string): Promise<QuestionnaireVersion | null> {
    return this.prisma.questionnaireVersion.findUnique({ where: { id } });
  }

  versionHistory(category: LoanCategory): Promise<QuestionnaireVersion[]> {
    return this.prisma.questionnaireVersion.findMany({
      where: { category },
      orderBy: { versionNumber: 'desc' },
    });
  }

  async nextVersionNumber(category: LoanCategory): Promise<number> {
    const last = await this.prisma.questionnaireVersion.findFirst({
      where: { category },
      orderBy: { versionNumber: 'desc' },
      select: { versionNumber: true },
    });
    return (last?.versionNumber ?? 0) + 1;
  }

  /** Publish atomically: deactivate prior active, insert new active snapshot. */
  publishVersion(args: {
    category: LoanCategory;
    versionNumber: number;
    snapshot: Prisma.InputJsonValue;
    publishedBy: string;
  }): Promise<QuestionnaireVersion> {
    return this.prisma.$transaction(async (tx) => {
      await tx.questionnaireVersion.updateMany({
        where: { category: args.category, isActive: true },
        data: { isActive: false },
      });
      return tx.questionnaireVersion.create({
        data: {
          category: args.category,
          versionNumber: args.versionNumber,
          isActive: true,
          publishedAt: new Date(),
          publishedBy: args.publishedBy,
          snapshot: args.snapshot,
        },
      });
    });
  }

  activateExisting(category: LoanCategory, versionId: string): Promise<QuestionnaireVersion> {
    return this.prisma.$transaction(async (tx) => {
      await tx.questionnaireVersion.updateMany({
        where: { category, isActive: true },
        data: { isActive: false },
      });
      return tx.questionnaireVersion.update({
        where: { id: versionId },
        data: { isActive: true },
      });
    });
  }
}
