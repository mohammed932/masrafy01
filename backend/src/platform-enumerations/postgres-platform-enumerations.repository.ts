import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import type { LoanCategory, PlatformEnumeration, Prisma, QuestionType } from '@prisma/client';
import { sortCategories } from '@/common/loan-category.util';
import { PrismaService } from '@/infra/prisma/prisma.service';
import {
  EnumerationMember,
  EnumerationType,
  PlatformEnumerationsRepository,
  type EnumerationQuestionTemplate,
  type QuestionCodesByCategory,
} from './platform-enumerations.repository';

export interface CreateEnumerationInput {
  type: string;
  key: string;
  labelAr: string;
  labelEn: string;
  parentKey?: string | null;
  sortOrder?: number;
  /** Loan categories to assign at creation. Empty / omitted = parked. */
  categories?: readonly LoanCategory[];
  createdBy: string;
}

/** One entry's new assignment set, for the bulk write. */
export interface EnumerationCategoryAssignment {
  enumerationId: string;
  categories: readonly LoanCategory[];
}

/**
 * One active question, as the catalog's template board needs it: enough to
 * render and scope a row, and nothing more. Narrower than the scoring editor's
 * `WeightableQuestionView`, which also carries options, numeric bounds, units
 * and text length — none of which this board displays.
 */
export interface CatalogQuestionRow {
  code: string;
  labelAr: string;
  labelEn: string;
  type: QuestionType;
  /** The loan categories that ASK this question. Empty = parked. */
  categories: LoanCategory[];
}

export interface EnumerationTypeStats {
  type: string;
  total: number;
  active: number;
  deprecated: number;
}

/**
 * Domain row returned to services / controllers — keeps Prisma's
 * `PlatformEnumeration` row type confined to this repository
 * (Constitution Principle X / A8).
 */
