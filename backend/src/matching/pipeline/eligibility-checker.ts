/**
 * Eligibility checker — runs all hard checks for a program.
 *
 * Each check is independent; all must pass for the program to be eligible.
 * Failed-check codes map directly to error codes surfaced in no-match details.
 */

import { Decimal } from '@prisma/client/runtime/library';
import type {
  ApplicantProfile,
  BankProgramSnapshot,
  EligibilityConfig,
  PerformanceCriteriaConfig,
} from '../types';

export interface EligibilityCheckResult {
  passed: boolean;
  passedChecks: string[];
  failedChecks: string[];
}

export function checkEligibility(
  profile: ApplicantProfile,
  program: BankProgramSnapshot,
  assumedIncomeEGP: Decimal,
): EligibilityCheckResult {
  const passed: string[] = [];
  const failed: string[] = [];
  const elig = program.eligibility;
  const push = (ok: boolean, code: string): void => {
    (ok ? passed : failed).push(code);
  };
  // An "accepted X" allow-list only constrains when it has entries. Missing /
  // empty = the program does not restrict on that dimension → pass (NOT reject
  // everyone, which an unconfigured list would otherwise do).
  const accepts = (list: readonly string[] | undefined | null, value: string): boolean =>
    !list || list.length === 0 || list.includes(value);

  push(accepts(elig.acceptedEmploymentTypes, profile.employment.employmentType), 'employment_type');

  if (elig.companyType?.length) {
    push(elig.companyType.includes(profile.employment.companyType), 'company_type');
  }

  const isSelfEmployed =
    profile.employment.employmentType !== 'salaried' &&
    profile.employment.employmentType !== 'government' &&
    profile.employment.employmentType !== 'pension';
  const minAge =
    isSelfEmployed && elig.selfEmployedMinAge != null
      ? Math.max(elig.minAge, elig.selfEmployedMinAge)
      : elig.minAge;
  const maxAge =
    isSelfEmployed && elig.selfEmployedMaxAge != null ? elig.selfEmployedMaxAge : elig.maxAge;
  push(profile.age >= minAge && profile.age <= maxAge, 'age');

  const minIncomeRaw =
    isSelfEmployed && elig.selfEmployedMinMonthlyIncomeEGP
      ? elig.selfEmployedMinMonthlyIncomeEGP
      : elig.minMonthlyIncomeEGP;
  push(assumedIncomeEGP.greaterThanOrEqualTo(minIncomeRaw), 'monthly_income');

  push(profile.employment.monthsInJob >= elig.minMonthsInJob, 'months_in_job');
  push(accepts(elig.acceptedLoanPurposes, profile.loanPurpose), 'loan_purpose');
  push(accepts(elig.acceptedSalaryTransferTypes, profile.employment.salaryTransferType), 'salary_transfer_type');
  push(accepts(program.currencies, profile.requestedCurrency), 'currency');

  const minAmount = new Decimal(
    program.loanLimits.perCurrency[profile.requestedCurrency]?.minAmount ?? '0',
  );
  const maxAmount = new Decimal(
    program.loanLimits.perCurrency[profile.requestedCurrency]?.maxAmount ?? '0',
  );
  push(
    profile.requestedAmountEGP.greaterThanOrEqualTo(minAmount) &&
      profile.requestedAmountEGP.lessThanOrEqualTo(maxAmount),
    'loan_amount',
  );

  push(
    profile.preferredTenorMonths >= program.tenor.minMonths &&
      profile.preferredTenorMonths <= program.tenor.maxMonths,
    'tenor',
  );

  pushIfRequired(
    elig.requiresCD,
    hasPositiveAsset(profile.assets.cdAtABKValueEGP),
    'requires_cd',
    passed,
    failed,
  );
  pushIfRequired(
    elig.requiresAutoLoanAtABK,
    hasPositiveAsset(profile.assets.autoLoanAtABKEGP),
    'requires_auto_loan_abk',
    passed,
    failed,
  );
  pushIfRequired(
    elig.requiresAutoLoanAtOtherBank,
    hasPositiveAsset(profile.assets.autoLoanAtOtherBankEGP),
    'requires_auto_loan_other',
    passed,
    failed,
  );
  pushIfRequired(
    elig.requiresCreditCardAtOtherBank,
    hasPositiveAsset(profile.assets.creditCardLimitEGP),
    'requires_credit_card_other',
    passed,
    failed,
  );
  pushIfRequired(
    elig.requiresCompoundProperty,
    profile.assets.ownsCompoundProperty === true,
    'requires_compound_property',
    passed,
    failed,
  );
  pushIfRequired(
    elig.requiresClubMembership,
    profile.assets.clubMembership === true,
    'requires_club_membership',
    passed,
    failed,
  );
  pushIfRequired(
    elig.requiresExistingLoan,
    profile.obligations.hasCurrentLoan,
    'requires_existing_loan',
    passed,
    failed,
  );

  // Wealth gates — AND combination (FR-005c.1).
  if (elig.minBankStatementBalanceEGP) {
    const min = new Decimal(elig.minBankStatementBalanceEGP);
    const have = profile.assets.bankStatementBalanceEGP ?? new Decimal(0);
    push(have.greaterThanOrEqualTo(min), 'bank_statement_balance');
  }
  if (elig.minAssetsValueEGP) {
    const min = new Decimal(elig.minAssetsValueEGP);
    const have = profile.assets.declaredAssetsValueEGP ?? new Decimal(0);
    push(have.greaterThanOrEqualTo(min), 'declared_assets_value');
  }

  // FRMU verification gate retired with guest mode (v4.0.0): every applicant is
  // an authenticated customer, so this check never fired for a real submission.

  // Credit-card holding tenure (e.g. ABK-CC-XSELL minimum 6 months).
  if (
    elig.requiresCreditCardAtOtherBank &&
    elig.minimumCreditCardHoldingMonths != null &&
    profile.employment.monthsInJob < elig.minimumCreditCardHoldingMonths
  ) {
    failed.push('credit_card_holding_tenure');
  }

  if (program.performanceCriteria) {
    applyPerformanceCriteria(profile, program.performanceCriteria, passed, failed);
  }

  return {
    passed: failed.length === 0,
    passedChecks: passed,
    failedChecks: failed,
  };
}

function pushIfRequired(
  required: boolean,
  satisfied: boolean,
  code: string,
  passed: string[],
  failed: string[],
): void {
  if (!required) return;
  (satisfied ? passed : failed).push(code);
}

function hasPositiveAsset(value: Decimal | undefined): boolean {
  return value !== undefined && value.greaterThan(0);
}

function applyPerformanceCriteria(
  profile: ApplicantProfile,
  pc: PerformanceCriteriaConfig,
  passed: string[],
  failed: string[],
): void {
  if (pc.requiredMOBMonths != null) {
    const mob = profile.obligations.monthsOnBookCurrentLoan ?? 0;
    (mob >= pc.requiredMOBMonths ? passed : failed).push('performance_mob');
  }
  if (pc.bkt1NoHitWithinMonths != null) {
    const hits = profile.obligations.bkt1HitWithinMonths ?? 0;
    (hits === 0 ? passed : failed).push('performance_bkt1');
  }
  if (pc.bkt2NoHitWithinMonths != null) {
    const hits = profile.obligations.bkt2HitWithinMonths ?? 0;
    (hits === 0 ? passed : failed).push('performance_bkt2');
  }
}

export function checkEligibilityConfigShape(_: EligibilityConfig): void {
  // Reserved hook for future static-shape assertions; intentionally empty.
}
