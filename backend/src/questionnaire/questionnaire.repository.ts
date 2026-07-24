import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type {
  Question,
  QuestionGroup,
  QuestionOption,
  QuestionnaireVersion,
} from '@prisma/client';
import { PrismaService } from '@/infra/prisma/prisma.service';

/**
 * Questionnaire repository (Constitution Principle X). All Prisma access for the
 * admin-editable GLOBAL question pool + published version snapshots lives here.
 * Feature 010: questions carry no category — there is one global questionnaire.
 */
@Injectable()
export class QuestionnaireRepository {
  constructor(private readonly prisma: PrismaService) {}

  // ---- Groups -------------------------------------------------------------
  groups(): Promise<QuestionGroup[]> {
    return this.prisma.questionGroup.findMany({ orderBy: { displayOrder: 'asc' } });
  }

  groupCodes(): Promise<{ code: string }[]> {
    return this.prisma.questionGroup.findMany({ select: { code: true } });
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

  questions(): Promise<Question[]> {
    return this.prisma.question.findMany({ orderBy: { displayOrder: 'asc' } });
  }

  questionCodes(): Promise<{ code: string }[]> {
    return this.prisma.question.findMany({ select: { code: true } });
  }

  /**
   * All active questions with their active options (code + labels), ordered.
   * Feeds both the admin per-program scoring editor (assign + weight + score) and
   * the `maxPoints` normaliser in the scorer.
   */
  questionsWithOptions(): Promise<
    {
      code: string;
      questionAr: string;
      questionEn: string;
      options: { code: string; labelAr: string; labelEn: string }[];
    }[]
  > {
    return this.prisma.question.findMany({
      where: { isActive: true },
      orderBy: { displayOrder: 'asc' },
      select: {
        code: true,
        questionAr: true,
        questionEn: true,
        options: {
          where: { isActive: true },
          orderBy: { displayOrder: 'asc' },
          select: { code: true, labelAr: true, labelEn: true },
        },
      },
    });
  }

  updateQuestion(id: string, data: Prisma.QuestionUpdateInput): Promise<Question> {
    return this.prisma.question.update({ where: { id }, data });
  }

  /** Active questions whose enabledWhen references the given question code (delete guard). */
  async dependentsOf(questionCode: string): Promise<string[]> {
    const rows = await this.prisma.question.findMany({
      where: {
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
  async optionDependentsOf(questionCode: string, optionCode: string): Promise<string[]> {
    const rows = await this.prisma.question.findMany({
      where: {
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

  // ---- Versions (one global questionnaire) --------------------------------
  activeVersion(): Promise<QuestionnaireVersion | null> {
    return this.prisma.questionnaireVersion.findFirst({ where: { isActive: true } });
  }

  versionById(id: string): Promise<QuestionnaireVersion | null> {
    return this.prisma.questionnaireVersion.findUnique({ where: { id } });
  }

  versionHistory(): Promise<QuestionnaireVersion[]> {
    return this.prisma.questionnaireVersion.findMany({ orderBy: { versionNumber: 'desc' } });
  }

  async nextVersionNumber(): Promise<number> {
    const last = await this.prisma.questionnaireVersion.findFirst({
      orderBy: { versionNumber: 'desc' },
      select: { versionNumber: true },
    });
    return (last?.versionNumber ?? 0) + 1;
  }

  /** Publish atomically: deactivate prior active, insert new active snapshot. */
  publishVersion(args: {
    versionNumber: number;
    snapshot: Prisma.InputJsonValue;
    publishedBy: string;
  }): Promise<QuestionnaireVersion> {
    return this.prisma.$transaction(async (tx) => {
      await tx.questionnaireVersion.updateMany({
        where: { isActive: true },
        data: { isActive: false },
      });
      return tx.questionnaireVersion.create({
        data: {
          versionNumber: args.versionNumber,
          isActive: true,
          publishedAt: new Date(),
          publishedBy: args.publishedBy,
          snapshot: args.snapshot,
        },
      });
    });
  }

  activateExisting(versionId: string): Promise<QuestionnaireVersion> {
    return this.prisma.$transaction(async (tx) => {
      await tx.questionnaireVersion.updateMany({
        where: { isActive: true },
        data: { isActive: false },
      });
      return tx.questionnaireVersion.update({
        where: { id: versionId },
        data: { isActive: true },
      });
    });
  }
}