export interface EnumerationRow {
  id: string;
  type: string;
  key: string;
  labelAr: string;
  labelEn: string;
  active: boolean;
  systemOnly: boolean;
  deprecatedAt: Date | null;
  parentKey: string | null;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

/** Domain patch for `updateById` — translated to Prisma update input inside the repo. */
export interface EnumerationUpdatePatch {
  labelAr?: string;
  labelEn?: string;
  parentKey?: string | null;
  sortOrder?: number;
  active?: boolean;
  /** When `true` AND `deprecatedAt` is currently null, the repository stamps `deprecatedAt = now`
   *  and forces `active = false`. */
  deprecate?: true;
  updatedBy: string;
}

const ALL_TYPES: readonly EnumerationType[] = [
  'transfer_type',
  'employment_type',
  'property_type',
  'professor_rank',
  'military_grade',
  'product_category',
  'company_type',
  'required_document',
  'currency',
  'governorate',
  'program_name',
];

interface CacheEntry {
  members: EnumerationMember[];
  expiresAt: number;
}

const CACHE_TTL_MS = 60_000; // 1 minute

@Injectable()
export class PostgresPlatformEnumerationsRepository
  extends PlatformEnumerationsRepository
  implements OnModuleInit
{
  private readonly logger = new Logger(PostgresPlatformEnumerationsRepository.name);
  private readonly cache: Map<EnumerationType, CacheEntry> = new Map();

  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async onModuleInit(): Promise<void> {
    const count = await this.prisma.platformEnumeration.count();
    if (count === 0) {
      throw new Error(
        'PlatformEnumeration table is empty. Run `npx prisma migrate deploy` to apply the seed.',
      );
    }
    this.logger.log(`PlatformEnumerations registry loaded (${count} members across DB).`);
  }

  async isAvailable(): Promise<boolean> {
    try {
      await this.prisma.platformEnumeration.findFirst({ select: { id: true } });
      return true;
    } catch {
      return false;
    }
  }

  async isActiveMember(type: EnumerationType, key: string): Promise<boolean> {
    const row = await this.prisma.platformEnumeration.findUnique({
      where: { idx_platform_enumeration_type_key: { type, key } },
      select: { active: true, deprecatedAt: true },
    });
    return Boolean(row && row.active && row.deprecatedAt === null);
  }

  async isDeprecatedMember(type: EnumerationType, key: string): Promise<boolean> {
    const row = await this.prisma.platformEnumeration.findUnique({
      where: { idx_platform_enumeration_type_key: { type, key } },
      select: { deprecatedAt: true },
    });
    return Boolean(row && row.deprecatedAt !== null);
  }

  async getActiveMembers(type: EnumerationType): Promise<EnumerationMember[]> {
    const cached = this.cache.get(type);
    if (cached && cached.expiresAt > Date.now()) return cached.members;

    const rows = await this.prisma.platformEnumeration.findMany({
      where: { type, active: true, deprecatedAt: null },
      orderBy: [{ sortOrder: 'asc' }, { key: 'asc' }],
      // Assignments ride along on the member so the bank-program builder can
      // filter its picker client-side. A `?category=` query param instead would
      // have to compose with this cache AND the admin's per-type signal store,
      // and the builder must re-filter the instant the operator changes the
      // product category — not on a refetch.
      include: { loanCategories: { select: { category: true } } },
    });
    const members: EnumerationMember[] = rows.map(toEnumerationMember);
    this.cache.set(type, { members, expiresAt: Date.now() + CACHE_TTL_MS });
    return members;
  }

  /**
   * Loan categories a member may be offered under, by catalog KEY (which is what
   * `bank_program.programNameKey` stores). Empty = parked.
   *
   * Deliberately NOT served from the member cache above: this backs a hard
   * write-time rejection, and one indexed point read per program save is not a
   * budget worth defending against a 60s window of wrong answers.
   */
  async memberCategories(type: EnumerationType, key: string): Promise<LoanCategory[]> {
    const rows = await this.prisma.platformEnumerationLoanCategory.findMany({
      where: { enumeration: { type, key } },
      select: { category: true },
    });
    return sortCategories(rows.map((r) => r.category));
  }

  invalidateCache(type?: EnumerationType): void {
    if (type) this.cache.delete(type);
    else this.cache.clear();
  }

  // ---- Admin CRUD --------------------------------------------------------
  // Admin-side read/write methods. Cache is invalidated by the caller after
  // a successful mutation so the read-cache cannot serve stale rows.

  async findAllOrdered(filter?: { type?: string }): Promise<EnumerationRow[]> {
    const rows = await this.prisma.platformEnumeration.findMany({
      where: filter?.type ? { type: filter.type } : undefined,
      orderBy: [{ type: 'asc' }, { sortOrder: 'asc' }, { key: 'asc' }],
    });
    return rows.map(toEnumerationRow);
  }

  /**
   * How many bank programs (and distinct banks) each `program_name` archetype is
   * currently used by — the number that tells an operator whether a catalog
   * entry is load-bearing before they deprecate it.
   *
   * The `bank_program` read lives here rather than in `BankProgramRepository`
   * because bank-programs already depends on this module; importing back would
   * close a cycle. Still a repository, so Principle X holds.
   */
  async countProgramNameUsage(): Promise<Map<string, { programs: number; banks: number }>> {
    const rows = await this.prisma.bankProgram.findMany({
      where: { programNameKey: { not: null } },
      select: { programNameKey: true, bankId: true },
    });
    const acc = new Map<string, { programs: number; banks: Set<string> }>();
    for (const r of rows) {
      const key = r.programNameKey;
      if (!key) continue;
      const entry = acc.get(key) ?? { programs: 0, banks: new Set<string>() };
      entry.programs += 1;
      if (r.bankId) entry.banks.add(r.bankId);
      acc.set(key, entry);
    }
    return new Map(
      [...acc].map(([key, v]) => [key, { programs: v.programs, banks: v.banks.size }]),
    );
  }

  async listTypeStats(): Promise<EnumerationTypeStats[]> {
    const rows = await this.prisma.platformEnumeration.groupBy({
      by: ['type'],
      _count: { _all: true },
      orderBy: { type: 'asc' },
    });
    const out: EnumerationTypeStats[] = [];
    for (const r of rows) {
      const [active, deprecated] = await Promise.all([
        this.prisma.platformEnumeration.count({
          where: { type: r.type, active: true, deprecatedAt: null },
        }),
        this.prisma.platformEnumeration.count({
          where: { type: r.type, deprecatedAt: { not: null } },
        }),
      ]);
      out.push({ type: r.type, total: r._count._all, active, deprecated });
    }
    return out;
  }

  async findByTypeAndKey(type: string, key: string): Promise<EnumerationRow | null> {
    const row = await this.prisma.platformEnumeration.findUnique({
      where: { idx_platform_enumeration_type_key: { type, key } },
    });
    return row ? toEnumerationRow(row) : null;
  }

  async findById(id: string): Promise<EnumerationRow | null> {
    const row = await this.prisma.platformEnumeration.findUnique({ where: { id } });
    return row ? toEnumerationRow(row) : null;
  }

  async insert(input: CreateEnumerationInput): Promise<EnumerationRow> {
    const row = await this.prisma.platformEnumeration.create({
      data: {
        type: input.type,
        key: input.key,
        labelAr: input.labelAr,
        labelEn: input.labelEn,
        parentKey: input.parentKey ?? null,
        sortOrder: input.sortOrder ?? 0,
        active: true,
        systemOnly: false,
        createdBy: input.createdBy,
        updatedBy: input.createdBy,
        // Written with the row, not after it: an entry that exists with no
        // assignment — even for one round-trip — is offerable nowhere, and the
        // whole point of the caller's default is that it can never happen.
        loanCategories: input.categories?.length
          ? { createMany: { data: input.categories.map((category) => ({ category })) } }
          : undefined,
      },
    });
    return toEnumerationRow(row);
  }

  // ---- Loan-category assignment -------------------------------------------

  /**
   * Every assignment row, keyed by enumeration id. Read whole rather than per
   * row: the assignment board renders the entire catalog in one page, so one
   * query beats N.
   */
  async categoryAssignments(filter?: { type?: string }): Promise<Map<string, LoanCategory[]>> {
    const rows = await this.prisma.platformEnumerationLoanCategory.findMany({
      where: filter?.type ? { enumeration: { type: filter.type } } : undefined,
      select: { enumerationId: true, category: true },
    });
    const map = new Map<string, LoanCategory[]>();
    for (const row of rows) {
      const list = map.get(row.enumerationId);
      if (list) list.push(row.category);
      else map.set(row.enumerationId, [row.category]);
    }
    return map;
  }

  /** One entry's current assignment set. */
  async categoriesOf(enumerationId: string): Promise<LoanCategory[]> {
    const rows = await this.prisma.platformEnumerationLoanCategory.findMany({
      where: { enumerationId },
      select: { category: true },
    });
    return sortCategories(rows.map((r) => r.category));
  }

  /**
   * Replace one entry's assignment set atomically. Delete-then-insert rather
   * than diffing, so the written set is exactly the submitted set — a diff
   * leaves a stale row behind on any missed comparison.
   *
   * The first `$transaction` in this repository (every other write is a single
   * row): the delete and the insert are one fact, and a crash between them
   * would silently park the entry.
   */
  setCategories(enumerationId: string, categories: readonly LoanCategory[]): Promise<unknown> {
    return this.prisma.$transaction(async (tx) => {
      // Same parent lock, same reason, as `setQuestions`.
      await tx.$executeRaw`SELECT 1 FROM platform_enumeration WHERE id = ${enumerationId} FOR UPDATE`;
      await tx.platformEnumerationLoanCategory.deleteMany({ where: { enumerationId } });
      if (categories.length === 0) return;
      await tx.platformEnumerationLoanCategory.createMany({
        data: categories.map((category) => ({ enumerationId, category })),
      });
    });
  }

  // ---- Question template (catalog name → suggested questions) --------------
  //
  // Advisory data. Nothing here is read at scoring time; it seeds the wizard.

  /**
   * Every name→question assignment, keyed by enumeration id, then by loan
   * category, values as question CODES in pool display order. Read whole rather
   * than per row: the board renders all 16 names at once, so one query beats N.
   *
   * Nested by category rather than flattened to a `${id}:${category}` key so a
   * caller can hand one name's whole template to the detail screen in one lookup
   * — the screen's four tabs are four reads of the same object.
   */
  async questionAssignments(filter?: {
    type?: string;
  }): Promise<Map<string, QuestionCodesByCategory>> {
    const rows = await this.prisma.platformEnumerationQuestion.findMany({
      where: filter?.type ? { enumeration: { type: filter.type } } : undefined,
      select: { enumerationId: true, category: true, question: { select: { code: true } } },
      orderBy: [{ question: { displayOrder: 'asc' } }, { question: { code: 'asc' } }],
    });
    const map = new Map<string, QuestionCodesByCategory>();
    for (const row of rows) {
      let byCategory = map.get(row.enumerationId);
      if (!byCategory) {
        byCategory = {};
        map.set(row.enumerationId, byCategory);
      }
      const list = byCategory[row.category];
      if (list) list.push(row.question.code);
      else byCategory[row.category] = [row.question.code];
    }
    return map;
  }

  /** One entry's suggested sets per category, as codes in pool display order. */
  async questionsOf(enumerationId: string): Promise<QuestionCodesByCategory> {
    const rows = await this.prisma.platformEnumerationQuestion.findMany({
      where: { enumerationId },
      select: { category: true, question: { select: { code: true } } },
      orderBy: [{ question: { displayOrder: 'asc' } }, { question: { code: 'asc' } }],
    });
    const byCategory: QuestionCodesByCategory = {};
    for (const row of rows) {
      const list = byCategory[row.category];
      if (list) list.push(row.question.code);
      else byCategory[row.category] = [row.question.code];
    }
    return byCategory;
  }

  /** One entry's suggested set for ONE category — what a per-tab write diffs against. */
  async questionsOfCategory(enumerationId: string, category: LoanCategory): Promise<string[]> {
    const rows = await this.prisma.platformEnumerationQuestion.findMany({
      where: { enumerationId, category },
      select: { question: { select: { code: true } } },
      orderBy: [{ question: { displayOrder: 'asc' } }, { question: { code: 'asc' } }],
    });
    return rows.map((r) => r.question.code);
  }

  /** By catalog KEY + category — the read the scoring wizard's seed goes through. */
  async memberQuestionTemplate(
    type: EnumerationType,
    key: string,
    category: LoanCategory,
  ): Promise<EnumerationQuestionTemplate | null> {
    const row = await this.prisma.platformEnumeration.findUnique({
      where: { idx_platform_enumeration_type_key: { type, key } },
      select: {
        key: true,
        labelAr: true,
        labelEn: true,
        questions: {
          // Scoped in the query, not filtered after: a name templated across all
          // four categories would otherwise fetch four times the rows to throw
          // three quarters of them away on every wizard open.
          where: { category },
          select: { question: { select: { code: true } } },
          orderBy: [{ question: { displayOrder: 'asc' } }, { question: { code: 'asc' } }],
        },
      },
    });
    if (!row) return null;
    return {
      key: row.key,
      labelAr: row.labelAr,
      labelEn: row.labelEn,
      category,
      questionCodes: row.questions.map((q) => q.question.code),
    };
  }

  /**
   * The active question pool this board picks from, each with the loan
   * categories that ASK it (so the board can scope and flag drift).
   */
  async questionTemplatePool(): Promise<CatalogQuestionRow[]> {
    const rows = await this.prisma.question.findMany({
      where: { isActive: true },
      select: {
        code: true,
        questionAr: true,
        questionEn: true,
        type: true,
        loanCategories: { select: { category: true } },
      },
      orderBy: [{ displayOrder: 'asc' }, { code: 'asc' }],
    });
    return rows.map((q) => ({
      code: q.code,
      labelAr: q.questionAr,
      labelEn: q.questionEn,
      type: q.type,
      categories: sortCategories(q.loanCategories.map((c) => c.category)),
    }));
  }

  /**
   * Replace one entry's suggested set FOR ONE CATEGORY, atomically. Takes CODES;
   * resolves them to ids inside the transaction. Delete-then-insert rather than
   * diffing, so the written set is exactly the submitted set.
   *
   * Scoped to the category on both halves — the delete as well as the insert.
   * A delete over the whole `enumerationId` would make saving the Personal tab
   * wipe the Business tab, which is precisely the confusion the category axis
   * exists to remove.
   *
   * Resolution deliberately does NOT filter on `isActive`. A question that has
   * been soft-deleted has left the pool, so it can never be ADDED here — but an
   * existing pick on one must survive a re-save, or the board would silently
   * prune a row it is simultaneously telling the admin to go and look at.
   */
  setQuestions(
    enumerationId: string,
    category: LoanCategory,
    questionCodes: readonly string[],
  ): Promise<unknown> {
    return this.prisma.$transaction(async (tx) => {
      // Serialise on the parent row FIRST. Delete-then-insert under the default
      // READ COMMITTED is not safe against a second write to the same name: the
      // late transaction's DELETE plan is fixed against its own snapshot, so it
      // cannot see rows the winner inserted, and the two interleave into a state
      // neither client asked for (or collide on the composite PK and 500).
      // The board can issue overlapping writes for one name — every tap sends
      // the whole set — so this is reachable, not theoretical.
      //
      // Locked on the NAME, not the (name, category) pair, even though two tabs
      // touch disjoint rows: the lock is taken on `platform_enumeration`, which
      // has one row per name and no per-category row to lock instead.
      await tx.$executeRaw`SELECT 1 FROM platform_enumeration WHERE id = ${enumerationId} FOR UPDATE`;
      await tx.platformEnumerationQuestion.deleteMany({ where: { enumerationId, category } });
      if (questionCodes.length === 0) return;
      const questions = await tx.question.findMany({
        where: { code: { in: [...questionCodes] } },
        select: { id: true },
      });
      if (questions.length === 0) return;
      await tx.platformEnumerationQuestion.createMany({
        data: questions.map((q) => ({ enumerationId, category, questionId: q.id })),
      });
    });
  }

  /** Question codes that exist at all (active or soft-deleted) — write validation. */
  async existingQuestionCodes(codes: readonly string[]): Promise<Set<string>> {
    if (codes.length === 0) return new Set();
    const rows = await this.prisma.question.findMany({
      where: { code: { in: [...codes] } },
      select: { code: true },
    });
    return new Set(rows.map((r) => r.code));
  }

  /** Same as `setCategories`, for many entries in ONE transaction (column actions). */
  setCategoriesBulk(assignments: readonly EnumerationCategoryAssignment[]): Promise<unknown> {
    return this.prisma.$transaction(async (tx) => {
      // Lock every parent up front, in a deterministic order: locking lazily as
      // the loop reaches each row lets two bulk writes that touch the same names
      // in different orders deadlock.
      const ids = [...new Set(assignments.map((a) => a.enumerationId))].sort();
      for (const id of ids) {
        await tx.$executeRaw`SELECT 1 FROM platform_enumeration WHERE id = ${id} FOR UPDATE`;
      }
      for (const a of assignments) {
        await tx.platformEnumerationLoanCategory.deleteMany({
          where: { enumerationId: a.enumerationId },
        });
        if (a.categories.length === 0) continue;
        await tx.platformEnumerationLoanCategory.createMany({
          data: a.categories.map((category) => ({ enumerationId: a.enumerationId, category })),
        });
      }
    });
  }

  async updateById(id: string, patch: EnumerationUpdatePatch): Promise<EnumerationRow> {
    const data: Prisma.PlatformEnumerationUpdateInput = { updatedBy: patch.updatedBy };
    if (patch.labelAr !== undefined) data.labelAr = patch.labelAr;
    if (patch.labelEn !== undefined) data.labelEn = patch.labelEn;
    if (patch.parentKey !== undefined) data.parentKey = patch.parentKey;
    if (patch.sortOrder !== undefined) data.sortOrder = patch.sortOrder;

    if (patch.deprecate === true) {
      data.deprecatedAt = new Date();
      data.active = false;
    } else if (patch.active !== undefined) {
      data.active = patch.active;
    }

    const row = await this.prisma.platformEnumeration.update({ where: { id }, data });
    return toEnumerationRow(row);
  }

  static readonly KNOWN_TYPES = ALL_TYPES;
}

// ---- Boundary mapper (Prisma row -> domain row) --------------------------

function toEnumerationRow(row: PlatformEnumeration): EnumerationRow {
  return {
    id: row.id,
    type: row.type,
    key: row.key,
    labelAr: row.labelAr,
    labelEn: row.labelEn,
    active: row.active,
    systemOnly: row.systemOnly,
    deprecatedAt: row.deprecatedAt,
    parentKey: row.parentKey,
    sortOrder: row.sortOrder,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

/** `loanCategories` is optional so callers that don't `include` it still map. */
type PlatformEnumerationWithCategories = PlatformEnumeration & {
  loanCategories?: { category: LoanCategory }[];
};

function toEnumerationMember(row: PlatformEnumerationWithCategories): EnumerationMember {
  return {
    type: row.type as EnumerationType,
    key: row.key,
    labelAr: row.labelAr,
    labelEn: row.labelEn,
    parentKey: row.parentKey,
    active: row.active,
    deprecated: row.deprecatedAt !== null,
    categories: sortCategories((row.loanCategories ?? []).map((c) => c.category)),
  };
}
