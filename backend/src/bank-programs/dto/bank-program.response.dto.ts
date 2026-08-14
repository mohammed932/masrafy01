import type { ProgramType } from './create-bank-program.dto';

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
  currencies!: string[];
  active!: boolean;
  isShariaCompliant!: boolean;
  version!: number;
  operatorNotes?: string | null;
  operatorTips!: string[];
  requiredDocuments!: string[];

  tenor!: Record<string, unknown>;
  loanLimits!: Record<string, unknown>;
  pricing!: Record<string, unknown>;
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
  currencies!: string[];
  baseRatePercent?: string | null;
  currentEffectiveRatePercent?: string | null;
  deprecatedKeyCount!: number;
  version!: number;
  updatedAt!: string;
}

