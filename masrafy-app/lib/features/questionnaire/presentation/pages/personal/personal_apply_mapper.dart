import 'package:app/features/matching/data/models/request/apply_request.dart';
import 'package:app/features/questionnaire/presentation/mappers/apply_mapping.dart';
import 'package:app/features/questionnaire/presentation/pages/personal/cubit/personal_questionnaire/personal_questionnaire_cubit.dart';

/// Representative monthly-income (EGP) per personal income band `cb1..cb5`
/// (midpoints of the arb ranges `q_opt_personal_income_b*`).
const Map<String, double> _incomeByBand = {
  'cb1': 10000,
  'cb2': 15000,
  'cb3': 35000,
  'cb4': 65000,
  'cb5': 120000,
};

/// Map the personal-loan wizard answers → `ApplyRequest` (Principle XXX). `age`
/// is left null — the results cubit fills it from `/auth/me`. The sub-purpose
/// (`marriage`/`education`/…) has no backend field, so `loanPurpose` carries the
/// category id `personal`.
ApplyRequest mapPersonalToApplyRequest(PersonalQuestionnaireState state) {
  final employmentType = state.employmentStatus ?? 'salaried';
  final hasObligations = state.hasRealObligations;
  return ApplyRequest(
    loanPurpose: 'personal',
    requestedAmountEGP: amountEgp(double.tryParse(state.loanAmount.trim()) ?? 0),
    preferredTenorMonths: tenorMonths(state.repaymentPeriod),
    priority: mapPriority(state.priorityFactor),
    employment: EmploymentPayload(
      employmentType: employmentType,
      monthlyNetSalaryEGP: egp(_incomeByBand[state.monthlyIncome] ?? 0),
      monthsInJob: monthsFromTenure(state.jobTenure),
      salaryTransferType: salaryTransferType(transfers: state.salaryTransfer),
      companyName: 'N/A',
      companyType: companyTypeFor(employmentType),
    ),
    obligations: ObligationsPayload(
      existingMonthlyObligationsEGP:
          egp(hasObligations ? (double.tryParse(state.monthlyInstallment.trim()) ?? 0) : 0),
      hasCurrentLoan: hasObligations,
      hasPreviousRejection: state.previouslyRejected ?? false,
    ),
    assets: const AssetsPayload(),
  );
}
