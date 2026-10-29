import { Injectable } from '@nestjs/common';
import { mirroredOptionPlan, planIsEmpty, type MirroredValue } from './mirrored-options';
import { Prisma } from '@prisma/client';
import type { Question, QuestionGroup, QuestionOption, QuestionnaireVersion } from '@prisma/client';
import { PrismaService } from '@/infra/prisma/prisma.service';
import {
  leversOf,
  numberEffectRangesOf,
  type AnswerEffectLevers,
  type AnswerEffectSource,
  type NumberEffectRange,
} from '@/matching/pipeline/answer-effects';

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

/** An answer's offer effect as stored (v31.2.0) — each column null when that lever is unset. */
export interface OptionEffectColumns {
  effectMaxLoanPercent?: Prisma.Decimal | null;
  effectRatePoints?: Prisma.Decimal | null;
  effectMaxTenorMonths?: number | null;
}

/** The stored columns → the engine's levers, each one present only when set. */
export function optionEffectLevers(row: {
  effectMaxLoanPercent: Prisma.Decimal | null;
  effectRatePoints: Prisma.Decimal | null;
  effectMaxTenorMonths: number | null;
}): AnswerEffectLevers {
  return {
    ...(row.effectMaxLoanPercent !== null
      ? { maxLoanPercent: row.effectMaxLoanPercent.toString() }
      : {}),
    ...(row.effectRatePoints !== null ? { ratePoints: row.effectRatePoints.toString() } : {}),
    ...(row.effectMaxTenorMonths !== null ? { maxTenorMonths: row.effectMaxTenorMonths } : {}),
  };
}

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
   * Question + its answers, atomically.
   *
   * The call sequence (`createQuestion`, then N × `createOption`) can leave a live question
   * with half its answers when a later call fails, and each call publishes. Here either the
   * whole question exists or none of it does, and the caller publishes ONCE afterwards.
   *
   * Option `displayOrder` is the array index — a new question has no existing
   * options, so there is nothing to append after.
   */
  createQuestionWithOptions(
    question: Prisma.QuestionUncheckedCreateInput,
    options: ReadonlyArray<
      { code: string; labelAr: string; labelEn: string } & OptionEffectColumns
    >,
  ): Promise<Question> {
    return this.prisma.$transaction(async (tx) => {
      const created = await tx.question.create({ data: question });
      if (options.length > 0) {
        await tx.questionOption.createMany({
          data: options.map((o, i) => ({ ...o, questionId: created.id, displayOrder: i })),
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

  /** Answers stored against a question on applications — what a delete leaves where it is. */
  answerCount(questionId: string): Promise<number> {
    return this.prisma.applicationAnswer.count({ where: { questionId } });
  }

  /**
   * A question marked FIXED is asked on every program (v31.0.0): any per-program tick of it
   * goes, in the same breath as the mark. Its place in each program's order stays.
   */
  clearNamePolicyFor(questionId: string): Promise<unknown> {
    return this.prisma.programNameQuestionAddition.deleteMany({ where: { questionId } });
  }

  /** The FIXED questions a super admin deleted — switched off, mark kept — for Restore. */
  deletedFixedQuestions(): Promise<Question[]> {
    return this.prisma.question.findMany({
      where: { isActive: false, fixedServedOn: { not: null } },
      orderBy: { displayOrder: 'asc' },
    });
  }

  /** The products whose live (not detached) asks reach a question through its bound fact. */
  async productAsksFor(questionId: string): Promise<string[]> {
    const rows = await this.prisma.surrogateProductAsk.findMany({
      where: { detachedAt: null, fact: { boundQuestionId: questionId } },
      select: { product: { select: { key: true } } },
    });
    return [...new Set(rows.map((r) => r.product.key))].sort();
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
   * the option — as the one `optionCode`, or among an `in` rule's `optionCodes` —
   * so deleting an unreferenced option of a referenced question is still allowed.
   */
  async optionDependentsOf(questionCode: string, optionCode: string): Promise<string[]> {
    const rows = await this.prisma.question.findMany({
      where: {
        isActive: true,
        AND: [
          { enabledWhen: { path: ['questionCode'], equals: questionCode } },
          {
            OR: [
              { enabledWhen: { path: ['optionCode'], equals: optionCode } },
              { enabledWhen: { path: ['optionCodes'], array_contains: [optionCode] } },
            ],
          },
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

  /**
   * Options for MANY questions in one query, grouped by question id.
   *
   * `publish()` walked every active question and issued one query each — ~60 round trips per
   * publish, on the path of every write to a mirrored list. The ordering is the same
   * `optionsByQuestion` promises, applied per group.
   */
  async optionsByQuestions(questionIds: readonly string[]): Promise<Map<string, QuestionOption[]>> {
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

  /**
   * Every answer that changes the offer (v31.2.0), in the fixed order the engine applies
   * them: question code, then option display order or range order. LIVE, never the snapshot —
   * an effect is pricing, not content, and both preview and apply read it from here (A33).
   *
   * FIXED questions only (v31.3.0): an ordinary question's answers change nothing, even if a
   * row still carried an effect. Switched-off answers and questions carry none either: nobody
   * can pick them. A number question's ranges come off `question.numberEffects`.
   */
  async answerEffectSources(): Promise<AnswerEffectSource[]> {
    const optionRows = await this.prisma.questionOption.findMany({
      where: {
        isActive: true,
        question: { isActive: true, fixedServedOn: { not: null } },
        OR: [
          { effectMaxLoanPercent: { not: null } },
          { effectRatePoints: { not: null } },
          { effectMaxTenorMonths: { not: null } },
        ],
      },
      select: {
        code: true,
        effectMaxLoanPercent: true,
        effectRatePoints: true,
        effectMaxTenorMonths: true,
        question: { select: { code: true, fixedServedOn: true } },
      },
      orderBy: [{ question: { code: 'asc' } }, { displayOrder: 'asc' }, { code: 'asc' }],
    });
    // A handful of rows: every active fixed NUMBER question, its ranges filtered here rather
    // than through a JSON-null filter.
    const numberRows = await this.prisma.question.findMany({
      where: { isActive: true, type: 'NUMERIC', fixedServedOn: { not: null } },
      select: { code: true, fixedServedOn: true, numberEffects: true },
      orderBy: { code: 'asc' },
    });
    const sources: AnswerEffectSource[] = [
      ...optionRows.map((row) => ({
        kind: 'option' as const,
        questionCode: row.question.code,
        optionCode: row.code,
        incomeProofOnly: row.question.fixedServedOn === 'income_proof',
        levers: optionEffectLevers(row),
      })),
      ...numberRows.flatMap((row) =>
        numberEffectRangesOf(row.numberEffects).map((range) => ({
          kind: 'range' as const,
          questionCode: row.code,
          range: { fromInclusive: range.fromInclusive, toExclusive: range.toExclusive },
          incomeProofOnly: row.fixedServedOn === 'income_proof',
          levers: leversOf(range),
        })),
      ),
    ];
    // One order across both lists — question code; a stable sort keeps each question's own
    // option or range order. A question is a choice OR a number, never both.
    return sources.sort((a, b) =>
      a.questionCode < b.questionCode ? -1 : a.questionCode > b.questionCode ? 1 : 0,
    );
  }

  /** Replace a number question's ranges; an empty list stores none (v31.3.0). */
  async setNumberEffects(questionId: string, ranges: readonly NumberEffectRange[]): Promise<void> {
    await this.prisma.question.update({
      where: { id: questionId },
      data: {
        numberEffects:
          ranges.length > 0 ? (ranges as unknown as Prisma.InputJsonValue) : Prisma.DbNull,
      },
    });
  }

  /**
   * Take every offer effect off a question — its answers' and its ranges (v31.3.0). Run when
   * a question stops being fixed: an ordinary question's answers change nothing.
   */
  async clearAnswerEffects(questionId: string): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.questionOption.updateMany({
        where: { questionId },
        data: { effectMaxLoanPercent: null, effectRatePoints: null, effectMaxTenorMonths: null },
      }),
      this.prisma.question.update({
        where: { id: questionId },
        data: { numberEffects: Prisma.DbNull },
      }),
    ]);
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
  async syncMirroredOptions(
    questionId: string,
    values: readonly MirroredValue[],
  ): Promise<boolean> {
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

  /** The version that was live at `at`: the last one published at or before it. */
  versionLiveAt(at: Date): Promise<QuestionnaireVersion | null> {
    return this.prisma.questionnaireVersion.findFirst({
      where: { publishedAt: { lte: at } },
      orderBy: [{ publishedAt: 'desc' }, { versionNumber: 'desc' }],
    });
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
