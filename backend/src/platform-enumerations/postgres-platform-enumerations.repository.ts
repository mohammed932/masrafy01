import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { BankProgramType, Prisma } from '@prisma/client';
import type { LoanCategory, PlatformEnumeration, QuestionType } from '@prisma/client';
import { normalizeIncomeAssumption } from '@/matching/pipeline/income-rule-normalize';
import {
  effectiveProgramNameRule,
  inheritsCatalogAmounts,
} from '@/matching/pipeline/income-rule-inherit';
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
  childTypesOf,
  isDeletableType,
  type BindableQuestionType,
  type BoundQuestion,
  type EnumerationQuestionTemplate,
  type IncomeBasesByCategory,
  type ParentKeyMove,
  type ProgramNameIncomeRuleRow,
  type ProgramUnderName,
  type SurrogateProductListRow,
  type QuestionCodesByCategory,
  type SurrogateFactBinding,
  type EnumerationTypeDefinition,
  type EnumerationTypeDefinitions,
} from './platform-enumerations.repository';
import type { EnumerationTypeDef } from '@prisma/client';

/** Prisma row → the domain shape, keeping Prisma's type out of the service layer (A8). */
function toTypeDefinition(row: EnumerationTypeDef): EnumerationTypeDefinition {
  return {
    key: row.key,
    labelAr: row.labelAr,
    labelEn: row.labelEn,
    descriptionAr: row.descriptionAr,
    descriptionEn: row.descriptionEn,
    icon: row.icon,
    exampleAr: row.exampleAr,
    exampleEn: row.exampleEn,
    parentTypeKey: row.parentTypeKey,
    deletable: row.deletable,
    onValuesRail: row.onValuesRail,
    systemOnly: row.systemOnly,
    active: row.active,
    sortOrder: row.sortOrder,
    surrogateProductKey: row.surrogateProductKey,
    mirrorQuestionId: row.mirrorQuestionId,
  };
}

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
  /**
   * `program_name` only — the surrogate product the new name links to. Resolved by the
   * service against live products before it gets here; `null`/omitted = states its own rule.
   */
  surrogateProductKey?: string | null;
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
  /**
   * Whether a row of this type can be hard-deleted at all.
   *
   * A delete is only offered where `countReferences` can enumerate every reader — no
   * enumeration key carries a foreign key, so a type whose readers are not enumerated would
   * be deleted into a dangle. Served so the admin can withhold the button instead of
   * rendering one that always answers 422.
   */
  deletable: boolean;
  /**
   * The KIND's definition, or `null` for a type that has rows but no definition row.
   *
   * `null` is reachable only on a database where something wrote a type outside the admin
   * API after the registry migration ran. Served rather than hidden: the operator can see
   * the orphan and name it, which is the only way to fix it — dropping it from the list
   * would make rows exist that no screen admits to.
   */
  definition: EnumerationTypeDefinition | null;
}

/**
 * The BUILTIN types `countReferences` has a bespoke counting branch for.
 *
 * No longer the delete gate — that moved to `enumeration_type_def.deletable`, seeded from
 * exactly this list by `20260826090000_enumeration_type_registry`, so day-one behaviour is
 * unchanged. What is left here is narrower and still code's business: which types the
 * `switch` below can count references for by NAME, because each needs a query against a
 * different table.
 *
 * A kind created by an operator has no branch and cannot: nothing in the platform reads it
 * by name, so its only references are its own children, which `countGenericReferences`
 * counts generically.
 *
 * Everything else (compounds, compound classes, and the ranks and grades a stored income rule
 * is keyed by) is retired by deactivating it, which is reversible and leaves the key readable
 * wherever it is still stored.
 */
export const BUILTIN_REFERENCE_COUNTED_TYPES: readonly EnumerationType[] = [
  'program_name',
  'product_category',
  'required_document',
  'governorate',
  'employment_type',
  'transfer_type',
  'surrogate_fact',
];

/** How long a kind's definition is cached. Same window as the member cache. */
const TYPE_DEF_TTL_MS = 60_000;

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
  surrogateProductKey: string | null;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

/** Domain patch for `updateById` — translated to Prisma update input inside the repo. */
export interface EnumerationUpdatePatch {
  labelAr?: string;
  labelEn?: string;
  parentKey?: string | null;
  /**
   * Absent = leave the link alone, `null` = unlink, a key = link. All three reach here;
   * the service has already validated the key against live products.
   */
  surrogateProductKey?: string | null;
  sortOrder?: number;
  active?: boolean;
  /** When `true` AND `deprecatedAt` is currently null, the repository stamps `deprecatedAt = now`
   *  and forces `active = false`. */
  deprecate?: true;
  updatedBy: string;
}

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

