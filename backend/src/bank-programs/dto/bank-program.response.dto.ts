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

  /** Tier keys present on this program that have been deprecated since last save (FR-010c). */
  deprecatedKeys!: DeprecatedKeyDescriptor[];

  createdAt!: string;
  updatedAt!: string;
}

export class BankProgramListRowDto {
  id!: string;
  programCode!: string;
  friendlyName!: string;
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
