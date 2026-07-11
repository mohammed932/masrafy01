import 'package:app/features/matching/data/models/request/apply_request.dart';
import 'package:app/features/questionnaire/presentation/mappers/apply_mapping.dart';

/// Maps the mortgage-loan questionnaire answers (backend `{questionCode →
/// optionCode}`) to `ApplyRequest`. Mirrors [mapPersonalAnswersToApplyRequest]:
/// the backend `apply` DTO still needs the economic fields for offer math, so
/// the picked buckets are translated to representative values via the maps below
/// (documented MVP approximations, like `apply_mapping.dart`). The full picked
/// answers also ride along as `questionnaireAnswers` so the engine applies
/// per-bank weighted scoring (Principle V). `age` stays null — the results cubit
/// fills it from the profile (`/auth/me`).
///
/// Codes mirror `backend/prisma/seed-questionnaire.ts` (mortgage category); the
/// mortgage income / property-value / down-payment buckets differ from personal.
ApplyRequest mapMortgageAnswersToApplyRequest(
  Map<String, String> answers, {
  int? versionNumber,
}) {
  final employmentType = _employmentType[answers['employment_status']] ??
      answers['employment_status'] ??
      'salaried';
  final hasCurrentLoan = answers['current_loans'] == 'yes';

  final propertyValue = _propertyValueEgp[answers['property_value']] ?? 0;
  final downPayment =
      propertyValue * (_downPaymentPct[answers['down_payment']] ?? 0);

  return ApplyRequest(
    loanPurpose: 'mortgage',
    // Financed principal = property value − down payment.
    requestedAmountEGP: amountEgp(propertyValue - downPayment),
    preferredTenorMonths: _tenorMonths(answers['repayment_period']),
    priority: _priority(answers['priority_factor']),
    employment: EmploymentPayload(
      employmentType: employmentType,
      monthlyNetSalaryEGP: egp(_incomeEgp[answers['monthly_income']] ?? 0),
      // Mortgage snapshot doesn't ask job tenure — use the shared fallback.
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
      hasPreviousRejection: answers['prior_rejection'] == 'yes',
    ),
    assets: const AssetsPayload(),
    mortgageDetails: MortgageDetailsPayload(
      propertyValueEGP: egp(propertyValue),
      downPaymentEGP: egp(downPayment),
      propertyType: _propertyType(answers['property_type']),
      isCompound: answers['in_compound'] == 'yes',
      constructionStage: _constructionStage(answers['registration_status']),
    ),
    category: 'mortgage',
    questionnaireAnswers: [
      for (final entry in answers.entries)
        QuestionnaireAnswer(questionCode: entry.key, optionCode: entry.value),
    ],
  );
}

/// Representative property value (EGP) per `property_value` bucket.
const Map<String, double> _propertyValueEgp = {
  'less_than_egp_1_million': 800000,
  'egp_1_3_million': 2000000,
  'egp_3_5_million': 4000000,
  'more_than_egp_5_million': 7000000,
};

/// `down_payment` bucket → representative fraction of the property value.
const Map<String, double> _downPaymentPct = {
  'less_than_10': 0.05,
  '10_20': 0.15,
  '20_30': 0.25,
  'more_than_30': 0.35,
};

/// Representative monthly net salary (EGP) per mortgage `monthly_income` bucket
/// (differs from the personal bands — starts at "Less than EGP 15,000").
const Map<String, double> _incomeEgp = {
  'less_than_egp_15000': 12000,
  'egp_15000_30000': 22000,
  'egp_30000_60000': 45000,
  'more_than_egp_60000': 80000,
};

/// Representative existing installment (EGP) per mortgage `current_installments`
/// bucket.
const Map<String, double> _installmentsEgp = {
  'less_than_egp_5000': 3000,
  'egp_5000_15000': 10000,
  'egp_15000_30000': 22000,
  'more_than_egp_30000': 40000,
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
    'less_than_10_years' => 96,
    '10_15_years' => 144,
    '15_20_years' => 216,
    'more_than_20_years' => 300,
    _ => 240,
  };
  return months.clamp(6, 360);
}

/// Questionnaire `property_type` code → matching-registry `property_type` key.
/// The registry accepts only `apartment | twin_house | villa`, so the richer
/// questionnaire set collapses: `villa` maps through, everything else
/// (`apartment`, `duplex`, `commercial_shop`, `administrative_office`, `other`)
/// → `apartment` (documented MVP approximation).
String _propertyType(String? code) => code == 'villa' ? 'villa' : 'apartment';

/// `registration_status` code → `constructionStage` free string (backend
/// unconstrained; the engine cascade reads it for a subset of programs).
String _constructionStage(String? code) =>
    code == 'officially_registered' ? 'ready' : 'under_construction';

/// `priority_factor` seed code → backend `priority` enum
/// (`lowest_installment | lowest_interest | fastest_approval | least_paperwork`).
String _priority(String? code) => switch (code) {
      'lowest_monthly_installment' ||
      'longest_repayment_period' ||
      'lowest_down_payment' =>
        'lowest_installment',
      'lowest_administrative_fees' => 'least_paperwork',
      _ => 'fastest_approval',
    };