/**
 * One JSONB blob → a rule, or `undefined`.
 *
 * Filtered in TypeScript rather than in the WHERE: the column can hold SQL NULL
 * (`Prisma.DbNull`) or the JSON literal `null` (`Prisma.JsonNull`), and both mean "no
 * rule". One predicate catches both; the Prisma filter needs the right one of the two
 * sentinels, and picking the wrong one fails OPEN — every row reads as ruled and a
 * `null` blob reaches the merge as a rule.
 *
 * Shared by the name read and the product read so the two cannot come to disagree
 * about what an empty rule looks like.
 */
function asIncomeRule(value: unknown): IncomeAssumptionConfig | undefined {
  if (value === null || typeof value !== 'object') return undefined;
  return value as IncomeAssumptionConfig;
}

/** The `payslip` / `noPayslip` pair as one assignment row stores it. */
type BasisFlags = { payslip: boolean; noPayslip: boolean };

/**
 * The basis a pair is BORN with, when the write is offering the name somewhere it
 * was not offered before.
 *
 * Three answers, in order, and the third is the one that changed. A create no longer
 * assigns any loan category (see `PlatformEnumerationsAdminService.create`), so the
 * FIRST pair a name ever gets is written by this function rather than by the create —
 * and a flat `['payslip']` there would have told the catalog that a name the operator
 * just linked to a surrogate product is sold against a payslip. The link is the row's
 * own column and is decided at create time, so it is the honest source for a pair that
 * has nothing else to inherit from.
 *
 *   1. the pair already existed → keep exactly what it held (a delete-then-insert must
 *      not re-set the basis of a pair the operator kept);
 *   2. some OTHER pair on the same name exists → inherit it. The dialog writes the basis
 *      flat across every loan type, so "what this name is sold as" is one answer, and a
 *      newly offered loan type joining at a different one would be a second answer nobody
 *      gave;
 *   3. nothing to inherit → derived from the surrogate-product link.
 */
function bornBasisFlags(
  before: ReadonlyMap<LoanCategory, BasisFlags>,
  category: LoanCategory,
  linkedToProduct: boolean,
): BasisFlags {
  const kept = before.get(category);
  if (kept) return kept;
  for (const sibling of before.values()) return sibling;
  return flagsOfBases(linkedToProduct ? ['no_payslip'] : ['payslip']);
}

