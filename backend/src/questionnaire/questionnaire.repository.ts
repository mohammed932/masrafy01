import { Injectable } from '@nestjs/common';
import {
  mirroredOptionPlan,
  planIsEmpty,
  type MirroredValue,
} from './mirrored-options';
import { Prisma } from '@prisma/client';
import type {
  LoanCategory,
  Question,
  QuestionGroup,
  QuestionOption,
  QuestionType,
  QuestionnaireVersion,
} from '@prisma/client';
import { PrismaService } from '@/infra/prisma/prisma.service';

/**
 * Rows per `UPDATE ... FROM (VALUES ...)` statement in the mirrored-option sync.
 *
 * Postgres caps bound parameters at 65 535 and this binds four per row, so the real ceiling
 * is ~16 000. A thousand keeps the statement readable in a slow-query log and still turns any
 * realistic list into one or two round trips.
 */
const MIRRORED_UPDATE_CHUNK = 1000;

/**
 * How many published versions the history endpoint returns.
 *
 * A bound rather than pagination: nothing pages this list and nobody scrolls a publication
 * history past the recent past. If a screen ever needs the tail, that is a cursor, not a
 * bigger number.
 */
const VERSION_HISTORY_LIMIT = 50;

/** The version list without its snapshots — what `versionHistory` serves. See its doc. */
export type QuestionnaireVersionSummary = Pick<
  QuestionnaireVersion,
  'id' | 'versionNumber' | 'isActive' | 'publishedAt' | 'publishedBy' | 'createdAt'
