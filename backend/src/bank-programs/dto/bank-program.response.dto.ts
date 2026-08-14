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
  active!: boolean;
  isShariaCompliant!: boolean;
  currencies!: string[];
  baseRatePercent?: string | null;
  currentEffectiveRatePercent?: string | null;
  deprecatedKeyCount!: number;
  version!: number;
  updatedAt!: string;
}

/**
 * Feature 011 / FR-036 — one row of the "waiting for the bank" list.
 *
 * The list exists so the team has ONE place answering "what are we waiting on each
 * bank for", instead of auditing twenty programs to find the guesses.
 */
export class PendingBankConfirmationRowDto {
  programCode!: string;
  friendlyName!: string;
  bankName!: string;
  /** Usually false — an estimate blocks going live — but a pre-flag live row can exist. */
  active!: boolean;
  /** EVERY estimated path, not the first: the admin asks the bank about all of them at once. */
  estimatedPaths!: string[];
  /** The oldest still-standing marker's audit timestamp. */
  waitingSince!: string;
  /**
   * True when `waitingSince` fell back to the program's `updatedAt` because the marker
   * carries no audit event (import, backfill, direct seed). Surfaced so the UI can say
   * "about" — and NEVER `null`, which would render as "0 days waiting" and read as
   * "flagged today", the one answer that is certainly wrong.
   */
  waitingSinceEstimated!: boolean;
  waitingDays!: number;
}
