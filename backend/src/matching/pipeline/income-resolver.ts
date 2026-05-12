/**
 * Income assumption resolver — pure function.
 * Maps incomeAssumption.strategy to an assumed monthly income figure.
 */

import { Decimal } from '@prisma/client/runtime/library';
import type { ApplicantProfile, IncomeAssumptionConfig, EligibilityConfig } from '../types';

const ROUND_BANKERS = Decimal.ROUND_HALF_EVEN;

export function resolveAssumedIncome(
  profile: ApplicantProfile,
  income: IncomeAssumptionConfig,
  eligibility: EligibilityConfig,
): Decimal {
  const declared = profile.employment.monthlyNetSalaryEGP;
  const surrogate = resolveSurrogateIncome(profile, income);
  const baseline = applyCompanyTypeAdjustment(declared, profile, eligibility);

  if (!surrogate) return baseline;

  switch (income.combinationRule) {
    case 'greater_of':
      return surrogate.greaterThan(baseline) ? surrogate : baseline;
    case 'lesser_of':
      return surrogate.lessThan(baseline) ? surrogate : baseline;
    default:
      return surrogate;
  }
}

function applyCompanyTypeAdjustment(
  declared: Decimal,
  profile: ApplicantProfile,
  eligibility: EligibilityConfig,
): Decimal {
  if (profile.employment.bankCategory === 'commercial' && eligibility.commercialBankIncomePercent) {
    return declared
      .mul(eligibility.commercialBankIncomePercent)
      .div(100)
      .toDecimalPlaces(2, ROUND_BANKERS);
  }
  if (profile.employment.bankCategory === 'public' && eligibility.publicBankIncomePercent) {
    return declared
      .mul(eligibility.publicBankIncomePercent)
      .div(100)
      .toDecimalPlaces(2, ROUND_BANKERS);
  }
  return declared;
}

function resolveSurrogateIncome(
  profile: ApplicantProfile,
  config: IncomeAssumptionConfig,
): Decimal | null {
  switch (config.strategy) {
    case 'declared':
      return null;

    case 'byYearsInJob':
      return lookupIncomeTable(Math.floor(profile.employment.monthsInJob / 12), config);

    case 'byYearsInPractice':
      return lookupIncomeTable(profile.employment.yearsInPractice ?? 0, config);

    case 'byProfessorRank': {
      const rank = profile.employment.professorRank;
      const v = rank && config.rankIncomeMap?.[rank];
      return v ? new Decimal(v) : null;
    }

    case 'byMilitaryGrade': {
      const grade = profile.employment.militaryGrade;
      const v = grade && config.gradeIncomeMap?.[grade];
      return v ? new Decimal(v) : null;
    }

    case 'byCDValue': {
      const cd = profile.assets.cdAtABKValueEGP;
      if (!cd || cd.lessThanOrEqualTo(0)) return null;
      const percent = new Decimal(config.cdIncomePercent ?? '3');
      const monthly = cd.mul(percent).div(100).div(12);
      const floor = config.cdIncomeMinEGP ? new Decimal(config.cdIncomeMinEGP) : null;
      const result = floor && monthly.lessThan(floor) ? floor : monthly;
      return result.toDecimalPlaces(2, ROUND_BANKERS);
    }

    case 'byTotalDeposits': {
      const dep = profile.assets.totalDepositsAtABKValueEGP;
      if (!dep || dep.lessThanOrEqualTo(0)) return null;
      const percent = new Decimal(
        config.cdIncomePercentOfDeposits ?? config.cdIncomePercent ?? '2',
      );
      return dep.mul(percent).div(100).div(12).toDecimalPlaces(2, ROUND_BANKERS);
    }

    case 'byCarInstallment': {
      const inst = profile.assets.carInstallmentEGP;
      if (!inst || inst.lessThanOrEqualTo(0)) return null;
      const mult = new Decimal(config.carInstallmentMultiplier ?? '4');
      return inst.mul(mult).toDecimalPlaces(2, ROUND_BANKERS);
    }

    case 'byCarLoanAmount': {
      const loan = profile.assets.autoLoanAtOtherBankEGP ?? profile.assets.autoLoanAtABKEGP;
      if (!loan || loan.lessThanOrEqualTo(0)) return null;
      const percent = new Decimal(config.carLoanAmountPercent ?? '5');
      return loan.mul(percent).div(100).div(12).toDecimalPlaces(2, ROUND_BANKERS);
    }

    case 'byCreditCardLimit': {
      const lim = profile.assets.creditCardLimitEGP;
      if (!lim || lim.lessThanOrEqualTo(0)) return null;
      const mult = new Decimal(config.creditCardLimitMultiplier ?? '0.1');
      return lim.mul(mult).toDecimalPlaces(2, ROUND_BANKERS);
    }

    case 'byBankStatementPercent': {
      const bal = profile.assets.bankStatementBalanceEGP;
      if (!bal || bal.lessThanOrEqualTo(0)) return null;
      const percent = new Decimal(config.bankStatementPercent ?? '10');
      return bal.mul(percent).div(100).toDecimalPlaces(2, ROUND_BANKERS);
    }

    default:
      return null;
  }
}

function lookupIncomeTable(years: number, config: IncomeAssumptionConfig): Decimal | null {
  const table = config.incomeTable;
  if (!table?.length) return null;
  const entry = table.find((row) => years >= row.minYears && years <= row.maxYears);
  return entry ? new Decimal(entry.incomeEGP) : null;
}