>;

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

  findGroupByCode(code: string): Promise<QuestionGroup | null> {
    return this.prisma.questionGroup.findUnique({ where: { code } });
  }

  /** Lowest-order active group — where a flat client's new question lands. */
  firstActiveGroup(): Promise<QuestionGroup | null> {
    return this.prisma.questionGroup.findFirst({
      where: { isActive: true },
      orderBy: { displayOrder: 'asc' },
    });
  }

  updateGroup(id: string, data: Prisma.QuestionGroupUpdateInput): Promise<QuestionGroup> {
    return this.prisma.questionGroup.update({ where: { id }, data });
  }

  // ---- Questions ----------------------------------------------------------
  createQuestion(data: Prisma.QuestionUncheckedCreateInput): Promise<Question> {
    return this.prisma.question.create({ data });
  }

  /**
   * Question + its answers + its category assignment, atomically.
   *
   * The three-call sequence (`createQuestion`, then N × `createOption`, then
   * `setCategories`) can leave a live question with half its answers or none of
   * its assignment when a later call fails, and each call publishes. Here either
   * the whole question exists or none of it does, and the caller publishes ONCE
   * afterwards.
   *
   * Option `displayOrder` is the array index — a new question has no existing
   * options, so there is nothing to append after.
   */
  createQuestionWithOptions(
    question: Prisma.QuestionUncheckedCreateInput,
    options: ReadonlyArray<{ code: string; labelAr: string; labelEn: string }>,
    categories: readonly LoanCategory[],
  ): Promise<Question> {
    return this.prisma.$transaction(async (tx) => {
      const created = await tx.question.create({ data: question });
      if (options.length > 0) {
        await tx.questionOption.createMany({
          data: options.map((o, i) => ({ ...o, questionId: created.id, displayOrder: i })),
        });
      }
      if (categories.length > 0) {
        await tx.questionLoanCategory.createMany({
          data: categories.map((category) => ({ questionId: created.id, category })),
        });
      }
      return created;
    });
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
   *
   * `categories` comes along so the scoring editor can tell the admin when a
   * question they are weighting is not asked for their program's category — the
   * two assignment axes (question→category, program→question) are set on
   * different screens and nothing else compares them.
   *
   * The NUMERIC bounds + unit and the TEXT length come along too (v14.0.0):
   * every type is now scoreable, and the editor seeds a numeric question's bands
   * from its own min/max instead of asking the admin to invent edges.
   */
  async questionsWithOptions(): Promise<
    {
      code: string;
      type: QuestionType;
      questionAr: string;
      questionEn: string;
      categories: LoanCategory[];
      numericMinValue: string | null;
      numericMaxValue: string | null;
      numericStep: string | null;
      numericUnitAr: string | null;
      numericUnitEn: string | null;
      textMaxLength: number | null;
      options: { code: string; labelAr: string; labelEn: string }[];
    }[]
  > {
    const rows = await this.prisma.question.findMany({
      where: { isActive: true },
      orderBy: { displayOrder: 'asc' },
      select: {
        id: true,
        code: true,
        type: true,
        questionAr: true,
        questionEn: true,
        numericMinValue: true,
        numericMaxValue: true,
        numericStep: true,
        numericUnitAr: true,
        numericUnitEn: true,
        textMaxLength: true,
        loanCategories: { select: { category: true } },
        options: {
          where: { isActive: true },
          orderBy: { displayOrder: 'asc' },
          select: { code: true, labelAr: true, labelEn: true },
        },
      },
    });
    return rows.map(
      ({
        id: _id,
        loanCategories,
        numericMinValue,
        numericMaxValue,
        numericStep,
        ...q
      }) => ({
        ...q,
        categories: loanCategories.map((c) => c.category),
        // Decimal → string at the repository edge: money never crosses a service
        // boundary as a float (Principle I) and never leaks a Prisma type (A8).
        numericMinValue: numericMinValue?.toFixed(2) ?? null,
        numericMaxValue: numericMaxValue?.toFixed(2) ?? null,
        numericStep: numericStep?.toFixed(2) ?? null,
      }),
    );
  }

  updateQuestion(id: string, data: Prisma.QuestionUpdateInput): Promise<Question> {
    return this.prisma.question.update({ where: { id }, data });
  }

  /** Highest `displayOrder` across the whole pool, or -1 when it is empty. */
  async maxQuestionOrder(): Promise<number> {
    const row = await this.prisma.question.findFirst({
      orderBy: { displayOrder: 'desc' },
      select: { displayOrder: true },
    });
    return row?.displayOrder ?? -1;
  }

  /**
   * Rewrite the pool's order in one transaction: `displayOrder` becomes the id's
   * index in `ids`. Writing the full sequence (rather than shifting neighbours)
   * is what guarantees the result has no duplicate or gapped orders.
   */
  reorderQuestions(ids: string[]): Promise<unknown> {
    return this.prisma.$transaction(
      ids.map((id, index) =>
        this.prisma.question.update({ where: { id }, data: { displayOrder: index } }),
      ),
    );
  }

  /** Highest `displayOrder` among a question's options, or -1 when it has none. */
  async maxOptionOrder(questionId: string): Promise<number> {
    const row = await this.prisma.questionOption.findFirst({
      where: { questionId },
      orderBy: { displayOrder: 'desc' },
      select: { displayOrder: true },
    });
    return row?.displayOrder ?? -1;
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

  // ---- Loan-category assignment -------------------------------------------
  /**
   * Every question→category assignment row. Read whole rather than per question:
   * the admin tree and the publish snapshot both need the full map, and the pool
   * is dozens of rows — one query beats N.
   */
  async categoryAssignments(): Promise<Map<string, LoanCategory[]>> {
    const rows = await this.prisma.questionLoanCategory.findMany({
      select: { questionId: true, category: true },
    });
    const map = new Map<string, LoanCategory[]>();
    for (const row of rows) {
      const list = map.get(row.questionId);
      if (list) list.push(row.category);
      else map.set(row.questionId, [row.category]);
    }
    return map;
  }

  categoriesOf(questionId: string): Promise<{ category: LoanCategory }[]> {
    return this.prisma.questionLoanCategory.findMany({
      where: { questionId },
      select: { category: true },
    });
  }

  /**
   * Replace one question's assignment set atomically. Delete-then-insert (rather
   * than diffing) is what makes the written set exactly the submitted set — a
   * diff would leave a stale row behind on any missed comparison.
   */
  setCategories(questionId: string, categories: readonly LoanCategory[]): Promise<unknown> {
    return this.prisma.$transaction(async (tx) => {
      await tx.questionLoanCategory.deleteMany({ where: { questionId } });
      if (categories.length === 0) return;
      await tx.questionLoanCategory.createMany({
        data: categories.map((category) => ({ questionId, category })),
      });
    });
  }

  /** Same as `setCategories`, for many questions in ONE transaction (column actions). */
  setCategoriesBulk(
    assignments: ReadonlyArray<{ questionId: string; categories: readonly LoanCategory[] }>,
  ): Promise<unknown> {
    return this.prisma.$transaction(async (tx) => {
      for (const a of assignments) {
        await tx.questionLoanCategory.deleteMany({ where: { questionId: a.questionId } });
        if (a.categories.length === 0) continue;
        await tx.questionLoanCategory.createMany({
          data: a.categories.map((category) => ({ questionId: a.questionId, category })),
        });
      }
    });
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

  /**
   * Options for MANY questions in one query, grouped by question id.
   *
   * `publish()` walked every active question and issued one query each — ~60 round trips per
   * publish, on the path of every write to a mirrored list. The ordering is the same
   * `optionsByQuestion` promises, applied per group.
   */
  async optionsByQuestions(
    questionIds: readonly string[],
  ): Promise<Map<string, QuestionOption[]>> {
    const out = new Map<string, QuestionOption[]>();
    if (questionIds.length === 0) return out;
    const rows = await this.prisma.questionOption.findMany({
      where: { questionId: { in: [...questionIds] } },
      orderBy: [{ questionId: 'asc' }, { displayOrder: 'asc' }],
    });
    for (const row of rows) {
      const list = out.get(row.questionId);
      if (list) list.push(row);
      else out.set(row.questionId, [row]);
    }
    return out;
  }

  optionCodes(questionId: string): Promise<{ code: string }[]> {
    return this.prisma.questionOption.findMany({ where: { questionId }, select: { code: true } });
  }

  updateOption(id: string, data: Prisma.QuestionOptionUpdateInput): Promise<QuestionOption> {
    return this.prisma.questionOption.update({ where: { id }, data });
  }

  /**
   * Make a question's options BE the given list, one transaction.
   *
   * The diff itself is `mirroredOptionPlan`, pure and unit-tested; this is only the write.
   * Returns whether anything moved, so the caller can skip a republish that would mint a
   * version identical to the live one.
   */
  async syncMirroredOptions(questionId: string, values: readonly MirroredValue[]): Promise<boolean> {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.questionOption.findMany({ where: { questionId } });
      const plan = mirroredOptionPlan(existing, values);
      if (planIsEmpty(plan)) return false;

      if (plan.deactivate.length > 0) {
        await tx.questionOption.updateMany({
          where: { id: { in: plan.deactivate } },
          data: { isActive: false },
        });
      }
      // ONE statement per chunk, not one per row.
      //
      // `displayOrder` is a DENSE index over the registry's own order, which is correct and
      // is what makes an unordered list read alphabetically — but it means inserting a value
      // that sorts anywhere but last renumbers everything after it. On a several-hundred-row
      // list that was several hundred sequential UPDATEs holding row locks inside one
      // transaction. The plan is unchanged; only the write was slow.
      //
      // Two things that bite if they are dropped: `updatedAt` must be set EXPLICITLY, because
      // Prisma's `@updatedAt` fires on ORM writes and not on raw SQL; and the chunk exists
      // because Postgres caps bound parameters at 65 535 and this binds four per row.
      for (let i = 0; i < plan.update.length; i += MIRRORED_UPDATE_CHUNK) {
        const chunk = plan.update.slice(i, i + MIRRORED_UPDATE_CHUNK);
        const values = Prisma.join(
          chunk.map(
            (row) =>
              Prisma.sql`(${row.id}::text, ${row.labelAr}::text, ${row.labelEn}::text, ${row.displayOrder}::int)`,
          ),
        );
        await tx.$executeRaw`
          UPDATE "question_option" AS o
             SET "isActive"     = true,
                 "labelAr"      = v.label_ar,
                 "labelEn"      = v.label_en,
                 "displayOrder" = v.display_order,
                 "updatedAt"    = now()
            FROM (VALUES ${values}) AS v(id, label_ar, label_en, display_order)
           WHERE o."id" = v.id`;
      }
      if (plan.create.length > 0) {
        await tx.questionOption.createMany({
          data: plan.create.map((row) => ({ ...row, questionId })),
        });
      }
      return true;
    });
  }

  // ---- Versions (one global questionnaire) --------------------------------
  activeVersion(): Promise<QuestionnaireVersion | null> {
    return this.prisma.questionnaireVersion.findFirst({ where: { isActive: true } });
  }

  versionById(id: string): Promise<QuestionnaireVersion | null> {
    return this.prisma.questionnaireVersion.findUnique({ where: { id } });
  }

  /**
   * The version list, WITHOUT the snapshots and bounded.
   *
   * `snapshot` is the whole questionnaire — every group, every question, every option — and
   * this endpoint renders a list of version numbers. Selecting it returned the entire
   * publication history of the platform on every page load; with a several-hundred-value
   * mirrored list in each snapshot that is tens of megabytes for six scalar columns.
   *
   * Verified safe before narrowing: the admin's `QuestionnaireVersionRow` has no `snapshot`
   * field and nothing in the questionnaire feature reads one off history. A version's
   * snapshot is reachable by id through `versionById`, which rollback uses.
   */
  versionHistory(): Promise<QuestionnaireVersionSummary[]> {
    return this.prisma.questionnaireVersion.findMany({
      orderBy: { versionNumber: 'desc' },
      take: VERSION_HISTORY_LIMIT,
      select: {
        id: true,
        versionNumber: true,
        isActive: true,
        publishedAt: true,
        publishedBy: true,
        createdAt: true,
      },
    });
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