@Injectable()
export class PostgresPlatformEnumerationsRepository
  extends PlatformEnumerationsRepository
  implements OnModuleInit
{
  private readonly logger = new Logger(PostgresPlatformEnumerationsRepository.name);
  private readonly cache: Map<string, CacheEntry> = new Map();
  /** One entry for the whole KIND registry — it is read as a set, never per key. */
  private typeDefCache: { defs: EnumerationTypeDefinitions; expiresAt: number } | null = null;

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

  async isActiveMember(type: string, key: string): Promise<boolean> {
    const row = await this.prisma.platformEnumeration.findUnique({
      where: { idx_platform_enumeration_type_key: { type, key } },
      select: { active: true, deprecatedAt: true },
    });
    return Boolean(row && row.active && row.deprecatedAt === null);
  }

  async isDeprecatedMember(type: string, key: string): Promise<boolean> {
    const row = await this.prisma.platformEnumeration.findUnique({
      where: { idx_platform_enumeration_type_key: { type, key } },
      select: { deprecatedAt: true },
    });
    return Boolean(row && row.deprecatedAt !== null);
  }

  async getActiveMembers(type: string): Promise<EnumerationMember[]> {
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
    // Facts are the only type whose members bind a question, so only they can have a
    // parent list to derive. Gated here rather than inside, so no other type's read — the
    // questionnaire's and the mobile app's included — pays for the walk at all.
    if (type === FACT_TYPE) await this.attachOptionProvenance(members);
    this.cache.set(type, { members, expiresAt: Date.now() + CACHE_TTL_MS });
    return members;
  }

  /**
   * Fill each bound question's option PROVENANCE: which operator-managed list its options
   * come from, which list those are filed under, and the members of that parent list.
   *
   * All three derived on read and none of them stored — see `BoundQuestion` for why a
   * stored column would be a third statement of a twice-stated fact, on the wrong row.
   *
   * Resolved through `enumerationParentKeys()`, the SAME map a `factParentTable` step is
   * evaluated against, rather than through a second walk with its own idea of which list a
   * `parentKey` points into. That matters more than it looks: an inference here that
   * disagreed with the engine would offer the operator a class to state figures against and
   * then answer `no_matching_row` for every applicant who picked a value filed under it.
   *
   * Called only for the fact type, and only when a member actually binds an option list, so
   * the customer-facing enumeration reads pay nothing for it.
   */
  private async attachOptionProvenance(members: EnumerationMember[]): Promise<void> {
    const withOptions = members.filter((m) => (m.boundQuestion?.options?.length ?? 0) > 0);
    if (withOptions.length === 0) return;

    await this.attachOptionsEnumerationType(withOptions);

    const parentOf = await this.enumerationParentKeys();
    const wanted = new Set<string>();
    for (const m of withOptions) {
      for (const o of m.boundQuestion?.options ?? []) {
        const parent = parentOf[o.code];
        if (parent !== undefined) wanted.add(parent);
      }
    }
    if (wanted.size === 0) return;

    // Ordered once, then filtered per fact, so every fact's list reads in registry order.
    // `key` is unique per TYPE, so a key held by two lists yields two rows; the first under
    // this deterministic order labels it — a label, never a membership decision, because the
    // membership was already decided by the flat map above.
    const rows = await this.prisma.platformEnumeration.findMany({
      where: { key: { in: [...wanted] }, active: true, deprecatedAt: null },
      orderBy: [{ sortOrder: 'asc' }, { type: 'asc' }, { key: 'asc' }],
      // `type` was already being SORTED by here and thrown away. Selecting it is what
      // lets a screen say WHICH list to add a missing class to, rather than only that a
      // class is missing.
      select: { key: true, labelAr: true, labelEn: true, type: true },
    });
    if (rows.length === 0) return;

    const seen = new Set<string>();
    const ordered = rows.filter((r) => (seen.has(r.key) ? false : (seen.add(r.key), true)));

    for (const m of withOptions) {
      const mine = new Set<string>();
      for (const o of m.boundQuestion?.options ?? []) {
        const parent = parentOf[o.code];
        if (parent !== undefined) mine.add(parent);
      }
      if (mine.size === 0) continue;
      const bound = m.boundQuestion;
      if (!bound) continue;
      const mineRows = ordered.filter((r) => mine.has(r.key));
      bound.parentOptions = mineRows.map((r) => ({
        code: r.key,
        labelAr: r.labelAr,
        labelEn: r.labelEn,
      }));
      // Same rule as the child type: one type or none. Parents drawn from two lists is
      // not a list an operator can be sent to.
      const parentTypes = new Set(mineRows.map((r) => r.type));
      if (parentTypes.size === 1) bound.parentEnumerationType = [...parentTypes][0];
    }
  }

  /**
   * Which list each bound question's options came from, by COVERAGE.
   *
   * One query over every option code across every fact, then per fact: the type whose
   * active rows cover ALL of that fact's option codes. Coverage-of-all rather than
   * best-match, because a partial match is exactly the case where an answer to the
   * question has no row in the list — offering the operator that list to edit would
   * suggest the missing values are editable there when they are not.
   *
   * A code held by two types leaves the answer AMBIGUOUS, and ambiguous resolves to
   * nothing: naming one of them would be a coin-flip rendered as a fact.
   */
  private async attachOptionsEnumerationType(members: EnumerationMember[]): Promise<void> {
    const codes = new Set<string>();
    for (const m of members) for (const o of m.boundQuestion?.options ?? []) codes.add(o.code);
    if (codes.size === 0) return;

    const rows = await this.prisma.platformEnumeration.findMany({
      where: { key: { in: [...codes] }, active: true, deprecatedAt: null },
      select: { key: true, type: true },
    });
    if (rows.length === 0) return;

    const typesByCode = new Map<string, Set<string>>();
    for (const r of rows) {
      const set = typesByCode.get(r.key);
      if (set) set.add(r.type);
      else typesByCode.set(r.key, new Set([r.type]));
    }

    for (const m of members) {
      const options = m.boundQuestion?.options ?? [];
      if (options.length === 0) continue;

      // Start from the candidates for the first option and intersect down. A type that
      // survives every option is one that covers the whole question.
      let candidates = new Set<string>();
      let first = true;
      let covered = true;
      for (const o of options) {
        const forCode = typesByCode.get(o.code);
        if (forCode === undefined) {
          covered = false;
          break;
        }
        const next: Set<string> = first
          ? new Set<string>(forCode)
          : new Set<string>([...candidates].filter((t) => forCode.has(t)));
        candidates = next;
        first = false;
        if (candidates.size === 0) break;
      }

      // Exactly one, or nothing. Two surviving types means two lists both fully describe
      // this question, and there is no honest way to pick.
      if (covered && candidates.size === 1) {
        const bound = m.boundQuestion;
        if (bound) bound.optionsEnumerationType = [...candidates][0];
      }
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
   * Every catalog program name's income rule, resolved through the surrogate product
   * it links to. Uncached by contract — see the abstract.
   *
   * THE SINGLE SEAM for the product link. All five callers take this finished map and
   * either hand it to `toBankProgramSnapshot` or `.get()` from it, so resolving here
   * leaves the engine, the snapshot mapper and every caller untouched.
   *
   * DEPRECATED names are included on purpose. A program filed under a name that was
   * later deprecated still quotes, and dropping the rule here would take its table away
   * mid-flight — the deprecation is a signal to stop filing NEW programs under it, not
   * an instruction to blank the income of the ones already there.
   *
   * DEPRECATED PRODUCTS are included for exactly the same reason, and it is the more
   * important half: retiring an archetype must stop it being LINKED to, not stop the
   * names already linked from quoting. The refusal that guards this is
   * `SURROGATE_PRODUCT_IN_USE` at save time, not a filter at read time.
   */
  async programNameIncomeRules(): Promise<ReadonlyMap<string, IncomeAssumptionConfig>> {
    const rows = await this.prisma.platformEnumeration.findMany({
      where: { type: { in: ['program_name', 'surrogate_product'] } },
      select: { type: true, key: true, incomeRule: true, surrogateProductKey: true },
    });

    // TWO MAPS, keyed separately, and it has to be two. A name and the product it links
    // to deliberately share a key (`compound_owner` is both), because `(type, key)` is
    // the unique and reusing it makes every half-applied state impossible rather than
    // merely unlikely. One map keyed by `row.key` would let whichever row the driver
    // returned last silently win.
    const products = new Map<string, IncomeAssumptionConfig>();
    for (const row of rows) {
      if (row.type !== 'surrogate_product') continue;
      const rule = asIncomeRule(row.incomeRule);
      if (rule !== undefined) products.set(row.key, rule);
    }

    const resolved = new Map<string, IncomeAssumptionConfig>();
    for (const row of rows) {
      if (row.type !== 'program_name') continue;
      const rule = effectiveProgramNameRule(
        asIncomeRule(row.incomeRule),
        row.surrogateProductKey === null ? undefined : products.get(row.surrogateProductKey),
      );
      if (rule !== undefined) resolved.set(row.key, rule);
    }
    return resolved;
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

  /**
   * The columns an income-rule row is read through, for both types that carry one.
   *
   * One constant rather than two literals: the two reads must project the same shape or
   * the shared response mapper starts seeing a field on one and not the other.
   */
  private static readonly RULE_ROW_SELECT = {
    id: true,
    key: true,
    labelAr: true,
    labelEn: true,
    incomeRule: true,
    valueSources: true,
    surrogateProductKey: true,
  } as const;

  async findProgramName(key: string): Promise<ProgramNameIncomeRuleRow | null> {
    return this.findRuleRow('program_name', key);
  }

  /**
   * A surrogate product's own row. Same shape as a catalog name's, because it is the same
   * columns — which is the point: the archetype and the name that links to it hold the
   * calculation in one place and the migration moves it between them by copying.
   */
  async findSurrogateProduct(key: string): Promise<ProgramNameIncomeRuleRow | null> {
    return this.findRuleRow('surrogate_product', key);
  }

  private async findRuleRow(
    type: 'program_name' | 'surrogate_product',
    key: string,
  ): Promise<ProgramNameIncomeRuleRow | null> {
    const row = await this.prisma.platformEnumeration.findUnique({
      where: { idx_platform_enumeration_type_key: { type, key } },
      select: PostgresPlatformEnumerationsRepository.RULE_ROW_SELECT,
    });
    return row === null ? null : toProgramNameIncomeRuleRow(row);
  }

  async setProgramNameIncomeRule(
    key: string,
    rule: IncomeAssumptionConfig | null,
    valueSources: Record<string, 'team_estimated'>,
    updatedBy: string,
  ): Promise<ProgramNameIncomeRuleRow> {
    return this.setRuleRow('program_name', key, rule, valueSources, updatedBy);
  }

  /** A surrogate product's calculation — the archetype every linked name quotes off. */
  async setSurrogateProductIncomeRule(
    key: string,
    rule: IncomeAssumptionConfig | null,
    valueSources: Record<string, 'team_estimated'>,
    updatedBy: string,
  ): Promise<ProgramNameIncomeRuleRow> {
    return this.setRuleRow('surrogate_product', key, rule, valueSources, updatedBy);
  }

  private async setRuleRow(
    type: 'program_name' | 'surrogate_product',
    key: string,
    rule: IncomeAssumptionConfig | null,
    valueSources: Record<string, 'team_estimated'>,
    updatedBy: string,
  ): Promise<ProgramNameIncomeRuleRow> {
    const row = await this.prisma.platformEnumeration.update({
      where: { idx_platform_enumeration_type_key: { type, key } },
      data: {
        // `Prisma.DbNull` writes SQL NULL — "nobody has decided". `Prisma.JsonNull`
        // would write the JSON literal `null`, which reads back as a present-but-null
        // rule and would make `programNameIncomeRules` filter it out for a different
        // reason each time the column is touched.
        incomeRule: rule === null ? Prisma.DbNull : (rule as unknown as Prisma.InputJsonValue),
        valueSources: valueSources as Prisma.InputJsonValue,
        updatedBy,
      },
      select: PostgresPlatformEnumerationsRepository.RULE_ROW_SELECT,
    });
    return toProgramNameIncomeRuleRow(row);
  }

  /**
   * Every surrogate product, for the picker and the product list.
   *
   * INACTIVE ones included, flagged rather than filtered: a name already linked to a
   * retired product must still render as linked to something, or its screen says the
   * calculation came from nowhere. Callers that are offering a CHOICE filter to active.
   */
  async listSurrogateProducts(): Promise<SurrogateProductListRow[]> {
    // `incomeRule` rides along, and `usedBy` comes from ONE grouped read of the link column
    // rather than a query per product: the list page renders every product with the proof it
    // reads and the names that sell it, and asking per row made that 2N+1 round trips.
    const [rows, links] = await Promise.all([
      this.prisma.platformEnumeration.findMany({
        where: { type: 'surrogate_product' },
        orderBy: [{ sortOrder: 'asc' }, { key: 'asc' }],
        select: {
          key: true,
          labelAr: true,
          labelEn: true,
          active: true,
          sortOrder: true,
          incomeRule: true,
        },
      }),
      this.prisma.platformEnumeration.findMany({
        where: { type: 'program_name', surrogateProductKey: { not: null } },
        orderBy: { key: 'asc' },
        select: { key: true, surrogateProductKey: true },
      }),
    ]);

    const usedBy = new Map<string, string[]>();
    for (const l of links) {
      if (l.surrogateProductKey === null) continue;
      const list = usedBy.get(l.surrogateProductKey);
      if (list) list.push(l.key);
      else usedBy.set(l.surrogateProductKey, [l.key]);
    }

    return rows.map((r) => ({
      key: r.key,
      labelAr: r.labelAr,
      labelEn: r.labelEn,
      active: r.active,
      sortOrder: r.sortOrder,
      incomeRule: asIncomeRule(r.incomeRule) ?? null,
      usedBy: usedBy.get(r.key) ?? [],
    }));
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
  async memberCategories(type: string, key: string): Promise<LoanCategory[]> {
    const rows = await this.prisma.platformEnumerationLoanCategory.findMany({
      where: { enumeration: { type, key } },
      select: { category: true },
    });
    return sortCategories(rows.map((r) => r.category));
  }

  invalidateCache(type?: string): void {
    if (type) this.cache.delete(type);
    else this.cache.clear();
  }

  // ---- The KIND registry -------------------------------------------------

  async typeDefinitions(): Promise<EnumerationTypeDefinitions> {
    const now = Date.now();
    const cached = this.typeDefCache;
    if (cached && cached.expiresAt > now) return cached.defs;

    const rows = await this.prisma.enumerationTypeDef.findMany({
      orderBy: [{ sortOrder: 'asc' }, { key: 'asc' }],
    });
    const defs = new Map<string, EnumerationTypeDefinition>();
    for (const row of rows) defs.set(row.key, toTypeDefinition(row));
    this.typeDefCache = { defs, expiresAt: now + TYPE_DEF_TTL_MS };
    return defs;
  }

  /**
   * Dropped on EVERY kind write, never per key: `parentTypeKey` is a relation between two
   * kinds, so a single edit changes what `childTypesOf` answers for the OTHER one too.
   */
  private invalidateTypeDefinitions(): void {
    this.typeDefCache = null;
  }

  async insertTypeDefinition(
    input: Omit<EnumerationTypeDefinition, 'active'> & { active?: boolean },
  ): Promise<EnumerationTypeDefinition> {
    const row = await this.prisma.enumerationTypeDef.create({
      data: {
        key: input.key,
        labelAr: input.labelAr,
        labelEn: input.labelEn,
        descriptionAr: input.descriptionAr,
        descriptionEn: input.descriptionEn,
        icon: input.icon,
        exampleAr: input.exampleAr,
        exampleEn: input.exampleEn,
        parentTypeKey: input.parentTypeKey,
        deletable: input.deletable,
        onValuesRail: input.onValuesRail,
        // Never settable from a request: it means "a code path reads this type by name",
        // which is a fact about the codebase, not a property an operator may claim.
        systemOnly: false,
        active: input.active ?? true,
        sortOrder: input.sortOrder,
        surrogateProductKey: input.surrogateProductKey,
        mirrorQuestionId: input.mirrorQuestionId,
      },
    });
    this.invalidateTypeDefinitions();
    return toTypeDefinition(row);
  }

  async updateTypeDefinition(
    key: string,
    patch: Partial<Omit<EnumerationTypeDefinition, 'key'>>,
  ): Promise<EnumerationTypeDefinition | null> {
    const existing = await this.prisma.enumerationTypeDef.findUnique({ where: { key } });
    if (!existing) return null;

    const row = await this.prisma.enumerationTypeDef.update({
      where: { key },
      data: {
        ...(patch.labelAr !== undefined ? { labelAr: patch.labelAr } : {}),
        ...(patch.labelEn !== undefined ? { labelEn: patch.labelEn } : {}),
        ...(patch.descriptionAr !== undefined ? { descriptionAr: patch.descriptionAr } : {}),
        ...(patch.descriptionEn !== undefined ? { descriptionEn: patch.descriptionEn } : {}),
        ...(patch.icon !== undefined ? { icon: patch.icon } : {}),
        ...(patch.exampleAr !== undefined ? { exampleAr: patch.exampleAr } : {}),
        ...(patch.exampleEn !== undefined ? { exampleEn: patch.exampleEn } : {}),
        ...(patch.parentTypeKey !== undefined ? { parentTypeKey: patch.parentTypeKey } : {}),
        ...(patch.deletable !== undefined ? { deletable: patch.deletable } : {}),
        ...(patch.onValuesRail !== undefined ? { onValuesRail: patch.onValuesRail } : {}),
        ...(patch.active !== undefined ? { active: patch.active } : {}),
        ...(patch.sortOrder !== undefined ? { sortOrder: patch.sortOrder } : {}),
        ...(patch.surrogateProductKey !== undefined
          ? { surrogateProductKey: patch.surrogateProductKey }
          : {}),
        ...(patch.mirrorQuestionId !== undefined
          ? { mirrorQuestionId: patch.mirrorQuestionId }
          : {}),
      },
    });
    this.invalidateTypeDefinitions();
    return toTypeDefinition(row);
  }

  async deleteTypeDefinition(key: string): Promise<void> {
    await this.prisma.enumerationTypeDef.delete({ where: { key } });
    this.invalidateTypeDefinitions();
  }

  async countRowsOfType(type: string): Promise<number> {
    return this.prisma.platformEnumeration.count({ where: { type } });
  }

  /**
   * Hard-delete a surrogate product with everything that only exists because of it.
   *
   * ONE transaction, in FK order, and the order is the whole of the correctness here:
   *
   *   1. the bank programs — `scoring_weight_set` cascades off them, `audit_event` is
   *      `SET NULL`, and `bank_offer` references them by CODE with no foreign key, so an
   *      issued offer survives with its frozen figures intact (Principle I / A6);
   *   2. the LINKS, not the names. A catalog name is what banks sell; the calculation it
   *      pointed at is a different object, and an operator retiring one usually re-points
   *      the names rather than losing them. Unlinked, each name reads as stating no rule;
   *   3. the product row itself.
   *
   * Reversed, step 3 would strand the links, and `programNameIncomeRules()` would resolve
   * each one to nothing — the exact dangling state migration `20260825090000` RAISEs on.
   *
   * The caller has already decided this is wanted: the endpoint refuses without an explicit
   * `cascade`, naming every row in this list first.
   */
  async deleteSurrogateProductCascade(
    key: string,
    nameKeys: readonly string[],
    programCodes: readonly string[],
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      if (programCodes.length > 0) {
        await tx.bankProgram.deleteMany({ where: { programCode: { in: [...programCodes] } } });
      }
      if (nameKeys.length > 0) {
        await tx.platformEnumeration.updateMany({
          where: { type: 'program_name', key: { in: [...nameKeys] } },
          data: { surrogateProductKey: null, updatedAt: new Date() },
        });
      }
      await tx.platformEnumeration.deleteMany({ where: { type: 'surrogate_product', key } });
    });
    // Every type, not just the two touched: a name losing its link changes what
    // `programNameIncomeRules` answers, and `surrogate_fact`'s derived option provenance is
    // computed from rows this delete may have removed.
    this.invalidateCache();
    this.invalidateTypeDefinitions();
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

  /**
   * Every KIND, with how many values it holds.
   *
   * DEFINITION-DRIVEN, not `GROUP BY`-driven, and that is the load-bearing change: a kind an
   * operator has just created holds no values yet, and a list built from the values would not
   * contain it — so the rail would have no tile to add the first value under, and the new kind
   * would look like it had failed to save. A type with rows but no definition is still listed,
   * with `definition: null`, so an orphan is visible rather than hidden.
   *
   * Three grouped reads instead of the previous 2N+1 serial ones.
   */
  async listTypeStats(): Promise<EnumerationTypeStats[]> {
    const [defs, totals, actives, deprecateds] = await Promise.all([
      this.typeDefinitions(),
      this.prisma.platformEnumeration.groupBy({ by: ['type'], _count: { _all: true } }),
      this.prisma.platformEnumeration.groupBy({
        by: ['type'],
        _count: { _all: true },
        where: { active: true, deprecatedAt: null },
      }),
      this.prisma.platformEnumeration.groupBy({
        by: ['type'],
        _count: { _all: true },
        where: { deprecatedAt: { not: null } },
      }),
    ]);

    const countOf = (rows: Array<{ type: string; _count: { _all: number } }>): Map<string, number> =>
      new Map(rows.map((r) => [r.type, r._count._all]));
    const totalBy = countOf(totals);
    const activeBy = countOf(actives);
    const deprecatedBy = countOf(deprecateds);

    // Definitions first, in their own order; then any type carrying rows that has none.
    const seen = new Set<string>();
    const out: EnumerationTypeStats[] = [];
    for (const def of defs.values()) {
      seen.add(def.key);
      out.push({
        type: def.key,
        total: totalBy.get(def.key) ?? 0,
        active: activeBy.get(def.key) ?? 0,
        deprecated: deprecatedBy.get(def.key) ?? 0,
        deletable: def.deletable,
        definition: def,
      });
    }
    for (const type of [...totalBy.keys()].sort()) {
      if (seen.has(type)) continue;
      out.push({
        type,
        total: totalBy.get(type) ?? 0,
        active: activeBy.get(type) ?? 0,
        deprecated: deprecatedBy.get(type) ?? 0,
        deletable: false,
        definition: null,
      });
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
        surrogateProductKey: input.surrogateProductKey ?? null,
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
      // basis is carried across; only genuinely new pairs take a default, and that
      // default is `bornBasisFlags` rather than a literal — a create assigns no
      // category, so the first pair a name ever gets is written here.
      const before = await tx.platformEnumerationLoanCategory.findMany({
        where: { enumerationId },
        select: { category: true, payslip: true, noPayslip: true },
      });
      const kept = new Map(
        before.map((r) => [r.category, { payslip: r.payslip, noPayslip: r.noPayslip }]),
      );
      await tx.platformEnumerationLoanCategory.deleteMany({ where: { enumerationId } });
      if (categories.length === 0) return;
      const row = await tx.platformEnumeration.findUnique({
        where: { id: enumerationId },
        select: { surrogateProductKey: true },
      });
      const linked = row?.surrogateProductKey != null;
      await tx.platformEnumerationLoanCategory.createMany({
        data: categories.map((category) => ({
          enumerationId,
          category,
          ...bornBasisFlags(kept, category, linked),
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
      // One read for every row the batch touches, before the loop: the born-basis
      // fallback needs the surrogate-product link, and asking per row would be N more
      // round trips inside a transaction that already holds every lock.
      const linkRows = await tx.platformEnumeration.findMany({
        where: { id: { in: ids } },
        select: { id: true, surrogateProductKey: true },
      });
      const linked = new Set(
        linkRows.filter((r) => r.surrogateProductKey != null).map((r) => r.id),
      );
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
            ...bornBasisFlags(kept, category, linked.has(a.enumerationId)),
          })),
        });
      }
    });
  }

  setParentKeysBulk(
    assignments: readonly { id: string; parentKey: string | null }[],
  ): Promise<ParentKeyMove[]> {
    return this.prisma.$transaction(async (tx) => {
      // Same deterministic lock order as `setCategoriesBulk` above, for the same reason: two
      // board saves that touch the same rows in different orders would otherwise deadlock,
      // and an `updateMany` with `id IN (…)` gives no lock-order guarantee at all.
      const ids = [...new Set(assignments.map((a) => a.id))].sort();
      for (const id of ids) {
        await tx.$executeRaw`SELECT 1 FROM platform_enumeration WHERE id = ${id} FOR UPDATE`;
      }

      const before = await tx.platformEnumeration.findMany({
        where: { id: { in: ids } },
        select: { id: true, type: true, key: true, parentKey: true },
      });
      const byId = new Map(before.map((row) => [row.id, row]));

      const moves: ParentKeyMove[] = [];
      // Grouped by target, so the common case — "these nine compounds, into Class B" — is one
      // statement rather than nine. A no-op row is not written at all: the audit granularity
      // is one event per real change, and a row that did not move has no change to report.
      // Keyed `string | null` because `null` is a real target — the value is priced nowhere.
      // A Map handles it as a distinct key, so an unfile batch is still ONE `updateMany`.
      const byTarget = new Map<string | null, string[]>();
      for (const assignment of assignments) {
        const row = byId.get(assignment.id);
        if (row === undefined || row.parentKey === assignment.parentKey) continue;
        moves.push({
          id: row.id,
          type: row.type,
          key: row.key,
          from: row.parentKey,
          to: assignment.parentKey,
        });
        const bucket = byTarget.get(assignment.parentKey) ?? [];
        bucket.push(assignment.id);
        byTarget.set(assignment.parentKey, bucket);
      }

      for (const [parentKey, movedIds] of byTarget) {
        await tx.platformEnumeration.updateMany({
          where: { id: { in: movedIds } },
          data: { parentKey },
        });
      }
      return moves;
    });
  }

  async countChildren(childType: string, parentKey: string): Promise<number> {
    return this.prisma.platformEnumeration.count({
      where: { type: childType, parentKey, deprecatedAt: null },
    });
  }

  /**
   * What points at one value of an operator-created kind.
   *
   * Exactly one thing can: another value filed under it. A kind the operator invented is
   * named by no code path, keyed by no column, and reachable by an income rule only through
   * `factParentTable`, which reads the CHILD's answer and walks to this row — so deleting a
   * parent that still has children is the one destructive case, and it is the one counted.
   *
   * DEPRECATED children are excluded, matching `countChildren`: a deprecated value is already
   * out of every picker, and blocking a parent's delete on one would leave the operator no
   * move at all, since a deprecated row cannot be re-filed either.
   */
  private async countGenericReferences(
    defs: EnumerationTypeDefinitions,
    type: string,
    key: string,
  ): Promise<EnumerationReference[]> {
    const children = childTypesOf(defs, type);
    if (children.length === 0) return [];
    const counts = await Promise.all(
      children.map(async (childType) => ({
        source: childType,
        count: await this.prisma.platformEnumeration.count({
          where: { type: childType, parentKey: key, deprecatedAt: null },
        }),
      })),
    );
    return counts.filter((c) => c.count > 0);
  }

  /**
   * The catalog names taking their calculation from a surrogate product — what the
   * retire refusal names back to the operator.
   *
   * Keys rather than a count, unlike `countChildren`: a class board can say "4 values"
   * because the operator is looking at them, but the name linked to a product is on a
   * different screen entirely, so the refusal has to say WHICH to be actionable.
   *
   * DEPRECATED names are included on purpose, and it is the same reasoning
   * `programNameIncomeRules()` uses: a deprecated name still quotes for the programs
   * already filed under it, so retiring the product beneath it would blank their income
   * while every screen said the name was already gone.
   */
  async programNamesLinkedTo(productKey: string): Promise<string[]> {
    const rows = await this.prisma.platformEnumeration.findMany({
      where: { type: 'program_name', surrogateProductKey: productKey },
      orderBy: { key: 'asc' },
      select: { key: true },
    });
    return rows.map((r) => r.key);
  }

  async updateById(id: string, patch: EnumerationUpdatePatch): Promise<EnumerationRow> {
    const data: Prisma.PlatformEnumerationUpdateInput = { updatedBy: patch.updatedBy };
    if (patch.labelAr !== undefined) data.labelAr = patch.labelAr;
    if (patch.labelEn !== undefined) data.labelEn = patch.labelEn;
    if (patch.parentKey !== undefined) data.parentKey = patch.parentKey;
    if (patch.surrogateProductKey !== undefined) {
      data.surrogateProductKey = patch.surrogateProductKey;
    }
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
    type: string,
    key: string,
  ): Promise<EnumerationReference[] | null> {
    // The gate, stated once. `countReferences` returning `null` is what refuses a delete, and
    // the switch below used to BE that list implicitly — so the admin rendered a Delete button
    // on every type and learned the answer from a 422. The gate is now the KIND's own
    // `deletable` flag (an early return, so it cannot drift from the cases), and it is served
    // on the type summary, which is what lets the board hide a button it knows will be refused.
    //
    // The flag was seeded from the old `DELETABLE_TYPES` verbatim, so no builtin changed hands.
    const defs = await this.typeDefinitions();
    if (!isDeletableType(defs, type)) return null;

    // A kind an operator created has no bespoke branch and needs none: nothing in the platform
    // reads it by name, so the only thing that can point at one of its values is a child value
    // filed under it. Counting that generically is what makes a new kind deletable at all —
    // falling through to `null` would have made every operator-made kind undeletable forever,
    // i.e. exactly the trap this feature exists to remove.
    if (!(BUILTIN_REFERENCE_COUNTED_TYPES as readonly string[]).includes(type)) {
      return this.countGenericReferences(defs, type, key);
    }

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
  surrogateProductKey?: string | null;
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
    surrogateProductKey: row.surrogateProductKey ?? null,
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
    surrogateProductKey: row.surrogateProductKey,
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
    // Carried unconditionally, and null on every type that does not use it. On a
    // `surrogate_fact` this is what lets a product's own page list what IT asks before a
    // rule exists to derive that from; on a `program_name` it is where the calculation
    // comes from. Both readers are admin screens, and the customer projection strips it.
    surrogateProductKey: row.surrogateProductKey,
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
