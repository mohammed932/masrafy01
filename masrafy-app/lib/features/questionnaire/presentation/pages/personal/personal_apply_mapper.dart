import 'package:app/features/matching/data/models/request/apply_request.dart';
import 'package:app/features/questionnaire/presentation/mappers/apply_mapping.dart';

/// Maps the personal-loan questionnaire answers (backend `{questionCode →
/// optionCode}`) to `ApplyRequest`. The backend `apply` DTO still requires the
/// economic fields for offer math, so bucket answers are translated to
/// representative values via the maps below (documented MVP approximations,
/// like `apply_mapping.dart`). The full picked answers also ride along as
/// `questionnaireAnswers` so the engine applies per-bank weighted scoring
/// (Principle V). `age` stays null — the results cubit fills it from the
/// profile (`/auth/me`); the sub-purpose has no backend field so `loanPurpose`
/// carries the category id `personal`.
///
/// Codes mirror `backend/prisma/seed-questionnaire.ts` (personal category).
ApplyRequest mapPersonalAnswersToApplyRequest(
  Map<String, String> answers, {
  int? versionNumber,
}) {
  final employmentType = _employmentType[answers['employment_status']] ??
      answers['employment_status'] ??
      'salaried';
  final hasCurrentLoan =
      answers['current_loans'] != null && answers['current_loans'] != 'none';

  return ApplyRequest(
    loanPurpose: 'personal',
    requestedAmountEGP: amountEgp(_amountEgp[answers['amount_requested']] ?? 0),
    preferredTenorMonths: _tenorMonths(answers['repayment_period']),
    priority: _priority(answers['priority_factor']),
    employment: EmploymentPayload(
      employmentType: employmentType,
      monthlyNetSalaryEGP: egp(_incomeEgp[answers['monthly_income']] ?? 0),
      monthsInJob: _monthsInJob[answers['job_tenure']] ?? 24,
      salaryTransferType:
          salaryTransferType(transfers: answers['salary_transfer'] == 'yes'),
      companyName: 'N/A',
      companyType: companyTypeFor(employmentType),
    ),
    obligations: ObligationsPayload(
      existingMonthlyObligationsEGP: egp(
        hasCurrentLoan ? (_installmentsEgp[answers['current_installments']] ?? 0) : 0,
      ),
      hasCurrentLoan: hasCurrentLoan,
      hasPreviousRejection: answers['prior_rejection'] == 'yes',
    ),
    assets: const AssetsPayload(),
    category: 'personal',
    questionnaireAnswers: [
      for (final entry in answers.entries)
        QuestionnaireAnswer(questionCode: entry.key, optionCode: entry.value),
    ],
  );
}

/// Representative principal (EGP) per `amount_requested` bucket.
const Map<String, double> _amountEgp = {
  'less_than_egp_50_000': 30000,
  'egp_50_000_150_000': 100000,
  'egp_150_000_500_000': 300000,
  'more_than_egp_500_000': 750000,
};

/// Representative monthly net salary (EGP) per `monthly_income` bucket.
const Map<String, double> _incomeEgp = {
  'less_than_egp_10_000': 8000,
  'egp_10_000_20_000': 15000,
  'egp_20_000_40_000': 30000,
  'more_than_egp_40_000': 60000,
};

/// Representative existing installment (EGP) per `current_installments` bucket.
const Map<String, double> _installmentsEgp = {
  'less_than_egp_2_000': 1500,
  'egp_2_000_5_000': 3500,
  'egp_5_000_10_000': 7500,
  'more_than_egp_10_000': 15000,
};

/// `job_tenure` bucket → representative months in job.
const Map<String, int> _monthsInJob = {
  'less_than_6_months': 3,
  '6_months_to_1_year': 9,
  '1_to_3_years': 24,
  'more_than_3_years': 48,
};

/// `employment_status` seed code → the engine's `employmentType` token
/// (the engine keys on the shorter legacy tokens for bank-employee programs).
const Map<String, String> _employmentType = {
  'government_employee': 'government_employee',
  'private_sector_employee': 'private_employee',
  'business_owner_company_owner': 'business_owner',
  'freelancer': 'freelancer',
  'retired': 'retired',
};

/// `repayment_period` bucket → months, clamped to the backend's 6–360 band.
int _tenorMonths(String? bucket) {
  final months = switch (bucket) {
    'less_than_3_years' => 24,
    '3_to_5_years' => 48,
    '5_to_7_years' => 72,
    'more_than_7_years' => 96,
    _ => 48,
  };
  return months.clamp(6, 360);
}

/// `priority_factor` seed code → backend `priority` enum
/// (`lowest_installment | lowest_interest | fastest_approval | least_paperwork`).
String _priority(String? code) => switch (code) {
      'lowest_monthly_installment' || 'flexible_repayment' => 'lowest_installment',
      'lowest_interest_rate' => 'lowest_interest',
      'least_documentation_required' => 'least_paperwork',
      _ => 'fastest_approval',
    };
