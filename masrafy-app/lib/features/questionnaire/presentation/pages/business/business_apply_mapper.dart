import 'package:app/features/matching/data/models/request/apply_request.dart';
import 'package:app/features/questionnaire/presentation/mappers/apply_mapping.dart';
import 'package:app/features/questionnaire/presentation/pages/business/cubit/business_questionnaire/business_questionnaire_cubit.dart';

/// Map the business-loan wizard answers → `ApplyRequest`. Business revenue (the
/// range slider's midpoint) stands in for `monthlyNetSalaryEGP`; business age
/// (years) → `monthsInJob`. `age` is filled later by the results cubit.
ApplyRequest mapBusinessToApplyRequest(BusinessQuestionnaireState state) {
  final revenue = midpoint(state.monthlyRevenueStart, state.monthlyRevenueEnd);
  final businessYears = int.tryParse(state.businessAge.trim()) ?? 2;
  final hasFacilities = state.currentFacilities ?? false;
  return ApplyRequest(
    loanPurpose: 'business',
    requestedAmountEGP: amountEgp(double.tryParse(state.financingAmount.trim()) ?? 0),
    preferredTenorMonths: tenorMonths(state.repaymentPeriod),
    priority: mapPriority(state.priorityFactor),
    employment: EmploymentPayload(
      employmentType: 'business_owner',
      monthlyNetSalaryEGP: egp(revenue),
      monthsInJob: businessYears * 12,
      salaryTransferType: 'none',
      companyName: 'N/A',
      companyType: 'commercial_bank',
    ),
    obligations: ObligationsPayload(
      existingMonthlyObligationsEGP:
          egp(hasFacilities ? (double.tryParse(state.currentInstallments.trim()) ?? 0) : 0),
      hasCurrentLoan: hasFacilities,
      hasPreviousRejection: state.priorRejection ?? false,
    ),
    assets: const AssetsPayload(),
  );
}
