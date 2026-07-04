import 'package:app/features/matching/data/models/request/apply_request.dart';
import 'package:app/features/questionnaire/presentation/mappers/apply_mapping.dart';
import 'package:app/features/questionnaire/presentation/pages/mortgage/cubit/mortgage_questionnaire/mortgage_questionnaire_cubit.dart';

/// Representative monthly-income (EGP) per mortgage income band `b1..b6`
/// (midpoints of the arb ranges `q_opt_income_b*`).
const Map<String, double> _incomeByBand = {
  'b1': 35000,
  'b2': 75000,
  'b3': 200000,
  'b4': 450000,
  'b5': 800000,
  'b6': 1200000,
};

/// Down-payment bucket → representative fraction of the property value.
const Map<String, double> _downPaymentPct = {
  'under_10': 0.05,
  '10_20': 0.15,
  '20_30': 0.25,
  'over_30': 0.35,
};

/// Map the mortgage wizard answers → `ApplyRequest`. Property value is the range
/// slider's midpoint; the financed principal = value − down payment. `age` is
/// filled later by the results cubit.
ApplyRequest mapMortgageToApplyRequest(MortgageQuestionnaireState state) {
  final employmentType = state.employmentStatus ?? 'salaried';
  final value = midpoint(state.propertyValueStart, state.propertyValueEnd);
  final downPayment = value * (_downPaymentPct[state.downPaymentPct] ?? 0);
  final hasLoan = state.currentLoans ?? false;
  return ApplyRequest(
    loanPurpose: 'mortgage',
    requestedAmountEGP: amountEgp(value - downPayment),
    preferredTenorMonths: tenorMonths(state.repaymentPeriod),
    priority: mapPriority(state.priorityFactor),
    employment: EmploymentPayload(
      employmentType: employmentType,
      monthlyNetSalaryEGP: egp(_incomeByBand[state.monthlyIncome] ?? 0),
      monthsInJob: monthsFromTenure(null), // mortgage wizard doesn't ask tenure
      salaryTransferType: salaryTransferType(transfers: state.salaryTransfer),
      companyName: 'N/A',
      companyType: companyTypeFor(employmentType),
    ),
    obligations: ObligationsPayload(
      existingMonthlyObligationsEGP:
          egp(hasLoan ? (double.tryParse(state.currentInstallments.trim()) ?? 0) : 0),
      hasCurrentLoan: hasLoan,
      hasPreviousRejection: state.priorRejection ?? false,
    ),
    assets: const AssetsPayload(),
    mortgageDetails: MortgageDetailsPayload(
      propertyValueEGP: egp(value),
      downPaymentEGP: egp(downPayment),
      propertyType: state.propertyType ?? 'apartment',
      isCompound: state.inCompound ?? false,
      constructionStage: state.registrationStatus ?? 'registered',
    ),
  );
}
