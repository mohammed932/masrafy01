import type { ProgramType } from './create-bank-program.dto';
import type { PlansSource } from '../../matching/pipeline/plan-inherit';
import type { RateDefaults } from '../../matching/pipeline/rate-inherit';

export interface DeprecatedKeyDescriptor {
  fieldPath: string;
  key: string;
  enumerationType: string;
}

export class BankProgramResponseDto {
  id!: string;
  programCode!: string;
  friendlyName!: string;
  friendlyNameAr?: string | null;
  /**
   * Predefined program (`program_name` enumeration key) this program instantiates.
   * A name only — every lending spec is authored on the program itself.
   */
  programNameKey?: string | null;
  bankName!: string;
  programType!: ProgramType;
  productCategory!: string;
  active!: boolean;
  isShariaCompliant!: boolean;
  version!: number;

  /**
   * Whose PLAN tables this program reads — its own, or the surrogate product's.
   *
   * On the wire it is never absent: the service normalises the stored value through
   * `plansSourceOf` so a client reads exactly what the engine reads. That matters more here
   * than on most fields, because the wizard performs a FULL-REPLACEMENT save and posts this
   * back. Omitting it from the response made every save read the stored `'product'` as
   * `'own'` and silently detach the program from the product's rate, term, financed-share
   * and floor tables — on a form the operator had only opened.
   */
  plansSource!: PlansSource;
  operatorNotes?: string | null;
  operatorTips!: string[];
  requiredDocuments!: string[];

  tenor!: Record<string, unknown>;
  loanLimits!: Record<string, unknown>;
  /**
   * The program's OWN pricing blob, exactly as stored — never merged with the product's.
   *
   * RAW ON PURPOSE, unlike the list row's resolved figure beside it. The wizard saves by
   * full replacement and posts this object back: a response carrying the product's rate
   * would be copied onto the program on the next save, and a programme that was reading its
   * product's price would silently freeze a copy of it — the same defect `plansSource`'s
   * docstring records. What the program is actually quoted at rides on `productRate` below,
   * where nothing posts it back.
   */
  pricing!: Record<string, unknown>;
  /**
   * The surrogate product's rate, when the catalog name this program is filed under links a
   * product that states one. `null` otherwise.
   *
   * READ-ONLY and separate from `pricing` above, so the detail screen can print what the
   * programme is quoted at while the form keeps posting back only what the programme itself
   * states. A program whose own rate is blank is priced at this one.
   */
  productRate?: RateDefaults | null;
  eligibility!: Record<string, unknown>;
  performanceCriteria?: Record<string, unknown> | null;
  incomeAssumption!: Record<string, unknown>;
  fees!: Record<string, unknown>;

  /**
   * Feature 011 — sparse map of config dot-path → `'team_estimated'` (FR-032).
   * An ABSENT path is bank-stated, so `{}` means the whole program is stated.
   */
  valueSources!: Record<string, 'team_estimated'>;

  /** Tier keys present on this program that have been deprecated since last save (FR-010c). */
  deprecatedKeys!: DeprecatedKeyDescriptor[];

  /**
   * Feature 011 — non-blocking findings from the last save (FR-001 edge case,
   * FR-013). Present on create/update responses; empty on a plain read.
   *
   * `code` is a typed error code the admin resolves through the shared
   * error-code service — never an English string (Principle III / A22).
   */
  warnings!: Array<{ code: string; meta?: Record<string, unknown> }>;

  /**
   * Feature 011 / FR-035 — set when this save introduced a team-estimated number
   * on a LIVE program and the program was switched off in the same transaction.
   * The UI needs it to say WHY the program went dark; without it the deactivation
   * looks like someone else's edit.
   */
  deactivatedByEstimate?: boolean;

  createdAt!: string;
  updatedAt!: string;
}

export class BankProgramListRowDto {
  id!: string;
  programCode!: string;
  friendlyName!: string;
  programNameKey?: string | null;
  bankName!: string;
  productCategory!: string;
  /**
   * How this program establishes the income it lends against. On the LIST because it is
   * the one property that changes what every other number on the row means — a rate
   * quoted against an assumed income is not the same offer as the same rate against a
   * payslip — and no list could show or filter it before.
   */
  programType!: 'income_proof' | 'income_surrogate';
  active!: boolean;
  isShariaCompliant!: boolean;
  /**
   * The rate this program is QUOTED at — its own when it states one, the surrogate
   * product's when it does not (`effectiveRate`).
   *
   * Resolved rather than raw, and only on this read-only list: since the wizard stopped
   * asking for a rate, a raw column would be blank for every programme priced by its
   * product, which reads as a programme with no price rather than one priced a level up.
   *
   * The DETAIL response deliberately does NOT do this — see `pricing` there.
   */
  baseRatePercent?: string | null;
  currentEffectiveRatePercent?: string | null;
  deprecatedKeyCount!: number;
  version!: number;
  updatedAt!: string;
}
