import 'package:app/features/matching/data/models/request/apply_request.dart';
import 'package:app/features/questionnaire/presentation/mappers/apply_mapping.dart';
import 'package:app/features/questionnaire/presentation/pages/car/cubit/car_questionnaire/car_questionnaire_cubit.dart';

/// Representative monthly-income (EGP) per car income band `cb1..cb4`
/// (midpoints of the arb ranges `q_opt_car_income_b*`).
const Map<String, double> _incomeByBand = {
  'cb1': 8000,
  'cb2': 17500,
  'cb3': 37500,
  'cb4': 65000,
};

/// Down-payment bucket → representative fraction of the vehicle price.
const Map<String, double> _downPaymentPct = {
  'no_dp': 0,
  'under_20': 0.10,
  '20_40': 0.30,
  'over_40': 0.45,
};

/// Map the car-loan wizard answers → `ApplyRequest`. Vehicle price is the range
/// slider's midpoint; the financed principal = price − down payment. `age` is
/// filled later by the results cubit.
ApplyRequest mapCarToApplyRequest(CarQuestionnaireState state) {
  final employmentType = state.employmentStatus ?? 'salaried';
  final price = midpoint(state.vehiclePriceStart, state.vehiclePriceEnd);
  final downPayment = price * (_downPaymentPct[state.downPaymentPct] ?? 0);
  final hasLoan = state.currentLoans ?? false;
  return ApplyRequest(
    loanPurpose: 'car',
    requestedAmountEGP: amountEgp(price - downPayment),
    preferredTenorMonths: tenorMonths(state.repaymentPeriod),
    priority: mapPriority(state.priorityFactor),
    employment: EmploymentPayload(
      employmentType: employmentType,
      monthlyNetSalaryEGP: egp(_incomeByBand[state.monthlyIncome] ?? 0),
      monthsInJob: monthsFromTenure(null), // car wizard doesn't ask tenure
      salaryTransferType: salaryTransferType(transfers: state.salaryTransfer),
      companyName: 'N/A',
      companyType: companyTypeFor(employmentType),
    ),
    obligations: ObligationsPayload(
      existingMonthlyObligationsEGP:
          egp(hasLoan ? (double.tryParse(state.currentInstallments.trim()) ?? 0) : 0),
      hasCurrentLoan: hasLoan,
      hasPreviousRejection: false, // not collected by the car wizard
    ),
    assets: const AssetsPayload(),
    carDetails: CarDetailsPayload(
      carValueEGP: egp(price),
      downPaymentEGP: egp(downPayment),
    ),
  );
}
