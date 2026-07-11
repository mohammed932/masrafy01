import 'package:app/features/matching/data/models/request/apply_request.dart';
import 'package:app/features/questionnaire/presentation/mappers/apply_mapping.dart';

/// Maps the business-loan questionnaire answers (backend `{questionCode →
/// optionCode}`) to `ApplyRequest`. Mirrors [mapCarAnswersToApplyRequest] /
/// [mapMortgageAnswersToApplyRequest]: the backend `apply` DTO still needs the
/// economic fields for offer math, so the picked buckets are translated to
/// representative values via the maps below (documented MVP approximations, like
/// `apply_mapping.dart`). The full picked answers also ride along as
/// `questionnaireAnswers` so the engine applies per-bank weighted scoring
/// (Principle V). `age` stays null — the results cubit fills it from the profile
/// (`/auth/me`).
///
/// Business has no dedicated details payload (no `carDetails`/`mortgageDetails`
/// equivalent): revenue stands in for `monthlyNetSalaryEGP`, business age for
/// `monthsInJob`, and employment is fixed to `business_owner`.
///
/// Codes mirror `backend/prisma/seed-questionnaire.ts` (business category).
ApplyRequest mapBusinessAnswersToApplyRequest(
  Map<String, String> answers, {
  int? versionNumber,
}) {
  final hasCurrentLoan = answers['current_facilities'] == 'yes';

  return ApplyRequest(
    loanPurpose: 'business',
    requestedAmountEGP:
        amountEgp(_financingAmountEgp[answers['financing_amount']] ?? 0),
    preferredTenorMonths: _tenorMonths(answers['repayment_period']),
    priority: _priority(answers['priority_factor']),
    employment: EmploymentPayload(
      employmentType: 'business_owner',
      // Average monthly business revenue stands in for net salary.
      monthlyNetSalaryEGP: egp(_revenueEgp[answers['monthly_revenue']] ?? 0),
      monthsInJob: _monthsInBusiness(answers['business_age']),
      salaryTransferType: 'none',
      companyName: 'N/A',
      companyType: 'commercial_bank',
    ),
    obligations: ObligationsPayload(
      existingMonthlyObligationsEGP: egp(
        hasCurrentLoan
            ? (_installmentsEgp[answers['current_installments']] ?? 0)
            : 0,
      ),
      hasCurrentLoan: hasCurrentLoan,
      hasPreviousRejection: answers['prior_rejection'] == 'yes',
    ),
    assets: const AssetsPayload(),
    category: 'business',
    questionnaireAnswers: [
      for (final entry in answers.entries)
        QuestionnaireAnswer(questionCode: entry.key, optionCode: entry.value),
    ],
  );
}

/// Representative financing amount (EGP) per `financing_amount` bucket.
const Map<String, double> _financingAmountEgp = {
  'less_than_egp_250000': 200000,
  'egp_250000_1_million': 600000,
  'egp_1_5_million': 3000000,
  'more_than_egp_5_million': 7000000,
};

/// Representative average monthly revenue (EGP) per `monthly_revenue` bucket.
const Map<String, double> _revenueEgp = {
  'less_than_egp_50000': 40000,
  'egp_50000_200000': 125000,
  'egp_200000_500000': 350000,
  'more_than_egp_500000': 700000,
};

/// Representative current monthly obligation (EGP) per `current_installments`
/// bucket.
const Map<String, double> _installmentsEgp = {
  'less_than_egp_10000': 6000,
  'egp_10000_50000': 30000,
  'more_than_egp_50000': 75000,
};

/// `business_age` bucket → representative `monthsInJob` (business operating age).
int _monthsInBusiness(String? bucket) => switch (bucket) {
      'less_than_1_year' => 6,
      '1_to_2_years' => 18,
      'more_than_2_years' => 48,
      _ => 24,
    };

/// `repayment_period` bucket → months, clamped to the backend's 6–360 band.
int _tenorMonths(String? bucket) {
  final months = switch (bucket) {
    'less_than_2_years' => 18,
    '2_5_years' => 42,
    'more_than_5_years' => 84,
    _ => 36,
  };
  return months.clamp(6, 360);
}

/// `priority_factor` seed code → backend `priority` enum
/// (`lowest_installment | lowest_interest | fastest_approval | least_paperwork`).
String _priority(String? code) => switch (code) {
      'flexible_repayment' || 'highest_financing_amount' => 'lowest_installment',
      'lowest_interest_rate' => 'lowest_interest',
      'least_documentation_required' => 'least_paperwork',
      _ => 'fastest_approval',
    };
