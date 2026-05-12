/**
 * Mobile-facing read-only DTO. Explicit ALLOWLIST per research.md R5.
 * Excludes: id, version, operator notes/tips, raw tier maps, derivation chains,
 *   wealth gates, qualitativeReviewMaxEGP, audit metadata.
 */
export class MobileBankProgramResponseDto {
  programCode!: string;
  friendlyName!: string;
  bankName!: string;
  productCategory!: string;
  currencies!: string[];
  displayRateRange!: { minPercent: string; maxPercent: string };
  displayMinEGP!: string;
  displayMaxEGP!: string;
  displayMinMonths!: number;
  displayMaxMonths!: number;
  requiredDocuments!: string[];
  adminFeeDisplay!: string;
  lifeInsuranceMandatory!: boolean;
  stampDutyDisplay!: string;
  acceptedEmploymentTypes!: string[];
  acceptedLoanPurposes!: string[];
  ageRangeDisplay!: string;
}
