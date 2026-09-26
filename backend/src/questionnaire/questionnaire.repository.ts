import { Injectable } from '@nestjs/common';
import { mirroredOptionPlan, planIsEmpty, type MirroredValue } from './mirrored-options';
import { Prisma } from '@prisma/client';
import type {
  LoanCategory,
  Question,
  QuestionGroup,
  QuestionOption,
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
        // SEEDED from the question's own pool position, not 0. Every category asks it where
        // the pool already puts it, which is where the operator who just typed it expects to
        // find it — a 0 would put a brand-new question first in four categories at once.
        await tx.questionLoanCategory.createMany({
          data: categories.map((category) => ({
            questionId: created.id,
            category,
            displayOrder: created.displayOrder,
          })),
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

  /**
   * The OPT-IN subset of `categoryAssignments`: the categories each question sits in only for
   * the program names that add it (`question_loan_category.optIn`).
   *
   * A read of its own for the reason `categoryOrders` is one: most callers want the whole SET
   * (answer acceptance, the admin's "is it assigned", the publish warning) and must keep
   * getting opt-in rows in it. Only the snapshot freeze, the admin tree and the name axis need
   * to tell the two kinds apart. A question absent from the map has no opt-in row.
   */
  async optInAssignments(): Promise<Map<string, LoanCategory[]>> {
    const rows = await this.prisma.questionLoanCategory.findMany({
      where: { optIn: true },
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

  /**
   * Every question's position IN EACH CATEGORY it is asked for.
   *
   * Its own read beside `categoryAssignments` rather than a widening of it: five callers want
   * the SET and two want the ORDER, and a single method returning both would have every one of
   * them destructuring a shape it does not use. Same table, same round trip class, and both
   * are admin-side.
   *
   * A question absent from the map is asked by no category; a category absent from its entry
   * is one it is not asked for. Neither is a zero.
   */
  async categoryOrders(): Promise<Map<string, Partial<Record<LoanCategory, number>>>> {
    const rows = await this.prisma.questionLoanCategory.findMany({
      select: { questionId: true, category: true, displayOrder: true },
    });
    const map = new Map<string, Partial<Record<LoanCategory, number>>>();
    for (const row of rows) {
      const entry = map.get(row.questionId) ?? {};
      entry[row.category] = row.displayOrder;
      map.set(row.questionId, entry);
    }
    return map;
  }

  /**
   * One category's asked questions, in ITS order — the list the admin drags and the exact
   * set a reorder must send back.
   *
   * Ordered by the join row first and the pool second, which is the same tie-break the
   * snapshot reader applies: a dense reorder can collide with a row seeded later from the
   * pool, and a collision has to resolve the same way on both sides or the screen would be
   * showing an order the applicant does not get.
   */
  async questionIdsInCategory(category: LoanCategory): Promise<string[]> {
    const rows = await this.prisma.questionLoanCategory.findMany({
      where: { category },
      select: {
        questionId: true,
        displayOrder: true,
        question: { select: { displayOrder: true, code: true } },
      },
    });
    return rows
      .sort(
        (a, b) =>
          a.displayOrder - b.displayOrder ||
          a.question.displayOrder - b.question.displayOrder ||
          a.question.code.localeCompare(b.question.code),
      )
      .map((row) => row.questionId);
  }

  /**
   * Rewrite ONE category's order in one transaction: `displayOrder` becomes the id's index in
   * `ids`. The full sequence, never a neighbour shift — the same guarantee `reorderQuestions`
   * makes about the pool, and the reason the result has no duplicate or gapped positions.
   *
   * Scoped by `(questionId, category)`, so a question's place in the other three categories is
   * untouched. That is the whole point of the column.
   */
  reorderCategoryQuestions(category: LoanCategory, ids: readonly string[]): Promise<unknown> {
    return this.prisma.$transaction(
      ids.map((id, index) =>
        this.prisma.questionLoanCategory.update({
          where: { pk_question_loan_category: { questionId: id, category } },
          data: { displayOrder: index },
        }),
      ),
    );
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
   *
   * `categories` is the ORDINARY set (asked of every program name). OPT-IN rows — a program
   * name's "ask this too" — are carried over unless `optInCategories` says which to keep, and
   * a listed category that was opt-in becomes ordinary. See `replaceAssignment`.
   */
  setCategories(
    questionId: string,
    categories: readonly LoanCategory[],
    optInCategories?: readonly LoanCategory[],
  ): Promise<unknown> {
    return this.prisma.$transaction(async (tx) => {
      const seed =
        (
          await tx.question.findUnique({
            where: { id: questionId },
            select: { displayOrder: true },
          })
        )?.displayOrder ?? 0;
      const held = await tx.questionLoanCategory.findMany({
        where: { questionId },
        select: { category: true, displayOrder: true, optIn: true },
      });
      await replaceAssignment(tx, questionId, held, seed, categories, optInCategories);
    });
  }

  /**
   * ADD categories to a question's set, leaving everything already there alone.
   *
   * NOT `setCategories` with a union computed by the caller, and the difference is a lost
   * update. `setCategories` replaces the whole set, so a read-modify-write is the shape of
   * every whole-set caller — and a product's step ① is a FOUR-TAB screen, which invites two
   * tabs (or two operators) to tick the same question in different loan types at the same
   * moment. Both read `[car]`, one writes `[car, personal]`, the other writes
   * `[car, mortgage]`, last write wins, and the losing tick is gone with the losing UI
   * still showing it ticked and nothing anywhere recording that it was dropped.
   *
   * The primary key is `(questionId, category)`, so an additive write is free and
   * idempotent: `skipDuplicates` makes a re-tick a no-op rather than a conflict, which is
   * also what lets the service publish only when something actually moved.
   *
   * Returns the categories it INSERTED — not the resulting set. The caller needs to know
   * whether to publish, and "nothing moved" has to be distinguishable from "nothing was
   * asked for".
   */
  async addCategories(
    questionId: string,
    categories: readonly LoanCategory[],
  ): Promise<LoanCategory[]> {
    if (categories.length === 0) return [];
    const held = await this.prisma.questionLoanCategory.findMany({
      where: { questionId },
      select: { category: true, optIn: true },
    });
    const existing = new Set(held.map((row) => row.category));
    const missing = categories.filter((category) => !existing.has(category));
    // An OPT-IN row this call names becomes ordinary: "ask it in this category" is a statement
    // about every name there, and the opt-in row said the opposite. Reported with the inserts —
    // the snapshot moves either way, so the caller must publish.
    const widened = held
      .filter((row) => row.optIn && categories.includes(row.category))
      .map((row) => row.category);
    if (widened.length > 0) {
      await this.prisma.questionLoanCategory.updateMany({
        where: { questionId, category: { in: widened }, optIn: true },
        data: { optIn: false },
      });
    }
    if (missing.length === 0) return widened;
    // Seeded from the pool position, like every other insert into this table: a question
    // newly asked by a category lands where the pool already puts it.
    const seed =
      (
        await this.prisma.question.findUnique({
          where: { id: questionId },
          select: { displayOrder: true },
        })
      )?.displayOrder ?? 0;
    await this.prisma.questionLoanCategory.createMany({
      data: missing.map((category) => ({ questionId, category, displayOrder: seed })),
      skipDuplicates: true,
    });
    // The pre-read set, not a re-read. A concurrent tick of the SAME category makes this a
    // superset by exactly the raced row, whose only cost is a questionnaire publish that
    // the other tick was performing anyway — where a re-read would report categories that
    // were already there as newly added, which is what the audit event must not say.
    return [...missing, ...widened];
  }

  /**
   * `addCategories` for MANY questions in ONE transaction — the write behind the catalog
   * name flow's "what applicants are asked" step.
   *
   * INSERT-ONLY, like its single-question sibling and for the same lost-update reason, which
   * this caller makes sharper rather than softer: that screen ticks across several loan types
   * in one gesture and posts them together, so a whole-set write would be one read-modify-write
   * spanning every question the operator touched.
   *
   * ONE `findMany` and ONE `createMany`, not a loop. `setCategoriesBulk` below loops because a
   * REPLACE needs a `deleteMany` paired with each question's insert; an additive write has no
   * per-question statement, so a loop would buy nothing and cost a round trip each. One
   * `createMany` compiles to a single `INSERT ... ON CONFLICT DO NOTHING`, which is atomic on
   * its own. The worst case one request can carry is the whole pool in every category — on the
   * order of a few hundred rows at two bound parameters each, against Postgres's 65 535 — so
   * there is nothing to chunk.
   *
   * Duplicate `questionId`s are folded FIRST. The screen is per loan type, so the same question
   * genuinely arrives twice when it is ticked into two of them; diffed separately against one
   * pre-read, both entries would report themselves as inserted and the caller's "what moved"
   * count would double.
   *
   * Returns questionId → the categories actually INSERTED, omitting every question that moved
   * nothing, so `map.size === 0` is the whole no-op test. It cannot be derived from
   * `createMany`'s count: with `skipDuplicates` that says how many rows landed and not whose,
   * and `(questionId, category)` is the primary key, so there are no returnable ids either way.
   */
  async addCategoriesBulk(
    assignments: ReadonlyArray<{ questionId: string; categories: readonly LoanCategory[] }>,
  ): Promise<Map<string, LoanCategory[]>> {
    const wanted = new Map<string, Set<LoanCategory>>();
    for (const a of assignments) {
      const set = wanted.get(a.questionId) ?? new Set<LoanCategory>();
      for (const category of a.categories) set.add(category);
      if (set.size > 0) wanted.set(a.questionId, set);
    }
    const added = new Map<string, LoanCategory[]>();
    if (wanted.size === 0) return added;

    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.questionLoanCategory.findMany({
        where: { questionId: { in: [...wanted.keys()] } },
        select: { questionId: true, category: true, optIn: true },
      });
      const held = new Map<string, Set<LoanCategory>>();
      for (const row of existing) {
        const set = held.get(row.questionId) ?? new Set<LoanCategory>();
        set.add(row.category);
        held.set(row.questionId, set);
      }
      // An OPT-IN row this add names becomes ordinary — a global add says every name in the
      // category asks it. Reported as moved, because the snapshot moves and must be published.
      for (const row of existing) {
        if (!row.optIn || wanted.get(row.questionId)?.has(row.category) !== true) continue;
        await tx.questionLoanCategory.update({
          where: {
            pk_question_loan_category: { questionId: row.questionId, category: row.category },
          },
          data: { optIn: false },
        });
        added.set(row.questionId, [...(added.get(row.questionId) ?? []), row.category]);
      }
      // The pool positions the new rows are seeded from — one read for every question in the
      // request, for the reason every other insert into this table seeds: a question newly
      // asked by a category lands where the pool already puts it, not first.
      const seeds = new Map(
        (
          await tx.question.findMany({
            where: { id: { in: [...wanted.keys()] } },
            select: { id: true, displayOrder: true },
          })
        ).map((row) => [row.id, row.displayOrder] as const),
      );
      const rows: { questionId: string; category: LoanCategory; displayOrder: number }[] = [];
      for (const [questionId, categories] of wanted) {
        const have = held.get(questionId);
        const missing = [...categories].filter((category) => !have?.has(category));
        if (missing.length === 0) continue;
        added.set(questionId, [...(added.get(questionId) ?? []), ...missing]);
        for (const category of missing)
          rows.push({ questionId, category, displayOrder: seeds.get(questionId) ?? 0 });
      }
      if (rows.length === 0) return added;
      await tx.questionLoanCategory.createMany({ data: rows, skipDuplicates: true });
      // The pre-read diff, never a re-read — see `addCategories` above for why.
      return added;
    });
  }

  /** Same as `setCategories`, for many questions in ONE transaction (column actions). */
  setCategoriesBulk(
    assignments: ReadonlyArray<{
      questionId: string;
      categories: readonly LoanCategory[];
      optInCategories?: readonly LoanCategory[];
    }>,
  ): Promise<unknown> {
    return this.prisma.$transaction(async (tx) => {
      // The rows every touched question already holds, read ONCE before any delete — the bulk
      // twin of `setCategories`'s own pre-read, and for the same reason: a column action that
      // re-ticks a category must not move the question inside the categories it leaves alone.
      const ids = assignments.map((a) => a.questionId);
      const held = new Map<string, HeldAssignment[]>();
      for (const row of await tx.questionLoanCategory.findMany({
        where: { questionId: { in: ids } },
        select: { questionId: true, category: true, displayOrder: true, optIn: true },
      })) {
        const list = held.get(row.questionId) ?? [];
        list.push(row);
        held.set(row.questionId, list);
      }
      const seeds = new Map(
        (
          await tx.question.findMany({
            where: { id: { in: ids } },
            select: { id: true, displayOrder: true },
          })
        ).map((row) => [row.id, row.displayOrder] as const),
      );
      for (const a of assignments) {
        await replaceAssignment(
          tx,
          a.questionId,
          held.get(a.questionId) ?? [],
          seeds.get(a.questionId) ?? 0,
          a.categories,
          a.optInCategories,
        );
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

/** One `question_loan_category` row as the replace writers pre-read it. */
interface HeldAssignment {
  category: LoanCategory;
  displayOrder: number;
  optIn: boolean;
}

/**
 * The replace both `setCategories` and `setCategoriesBulk` perform, for one question, inside
 * the caller's transaction.
 *
 *   - `ordinary` is written as ordinary rows: asked of every program name. A category that was
 *     OPT-IN and is listed here becomes ordinary — "ask it in this category" is a statement
 *     about every name there.
 *   - OPT-IN rows are a program name's "ask this too" and are not this screen's to lose by
 *     accident: carried over unless `optIn` is given, in which case it says which of them to
 *     keep. It never creates one — except that an ordinary row dropped from `ordinary` while
 *     program names still ADD the question falls back to opt-in when `optIn` is absent:
 *     "stop asking every name" must not also take it away from the names that picked it.
 *   - Every row keeps its per-category position (`displayOrder`); a new one is seeded from the
 *     pool, like every other insert into this table.
 *   - A category the question leaves ENTIRELY takes the program names' addition rows for it
 *     along: an addition of a question the category no longer holds scopes nothing and would
 *     only sit there looking like a choice somebody can still make.
 */
async function replaceAssignment(
  tx: Prisma.TransactionClient,
  questionId: string,
  held: readonly HeldAssignment[],
  seed: number,
  ordinary: readonly LoanCategory[],
  optIn: readonly LoanCategory[] | undefined,
): Promise<void> {
  const heldOptIn = held.filter((row) => row.optIn).map((row) => row.category);
  // Categories where some program name adds this question — what an opt-in row is FOR.
  const addedIn = new Set(
    (
      await tx.programNameQuestionAddition.findMany({
        where: { questionId },
        select: { category: true },
        distinct: ['category'],
      })
    ).map((row) => row.category),
  );
  // An explicit set can keep or drop an opt-in row, never mint one: opt-in rows are born only
  // from a program name's addition, which is what gives them a reader. Without one, an
  // ordinary row leaving `ordinary` stays in the category as opt-in if a name still adds it.
  const keepOptIn =
    optIn === undefined
      ? held
          .map((row) => row.category)
          .filter(
            (category) =>
              !ordinary.includes(category) &&
              (heldOptIn.includes(category) || addedIn.has(category)),
          )
      : optIn.filter((category) => heldOptIn.includes(category) && !ordinary.includes(category));
  const position = new Map(held.map((row) => [row.category, row.displayOrder] as const));
  const leaving = held
    .map((row) => row.category)
    .filter((category) => !ordinary.includes(category) && !keepOptIn.includes(category));

  await tx.questionLoanCategory.deleteMany({ where: { questionId } });
  const rows = [
    ...ordinary.map((category) => ({ category, optIn: false })),
    ...keepOptIn.map((category) => ({ category, optIn: true })),
  ];
  if (rows.length > 0) {
    await tx.questionLoanCategory.createMany({
      data: rows.map((row) => ({
        questionId,
        category: row.category,
        optIn: row.optIn,
        displayOrder: position.get(row.category) ?? seed,
      })),
    });
  }
  if (leaving.length > 0) {
    await tx.programNameQuestionAddition.deleteMany({
      where: { questionId, category: { in: leaving } },
    });
  }
}
