import 'package:app/features/matching/data/models/request/apply_request.dart';
import 'package:app/features/questionnaire/presentation/mappers/apply_mapping.dart';

/// Maps the car-loan questionnaire answers (backend `{questionCode → optionCode}`)
/// to `ApplyRequest`. Mirrors [mapMortgageAnswersToApplyRequest] /
/// [mapPersonalAnswersToApplyRequest]: the backend `apply` DTO still needs the
/// economic fields for offer math, so the picked buckets are translated to
/// representative values via the maps below (documented MVP approximations, like
/// `apply_mapping.dart`). The full picked answers also ride along as
/// `questionnaireAnswers` so the engine applies per-bank weighted scoring
/// (Principle V). `age` stays null — the results cubit fills it from the profile
/// (`/auth/me`). The car snapshot has no `prior_rejection` question.
///
/// Codes mirror `backend/prisma/seed-questionnaire.ts` (car category).
ApplyRequest mapCarAnswersToApplyRequest(
  Map<String, String> answers, {
  int? versionNumber,
}) {
  final employmentType = _employmentType[answers['employment_status']] ??
      answers['employment_status'] ??
      'salaried';
  final hasCurrentLoan = answers['current_loans'] == 'yes';

  final price = _vehiclePriceEgp[answers['vehicle_price']] ?? 0;
  final downPayment = price * (_downPaymentPct[answers['down_payment']] ?? 0);

  return ApplyRequest(
    loanPurpose: 'car',
    // Financed principal = vehicle price − down payment.
    requestedAmountEGP: amountEgp(price - downPayment),
    preferredTenorMonths: _tenorMonths(answers['repayment_period']),
    priority: _priority(answers['priority_factor']),
    employment: EmploymentPayload(
      employmentType: employmentType,
      monthlyNetSalaryEGP: egp(_incomeEgp[answers['monthly_income']] ?? 0),
      // Car snapshot doesn't ask job tenure — use the shared fallback.
      monthsInJob: monthsFromTenure(null),
      salaryTransferType:
          salaryTransferType(transfers: answers['salary_transfer'] == 'yes'),
      companyName: 'N/A',
      companyType: companyTypeFor(employmentType),
    ),
    obligations: ObligationsPayload(
      existingMonthlyObligationsEGP: egp(
        hasCurrentLoan
            ? (_installmentsEgp[answers['current_installments']] ?? 0)
            : 0,
      ),
      hasCurrentLoan: hasCurrentLoan,
      hasPreviousRejection: false, // not asked in the car questionnaire
    ),
    assets: const AssetsPayload(),
    carDetails: CarDetailsPayload(
      carValueEGP: egp(price),
      downPaymentEGP: egp(downPayment),
    ),
    category: 'car',
    questionnaireAnswers: [
      for (final entry in answers.entries)
        QuestionnaireAnswer(questionCode: entry.key, optionCode: entry.value),
    ],
  );
}

/// Representative vehicle price (EGP) per `vehicle_price` bucket.
const Map<String, double> _vehiclePriceEgp = {
  'less_than_egp_500000': 400000,
  'egp_500000_1_million': 750000,
  'egp_1_2_million': 1500000,
  'more_than_egp_2_million': 3000000,
};

/// `down_payment` bucket → representative fraction of the vehicle price.
const Map<String, double> _downPaymentPct = {
  'no_down_payment': 0,
  'less_than_20': 0.10,
  '20_40': 0.30,
  'more_than_40': 0.45,
};

/// Representative monthly net salary (EGP) per car `monthly_income` bucket.
const Map<String, double> _incomeEgp = {
  'less_than_egp_10000': 8000,
  'egp_10000_25000': 17500,
  'egp_25000_50000': 37500,
  'more_than_egp_50000': 65000,
};

/// Representative existing installment (EGP) per car `current_installments`
/// bucket.
const Map<String, double> _installmentsEgp = {
  'less_than_egp_3000': 2000,
  'egp_3000_7000': 5000,
  'egp_7000_15000': 11000,
  'more_than_egp_15000': 20000,
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
    '3_5_years' => 48,
    '5_7_years' => 72,
    'more_than_7_years' => 96,
    _ => 60,
  };
  return months.clamp(6, 360);
}

/// `priority_factor` seed code → backend `priority` enum
/// (`lowest_installment | lowest_interest | fastest_approval | least_paperwork`).
String _priority(String? code) => switch (code) {
      'lowest_down_payment' || 'lowest_monthly_installment' => 'lowest_installment',
      'lowest_interest_rate' => 'lowest_interest',
      'financing_without_a_guarantor' => 'least_paperwork',
      _ => 'fastest_approval',
    };
