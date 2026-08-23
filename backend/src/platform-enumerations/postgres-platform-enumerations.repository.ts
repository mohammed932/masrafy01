import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { BankProgramType, Prisma } from '@prisma/client';
import type { LoanCategory, PlatformEnumeration, QuestionType } from '@prisma/client';
import { normalizeIncomeAssumption } from '@/matching/pipeline/income-rule-normalize';
import { inheritsCatalogAmounts } from '@/matching/pipeline/income-rule-inherit';
import { asLoanCategory, sortCategories } from '@/common/loan-category.util';
import { basesOfFlags, flagsOfBases, type IncomeBasis } from '@/common/income-basis.util';
import { factKeyOf, factStrategy, type IncomeAssumptionConfig } from '@/matching/types';
import { SURROGATE_FACTS_BY_STRATEGY } from '@/matching/pipeline/surrogate-fact-bindings';
import { PrismaService } from '@/infra/prisma/prisma.service';
import {
  EnumerationMember,
  EnumerationType,
  PlatformEnumerationsRepository,
  BINDABLE_QUESTION_TYPES,
  isBindableQuestionType,
  type BindableQuestionType,
  type BoundQuestion,
  type EnumerationQuestionTemplate,
  type IncomeBasesByCategory,
  type ProgramNameIncomeRuleRow,
  type ProgramUnderName,
  type QuestionCodesByCategory,
  type SurrogateFactBinding,
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
  /**
   * How the new name is MEANT to be sold, under every category above — the create
   * screen asks once, the detail screen's tabs refine it afterwards. Omitted means
   * `['payslip']`, which is what a name meant before the column existed.
   */
  incomeBases?: readonly IncomeBasis[];
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

/** How many programs behind one name prove income each way, under one loan category. */
export interface IncomeBasisCount {
  /** Programs typed `income_proof` — they read a payslip. */
  payslip: number;
  /** Programs typed `income_surrogate` — the bank works the income out. */
  noPayslip: number;
}

/**
 * How a catalog name is actually being SOLD, per name key — what the list screen
 * needs to count the no-payslip programs behind a name, and to say which of those are
 * still missing the bank's own income table.
 *
 * Derived from `bank_program`, never stored — what banks DID with the name. The
 * catalog's own per-pair basis (`EnumerationMember.incomeBases`) says what the name is
 * MEANT for, and the two are allowed to disagree: this one is a report, so it can never
 * refuse anything, and neither can that one any more (v16.4.0 removed the save-time
 * rejection a stale tick could trigger).
 */
export interface ProgramNameUsage {
  programs: number;
  banks: number;
  /** Programs typed `income_surrogate` — the no-payslip ones. */
  noPayslipPrograms: number;
  /**
   * No-payslip programs that assume NO income yet: the program says there is no
   * payslip, but the rule still reads whatever salary the applicant typed, because
   * the bank's own table was never entered. The silent failure feature 011 exists to
   * close — an unconfigured table produces no figure and says nothing.
   */
  noPayslipProgramsWithoutTable: number;
  /**
   * The same split, broken down by the loan category the program is sold under —
   * what the catalog name's per-category tabs render.
   *
   * Per category, not one total, because the name detail screen is four tabs and the
   * answer genuinely differs between them: "Doctor Loans" can be a payslip personal
   * loan at one bank and a no-payslip business loan at another, and a single figure
   * would report both tabs the same. Categories with no program are ABSENT rather
   * than zeroed — the tab then says "no bank offers this yet", which is a different
   * sentence from "0 read a payslip".
   */
  byCategory: Partial<Record<LoanCategory, IncomeBasisCount>>;
}

/**
 * One surface that still names a registry key, and how many rows there are.
 *
 * A LIST of named sources rather than one total, because the number alone never
 * tells the operator what to go fix: "12" is a repointing job when it is bank
 * programs and an unfixable one when it is stored applications. `source` is the
 * table, machine-readable — the client localises it, nothing here emits English
 * to a caller (Principle III).
 */
export interface EnumerationReference {
  source: string;
  count: number;
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
  'governorate',
  'program_name',
  'surrogate_fact',
];

/**
 * What a bound question is read as, everywhere it is read.
 *
 * One constant because the two readers — the member payload and the admin's per-page
 * map — must produce the same object: a screen that saw the options and a screen that
 * did not would disagree about whether a fact's table can be filled in.
 */
const BOUND_QUESTION_SELECT = {
  id: true,
  code: true,
  type: true,
  questionAr: true,
  questionEn: true,
  isActive: true,
  options: {
    where: { isActive: true },
    orderBy: [{ displayOrder: 'asc' }, { code: 'asc' }],
    select: { code: true, labelAr: true, labelEn: true },
  },
  // Who is ASKED this question. Rides along because it is what the bank-program form
  // needs to say "this loan type is never asked the figure your rule reads" — the one
  // condition under which a fact-keyed table quotes nothing at all.
  loanCategories: { select: { category: true } },
} as const satisfies Prisma.QuestionSelect;

/** The one type whose members bind a question; see `QUESTION_BOUND_ENUMERATION_TYPES`. */
const FACT_TYPE: EnumerationType = 'surrogate_fact';

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
      //
      // The stored basis rides on the same assignment row, so a caller that wants
      // "how is this name meant to be sold" pays no extra query for it.
      include: {
        loanCategories: { select: { category: true, payslip: true, noPayslip: true } },
        // `surrogate_fact` only in practice, but included unconditionally: the column
        // is null on every other type, so a `where`-dependent include would buy one
        // saved join on rows that have nothing to join to, at the cost of two shapes
        // of member coming out of one mapper.
        boundQuestion: { select: BOUND_QUESTION_SELECT },
      },
    });
    const members: EnumerationMember[] = rows.map(toEnumerationMember);
    await this.attachParentOptions(members);
    this.cache.set(type, { members, expiresAt: Date.now() + CACHE_TTL_MS });
    return members;
  }

  /**
   * Fill each bound question's `parentOptions` — the list its options are FILED UNDER.
   *
   * Two queries, both skipped entirely when no member on this type binds an option list, so
   * every type but `surrogate_fact` pays nothing. Runs before the cache write, so the walk
   * is amortised over the cache TTL like the rest of the member read.
   *
   * The parent LIST is derived rather than declared because `parentKey`'s scope is a bare
   * key: nothing in the row says which type it points into. So the type is inferred as the
   * one whose rows actually cover the keys in hand, and ties break on the type name so two
   * identical databases answer identically.
   */
  private async attachParentOptions(members: EnumerationMember[]): Promise<void> {
    const codes = new Set<string>();
    for (const m of members) for (const o of m.boundQuestion?.options ?? []) codes.add(o.code);
    if (codes.size === 0) return;

    const children = await this.prisma.platformEnumeration.findMany({
      where: {
        key: { in: [...codes] },
        parentKey: { not: null },
        active: true,
        deprecatedAt: null,
      },
      select: { type: true, key: true, parentKey: true },
    });
    if (children.length === 0) return;

    // key → parent, per candidate list. Per LIST and not flattened: the same key can exist
    // in two types, and merging them would file a compound under a governorate.
    const parentByKeyPerType = new Map<string, Map<string, string>>();
    for (const c of children) {
      if (c.parentKey === null) continue;
      const forType = parentByKeyPerType.get(c.type) ?? new Map<string, string>();
      forType.set(c.key, c.parentKey);
      parentByKeyPerType.set(c.type, forType);
    }

    const parentKeys = new Set(children.map((c) => c.parentKey).filter((k): k is string => !!k));
    const parentRows = await this.prisma.platformEnumeration.findMany({
      where: { key: { in: [...parentKeys] }, active: true, deprecatedAt: null },
      orderBy: [{ sortOrder: 'asc' }, { key: 'asc' }],
      select: { type: true, key: true, labelAr: true, labelEn: true },
    });
    if (parentRows.length === 0) return;

    const parentRowsPerType = new Map<
      string,
      Array<{ key: string; labelAr: string; labelEn: string }>
    >();
    for (const r of parentRows) {
      const list = parentRowsPerType.get(r.type) ?? [];
      list.push({ key: r.key, labelAr: r.labelAr, labelEn: r.labelEn });
      parentRowsPerType.set(r.type, list);
    }

    for (const m of members) {
      const options = m.boundQuestion?.options ?? [];
      if (options.length === 0) continue;

      const childList = bestCovering(parentByKeyPerType, options.map((o) => o.code));
      if (!childList) continue;
      const wanted = new Set<string>();
      for (const o of options) {
        const parent = childList.get(o.code);
        if (parent !== undefined) wanted.add(parent);
      }
      if (wanted.size === 0) continue;

      const parentList = bestCoveringRows(parentRowsPerType, wanted);
      if (!parentList) continue;
      const bound = m.boundQuestion;
      if (!bound) continue;
      bound.parentOptions = parentList
        .filter((r) => wanted.has(r.key))
        .map((r) => ({ code: r.key, labelAr: r.labelAr, labelEn: r.labelEn }));
    }
  }

  /**
   * The fact registry the ENGINE reads: active facts, bound to an active question of a
   * shape a table can be keyed by.
   *
   * Every filter here is load-bearing, and each drops a fact the engine could otherwise
   * "resolve" into a wrong number rather than into a stated reason:
   *   · inactive / deprecated fact — the operator retired it; its programs must report
   *     an unconfigured rule, not keep quoting off it
   *   · unbound or deleted question — there is no answer to read
   *   · inactive question — it has left the questionnaire, so no new application carries it
   *   · TEXT / MULTI_SELECT — nothing a key table or a band table can be keyed by
   */
  async surrogateFactRegistry(): Promise<SurrogateFactBinding[]> {
    const rows = await this.prisma.platformEnumeration.findMany({
      where: {
        type: FACT_TYPE,
        active: true,
        deprecatedAt: null,
        boundQuestion: { isActive: true, type: { in: [...BINDABLE_QUESTION_TYPES] } },
      },
      orderBy: [{ sortOrder: 'asc' }, { key: 'asc' }],
      select: { key: true, boundQuestion: { select: { code: true, type: true } } },
    });
    return rows.flatMap((row) => {
      const q = row.boundQuestion;
      // Unreachable given the `where` above; narrowed rather than asserted, because a
      // `!` here would turn a future query edit into a runtime crash on the quote path.
      if (!q || !isBindableQuestionType(q.type)) return [];
      return [{ key: row.key, questionCode: q.code, type: q.type }];
    });
  }

  /**
   * Every catalog program name's income rule. Uncached by contract — see the abstract.
   *
   * DEPRECATED names are included on purpose. A program filed under a name that was
   * later deprecated still quotes, and dropping the rule here would take its table away
   * mid-flight — the deprecation is a signal to stop filing NEW programs under it, not
   * an instruction to blank the income of the ones already there.
   */
  async programNameIncomeRules(): Promise<ReadonlyMap<string, IncomeAssumptionConfig>> {
    const rows = await this.prisma.platformEnumeration.findMany({
      where: { type: 'program_name' },
      select: { key: true, incomeRule: true },
    });
    // Filtered here rather than in the WHERE: the JSONB column can hold SQL NULL
    // (`Prisma.DbNull`) or the JSON literal `null` (`Prisma.JsonNull`), and both mean
    // "no rule". One predicate in TypeScript catches both; the Prisma filter needs the
    // right one of the two sentinels, and picking the wrong one fails open — every name
    // reads as ruled, and a `null` blob reaches the merge as a rule.
    return new Map(
      rows.flatMap((row) =>
        row.incomeRule === null || typeof row.incomeRule !== 'object'
          ? []
          : [[row.key, row.incomeRule as unknown as IncomeAssumptionConfig] as const],
      ),
    );
  }

  async enumerationParentKeys(): Promise<Readonly<Record<string, string>>> {
    const rows = await this.prisma.platformEnumeration.findMany({
      // ACTIVE only, and `parentKey` non-null: a deprecated value must not go on carrying
      // an applicant to a cap row, and a value filed under nothing has no parent to give —
      // the rule then reports `no_matching_row`, a stated reason, rather than a guess.
      where: { active: true, deprecatedAt: null, parentKey: { not: null } },
      select: { key: true, parentKey: true },
    });
    const map: Record<string, string> = {};
    for (const row of rows) {
      if (row.parentKey !== null) map[row.key] = row.parentKey;
    }
    return map;
  }

  async findProgramName(key: string): Promise<ProgramNameIncomeRuleRow | null> {
    const row = await this.prisma.platformEnumeration.findUnique({
      where: { idx_platform_enumeration_type_key: { type: 'program_name', key } },
      select: {
        id: true,
        key: true,
        labelAr: true,
        labelEn: true,
        incomeRule: true,
        valueSources: true,
      },
    });
    return row === null ? null : toProgramNameIncomeRuleRow(row);
  }

  async setProgramNameIncomeRule(
    key: string,
    rule: IncomeAssumptionConfig | null,
    valueSources: Record<string, 'team_estimated'>,
    updatedBy: string,
  ): Promise<ProgramNameIncomeRuleRow> {
    const row = await this.prisma.platformEnumeration.update({
      where: { idx_platform_enumeration_type_key: { type: 'program_name', key } },
      data: {
        // `Prisma.DbNull` writes SQL NULL — "nobody has decided". `Prisma.JsonNull`
        // would write the JSON literal `null`, which reads back as a present-but-null
        // rule and would make `programNameIncomeRules` filter it out for a different
        // reason each time the column is touched.
        incomeRule: rule === null ? Prisma.DbNull : (rule as unknown as Prisma.InputJsonValue),
        valueSources: valueSources as Prisma.InputJsonValue,
        updatedBy,
      },
      select: {
        id: true,
        key: true,
        labelAr: true,
        labelEn: true,
        incomeRule: true,
        valueSources: true,
      },
    });
    return toProgramNameIncomeRuleRow(row);
  }

  async programsUnderName(key: string): Promise<ProgramUnderName[]> {
    const rows = await this.prisma.bankProgram.findMany({
      where: { programNameKey: key, programType: BankProgramType.income_surrogate },
      select: { programCode: true, incomeAssumption: true },
      orderBy: { programCode: 'asc' },
    });
    return rows.map((row) => {
      const config = row.incomeAssumption as unknown as IncomeAssumptionConfig;
      return {
        programCode: row.programCode,
        // Normalized, because the stored blob may be legacy and the caller compares
        // this against a canonical strategy. An un-normalized read would report a
        // legacy program as reading something the catalog never states.
        strategy: normalizeIncomeAssumption(config).strategy,
        ownAmounts: !inheritsCatalogAmounts(config),
      };
    });
  }

  /**
   * Point a fact at a question, or unbind it (`null`).
   *
   * Takes the question CODE — what the operator picked and what every other surface
   * speaks — and resolves it here, so no caller has to hold a question id. An unknown
   * code is a validation failure the SERVICE raises with a typed error; returning
   * `null` here would let a typo silently unbind a live fact.
   */
  async setBoundQuestion(
    id: string,
    questionCode: string | null,
    updatedBy: string,
  ): Promise<EnumerationRow> {
    let boundQuestionId: string | null = null;
    if (questionCode !== null) {
      const question = await this.prisma.question.findUnique({
        where: { code: questionCode },
        select: { id: true },
      });
      if (!question) throw new Error(`question '${questionCode}' does not exist`);
      boundQuestionId = question.id;
    }
    const row = await this.prisma.platformEnumeration.update({
      where: { id },
      data: { boundQuestionId, updatedBy },
    });
    return toEnumerationRow(row);
  }

  /**
   * A question's ACTIVE option codes, in display order — the keys a fact's key table
   * may carry.
   *
   * Inactive options are excluded: an option that has left the questionnaire can no
   * longer be answered, so a table row keyed by it is dead weight the save should
   * refuse, exactly as `isActiveMember` refuses a retired enumeration key.
   */
  async questionOptionCodes(questionCode: string): Promise<string[]> {
    const rows = await this.prisma.questionOption.findMany({
      where: { question: { code: questionCode }, isActive: true },
      orderBy: [{ displayOrder: 'asc' }, { code: 'asc' }],
      select: { code: true },
    });
    return rows.map((r) => r.code);
  }

  /**
   * Every fact's bound question, keyed by enumeration id — what the admin list needs
   * to render a fact row.
   *
   * One query for the page, like `categoryAssignments` and `questionAssignments`, not
   * one per row. Includes INACTIVE facts and inactive questions: this is the screen
   * where a broken binding gets fixed, so filtering either out would hide exactly the
   * rows the operator came for.
   */
  async boundQuestions(filter?: { type?: string }): Promise<Map<string, BoundQuestion>> {
    const rows = await this.prisma.platformEnumeration.findMany({
      where: {
        ...(filter?.type ? { type: filter.type } : { type: FACT_TYPE }),
        boundQuestionId: { not: null },
      },
      select: { id: true, boundQuestion: { select: BOUND_QUESTION_SELECT } },
    });
    const out = new Map<string, BoundQuestion>();
    for (const row of rows) {
      const q = row.boundQuestion;
      // A bound question of an unbindable type is reported as UNBOUND rather than
      // rendered: the fact is equally unpriceable either way, and the engine's registry
      // read drops it for the same reason.
      if (!q || !isBindableQuestionType(q.type)) continue;
      out.set(row.id, {
        id: q.id,
        code: q.code,
        type: q.type,
        labelAr: q.questionAr,
        labelEn: q.questionEn,
        active: q.isActive,
        options: q.options,
        askedIn: sortCategories(q.loanCategories.map((c) => c.category)),
      });
    }
    return out;
  }

  /** One question by code, as the fact-binding validation needs to judge it. */
  async findBindableQuestion(code: string): Promise<{
    code: string;
    type: string;
    isActive: boolean;
  } | null> {
    return this.prisma.question.findUnique({
      where: { code },
      select: { code: true, type: true, isActive: true },
    });
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
  async countProgramNameUsage(): Promise<Map<string, ProgramNameUsage>> {
    const rows = await this.prisma.bankProgram.findMany({
      where: { programNameKey: { not: null } },
      select: {
        programNameKey: true,
        bankId: true,
        programType: true,
        productCategory: true,
        incomeAssumption: true,
      },
    });
    const acc = new Map<
      string,
      {
        programs: number;
        banks: Set<string>;
        noPayslip: number;
        withoutTable: number;
        byCategory: Partial<Record<LoanCategory, IncomeBasisCount>>;
      }
    >();
    for (const r of rows) {
      const key = r.programNameKey;
      if (!key) continue;
      const entry = acc.get(key) ?? {
        programs: 0,
        banks: new Set<string>(),
        noPayslip: 0,
        withoutTable: 0,
        byCategory: {},
      };
      entry.programs += 1;
      if (r.bankId) entry.banks.add(r.bankId);
      // The per-category split the catalog name's tabs render. Keyed off the same
      // `programType` as the totals below, in the same pass, so the tab and the board
      // can never disagree about one program.
      const category = asLoanCategory(r.productCategory);
      if (category) {
        const cell = entry.byCategory[category] ?? { payslip: 0, noPayslip: 0 };
        if (r.programType === BankProgramType.income_surrogate) cell.noPayslip += 1;
        else cell.payslip += 1;
        entry.byCategory[category] = cell;
      }
      // The PROGRAM's own type, not its loan category (v16.0.0). This used to gate on
      // the no-payslip CATEGORY, so dropping that category would have made the number
      // read 0 for every name and killed the one warning an operator acts on — while
      // the three live `personal` + `income_surrogate` programs stayed unconfigured.
      if (r.programType === BankProgramType.income_surrogate) {
        entry.noPayslip += 1;
        // "No table" is a contradiction INSIDE one program: its rule says the income is
        // worked out from a fact about the applicant, and the table that does the working
        // out is empty. Such a program quotes nothing, to every applicant, in silence.
        //
        // Read off the program alone. It used to also require the catalog NAME to be
        // ticked for a fact — a second, hand-maintained claim that no quote, publish
        // check or save validation ever read, and the ticks are gone with it.
        //
        // `strategy: 'declared'` is deliberately NOT counted: on a surrogate program it
        // is a legitimate configuration that business and professional programs carry on
        // purpose (the type marks the lane; the applicant's stated salary is the figure).
        // Flagging those would put correctly-configured programs on a warning list an
        // operator has no way to clear.
        if (readsAFactWithNoTable(r.incomeAssumption)) entry.withoutTable += 1;
      }
      acc.set(key, entry);
    }
    return new Map(
      [...acc].map(([key, v]) => [
        key,
        {
          programs: v.programs,
          banks: v.banks.size,
          noPayslipPrograms: v.noPayslip,
          noPayslipProgramsWithoutTable: v.withoutTable,
          byCategory: v.byCategory,
        },
      ]),
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
        // The basis rides on the same assignment row, written with it: a name that
        // exists for even one round-trip with no basis would read on the catalog as
        // one nobody has decided anything about.
        loanCategories: input.categories?.length
          ? {
              createMany: {
                data: input.categories.map((category) => ({
                  category,
                  ...flagsOfBases(input.incomeBases ?? ['payslip']),
                })),
              },
            }
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
   * Every assignment row's income BASES, keyed by enumeration id then category —
   * the sibling of `categoryAssignments`, read the same way and for the same
   * screen (the catalog list needs "which of these are meant to be sold without a
   * payslip" for all 16 names at once).
   *
   * Separate method rather than a widened return on `categoryAssignments`: that
   * one is also what the assignment board diffs for its audit payload, and a
   * shape change there would ripple into the audit log.
   */
  async incomeBasisAssignments(filter?: {
    type?: string;
  }): Promise<Map<string, IncomeBasesByCategory>> {
    const rows = await this.prisma.platformEnumerationLoanCategory.findMany({
      where: filter?.type ? { enumeration: { type: filter.type } } : undefined,
      select: { enumerationId: true, category: true, payslip: true, noPayslip: true },
    });
    const map = new Map<string, IncomeBasesByCategory>();
    for (const row of rows) {
      let byCategory = map.get(row.enumerationId);
      if (!byCategory) {
        byCategory = {};
        map.set(row.enumerationId, byCategory);
      }
      byCategory[row.category] = basesOfFlags(row);
    }
    return map;
  }

  /** One entry's bases per assigned category — what the detail screen's tabs read. */
  async incomeBasesOf(enumerationId: string): Promise<IncomeBasesByCategory> {
    const rows = await this.prisma.platformEnumerationLoanCategory.findMany({
      where: { enumerationId },
      select: { category: true, payslip: true, noPayslip: true },
    });
    const byCategory: IncomeBasesByCategory = {};
    for (const row of rows) byCategory[row.category] = basesOfFlags(row);
    return byCategory;
  }

  /**
   * Replace ONE pair's income basis. `updateMany` rather than `update`, so an
   * unassigned pair comes back as `0` for the service to reject instead of
   * throwing a Prisma not-found — and so this can never CREATE an assignment as a
   * side effect of setting a basis. Offering a name under a category is a
   * different decision, made on a different control.
   */
  async setIncomeBases(
    enumerationId: string,
    category: LoanCategory,
    bases: readonly IncomeBasis[],
  ): Promise<number> {
    const { count } = await this.prisma.platformEnumerationLoanCategory.updateMany({
      where: { enumerationId, category },
      data: flagsOfBases(bases),
    });
    return count;
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
      // Delete-then-insert would reset the income basis of every SURVIVING pair to
      // the column default, so a name offered under Personal + Car that loses Car
      // would quietly stop being sold without a payslip under Personal too. The
      // basis is carried across; only genuinely new pairs take the default.
      const before = await tx.platformEnumerationLoanCategory.findMany({
        where: { enumerationId },
        select: { category: true, payslip: true, noPayslip: true },
      });
      const kept = new Map(
        before.map((r) => [r.category, { payslip: r.payslip, noPayslip: r.noPayslip }]),
      );
      await tx.platformEnumerationLoanCategory.deleteMany({ where: { enumerationId } });
      if (categories.length === 0) return;
      await tx.platformEnumerationLoanCategory.createMany({
        data: categories.map((category) => ({
          enumerationId,
          category,
          ...(kept.get(category) ?? flagsOfBases(['payslip'])),
        })),
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
        // Carried across exactly as in `setCategories` — a column action on the
        // board must not silently re-set the basis of pairs it keeps.
        const before = await tx.platformEnumerationLoanCategory.findMany({
          where: { enumerationId: a.enumerationId },
          select: { category: true, payslip: true, noPayslip: true },
        });
        const kept = new Map(
          before.map((r) => [r.category, { payslip: r.payslip, noPayslip: r.noPayslip }]),
        );
        await tx.platformEnumerationLoanCategory.deleteMany({
          where: { enumerationId: a.enumerationId },
        });
        if (a.categories.length === 0) continue;
        await tx.platformEnumerationLoanCategory.createMany({
          data: a.categories.map((category) => ({
            enumerationId: a.enumerationId,
            category,
            ...(kept.get(category) ?? flagsOfBases(['payslip'])),
          })),
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

  /**
   * Everything that still names a `program_name` key — the check a hard delete
   * hangs on.
   *
   * Counted, not joined: neither column carries an FK (the catalog's unique key is
   * the composite `(type, key)`, so Postgres cannot enforce this), which is exactly
   * why the count has to exist in code. Applications count as much as programs: a
   * stored application uses the key to explain which programs it was narrowed to,
   * and deleting the row underneath it makes that explanation unrecoverable.
   *
   * Both reads live here rather than in their own feature repositories for the
   * same reason `countProgramNameUsage` does — bank-programs already depends on
   * this module, so importing back would close a cycle.
   */
  async countProgramNameReferences(key: string): Promise<{
    programs: number;
    applications: number;
  }> {
    const [programs, applications] = await Promise.all([
      this.prisma.bankProgram.count({ where: { programNameKey: key } }),
      this.prisma.application.count({ where: { programNameKey: key } }),
    ]);
    return { programs, applications };
  }

  /**
   * Everywhere a value of `type` is still named, per referencing surface — the
   * check EVERY hard delete hangs on, not just the catalog's.
   *
   * `null` means "this type's references cannot be counted", which is a refusal,
   * not zero. The distinction is the whole point: no enumeration key carries an FK
   * anywhere (the registry's unique key is the composite `(type, key)`), so Postgres
   * will happily delete a row half the platform still reads. A type whose readers
   * are not enumerated here must therefore be refused rather than guessed at — the
   * ghost rows A26 forbids.
   *
   * Every read lives here rather than in the owning feature's repository for the
   * same reason `countProgramNameUsage` does: bank-programs already depends on this
   * module, so importing back would close a cycle.
   */
  async countReferences(
    type: EnumerationType,
    key: string,
  ): Promise<EnumerationReference[] | null> {
    switch (type) {
      case 'program_name': {
        const refs = await this.countProgramNameReferences(key);
        return [
          { source: 'bank_program', count: refs.programs },
          { source: 'application', count: refs.applications },
        ];
      }
      case 'product_category': {
        const programs = await this.prisma.bankProgram.count({
          where: { productCategory: key },
        });
        return [{ source: 'bank_program', count: programs }];
      }
      case 'required_document': {
        // Two surfaces with different consequences: a program DEMANDS the key,
        // an uploaded document IS one. Deleting under either leaves a string
        // nothing can render a label for.
        const [programs, documents] = await Promise.all([
          this.prisma.bankProgram.count({ where: { requiredDocuments: { has: key } } }),
          this.prisma.document.count({ where: { documentType: key } }),
        ]);
        return [
          { source: 'bank_program', count: programs },
          { source: 'document', count: documents },
        ];
      }
      case 'governorate': {
        const customers = await this.prisma.customerAccount.count({ where: { governorate: key } });
        return [{ source: 'customer', count: customers }];
      }
      case 'employment_type': {
        const programs = await this.prisma.bankProgram.count({
          where: {
            eligibility: {
              path: ['acceptedEmploymentTypes'],
              array_contains: key,
            } as Prisma.JsonFilter,
          },
        });
        return [{ source: 'bank_program', count: programs }];
      }
      case 'transfer_type': {
        // BOTH spellings, because `normalizeEligibility` still reads the legacy
        // `acceptedTransferTypes` — counting only the current one would report a
        // program the engine actively filters on as not using the key at all.
        const programs = await this.prisma.bankProgram.count({
          where: {
            OR: [
              {
                eligibility: {
                  path: ['acceptedSalaryTransferTypes'],
                  array_contains: key,
                } as Prisma.JsonFilter,
              },
              {
                eligibility: {
                  path: ['acceptedTransferTypes'],
                  array_contains: key,
                } as Prisma.JsonFilter,
              },
            ],
          },
        });
        return [{ source: 'bank_program', count: programs }];
      }
      case 'surrogate_fact': {
        // A fact is named by the income rule's STRATEGY TOKEN, not by a column:
        // `fact:<key>` is how a bank's table says which figure it reads.
        const programs = await this.prisma.bankProgram.count({
          where: {
            incomeAssumption: {
              path: ['strategy'],
              equals: factStrategy(key),
            } as Prisma.JsonFilter,
          },
        });
        return [{ source: 'bank_program', count: programs }];
      }
      default:
        return null;
    }
  }

  /**
   * Hard delete. `platform_enumeration_loan_category` and
   * `platform_enumeration_question` cascade with the row (both declare
   * `onDelete: Cascade`), so this is one statement and leaves no orphan
   * assignment behind.
   *
   * Callers check references FIRST — see `countReferences`. Nothing at this layer
   * can refuse the delete, because nothing here knows what the key is worth.
   */
  async deleteById(id: string): Promise<void> {
    await this.prisma.platformEnumeration.delete({ where: { id } });
  }

  static readonly KNOWN_TYPES = ALL_TYPES;
}

/**
 * A program whose rule reads a FACT about the applicant but carries no table to read
 * it with — the state in which it produces no income figure at all.
 *
 * "Reads a fact" is either of the two token families: the four frozen built-in methods
 * (`byMilitaryGrade` &c., which name a question in `SURROGATE_FACTS_BY_STRATEGY`) and
 * the registry's `fact:<key>`. Every other method reads a profile field or a scalar and
 * has nothing to key a table by, so an empty table is not a gap for them.
 *
 * Reads the JSON defensively: the column is `Json`, so anything could be in it, and an
 * unreadable blob is NOT counted rather than throwing on a list read.
 */
function readsAFactWithNoTable(rule: unknown): boolean {
  if (!rule || typeof rule !== 'object') return false;
  const r = rule as { strategy?: unknown; keyTable?: unknown; bands?: unknown };
  if (typeof r.strategy !== 'string') return false;
  const readsAFact =
    factKeyOf(r.strategy) !== null || (SURROGATE_FACTS_BY_STRATEGY[r.strategy]?.length ?? 0) > 0;
  if (!readsAFact) return false;
  const rows = Array.isArray(r.keyTable) ? r.keyTable.length : 0;
  const bands = Array.isArray(r.bands) ? r.bands.length : 0;
  return rows === 0 && bands === 0;
}

// ---- Boundary mapper (Prisma row -> domain row) --------------------------

/**
 * The selected columns → the domain row. `incomeRule` collapses BOTH JSON nulls
 * (SQL NULL and the literal `null`) to `null`, and a non-object blob with them: the
 * column is only ever written by this repository, but a hand-run SQL fix is exactly
 * the case where "no rule" must not read as a rule.
 */
function toProgramNameIncomeRuleRow(row: {
  id: string;
  key: string;
  labelAr: string;
  labelEn: string;
  incomeRule: unknown;
  valueSources: unknown;
}): ProgramNameIncomeRuleRow {
  return {
    id: row.id,
    key: row.key,
    labelAr: row.labelAr,
    labelEn: row.labelEn,
    incomeRule:
      row.incomeRule === null || typeof row.incomeRule !== 'object'
        ? null
        : (row.incomeRule as IncomeAssumptionConfig),
    valueSources: (row.valueSources ?? {}) as Record<string, 'team_estimated'>,
  };
}

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

/** Every relation is optional so callers that don't `include` them still map. */
type PlatformEnumerationWithCategories = PlatformEnumeration & {
  loanCategories?: { category: LoanCategory; payslip?: boolean; noPayslip?: boolean }[];
  boundQuestion?: {
    id: string;
    code: string;
    type: QuestionType;
    questionAr: string;
    questionEn: string;
    isActive: boolean;
    options: Array<{ code: string; labelAr: string; labelEn: string }>;
    loanCategories?: Array<{ category: LoanCategory }>;
  } | null;
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
    incomeBases: incomeBasesOfRows(row.loanCategories),
    boundQuestion: boundQuestionOf(row),
  };
}

/**
 * The bound question, as the admin needs to see it — including the two broken states.
 *
 * A question of an UNBINDABLE type (TEXT, MULTI_SELECT) cannot arrive through the write
 * path, which rejects it. It can still be read: an operator may change a bound
 * question's type on the questionnaire screen afterwards. Reported as unbound rather
 * than mapped, because a fact bound to a TEXT answer is exactly as unpriceable as a fact
 * bound to nothing, and the engine's registry read drops it for the same reason.
 */
function boundQuestionOf(row: PlatformEnumerationWithCategories): BoundQuestion | null | undefined {
  if (row.boundQuestion === undefined) return undefined;
  const q = row.boundQuestion;
  if (!q || !isBindableQuestionType(q.type)) return null;
  return {
    id: q.id,
    code: q.code,
    type: q.type as BindableQuestionType,
    labelAr: q.questionAr,
    labelEn: q.questionEn,
    active: q.isActive,
    options: q.options,
    askedIn: sortCategories((q.loanCategories ?? []).map((c) => c.category)),
  };
}

/**
 * Which candidate list covers the most of these keys — the one the keys most plausibly ARE.
 *
 * `null` when nothing matches. Ties break on the type name, so the answer does not depend on
 * row order in a `findMany`.
 */
function bestCovering(
  perType: Map<string, Map<string, string>>,
  keys: readonly string[],
): Map<string, string> | null {
  let best: { type: string; hits: number; map: Map<string, string> } | null = null;
  for (const [type, map] of [...perType.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    const hits = keys.reduce((n, k) => (map.has(k) ? n + 1 : n), 0);
    if (hits > 0 && (!best || hits > best.hits)) best = { type, hits, map };
  }
  return best?.map ?? null;
}

/** Same rule, over the parent rows: the list that holds most of the parents in hand. */
function bestCoveringRows(
  perType: Map<string, Array<{ key: string; labelAr: string; labelEn: string }>>,
  wanted: ReadonlySet<string>,
): Array<{ key: string; labelAr: string; labelEn: string }> | null {
  let best: { hits: number; rows: Array<{ key: string; labelAr: string; labelEn: string }> } | null =
    null;
  for (const [, rows] of [...perType.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    const hits = rows.reduce((n, r) => (wanted.has(r.key) ? n + 1 : n), 0);
    if (hits > 0 && (!best || hits > best.hits)) best = { hits, rows };
  }
  return best?.rows ?? null;
}

/**
 * The stored basis flags, per category — the catalog's statement of how the name is
 * MEANT to be sold. Read-only on the member: nothing in the bank-program write path
 * consults it, so it can never refuse a save (v16.4.0's point, kept).
 *
 * `undefined` when the relation was not included, so a caller that selected only the
 * category is told "unknown" rather than "described in no way". A row selected WITHOUT
 * the two boolean columns is treated the same way, for the same reason.
 */
function incomeBasesOfRows(
  rows: { category: LoanCategory; payslip?: boolean; noPayslip?: boolean }[] | undefined,
): IncomeBasesByCategory | undefined {
  if (rows === undefined) return undefined;
  const out: IncomeBasesByCategory = {};
  for (const row of rows) {
    if (row.payslip === undefined || row.noPayslip === undefined) return undefined;
    out[row.category] = basesOfFlags({ payslip: row.payslip, noPayslip: row.noPayslip });
  }
  return out;
}
