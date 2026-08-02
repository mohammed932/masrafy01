import 'package:app/features/matching/data/models/request/apply_request.dart';
import 'package:app/features/questionnaire/domain/entities/question_answer.dart';
import 'package:app/features/questionnaire/presentation/mappers/apply_mapping.dart';

/// Maps the questionnaire answers to a mortgage `ApplyRequest`.
///
/// Amount, tenor, income and current installments come from the bound NUMERIC
/// questions via [MoneyFigures] (feature 010 — no bucket midpoints). Property
/// value and down-payment percentage are still choice answers with no NUMERIC
/// binding, so they keep their documented representative values and feed
/// `mortgageDetails` only; the financed principal is the amount the applicant
/// actually asked for. The full answer set rides along as `questionnaireAnswers`
/// so the engine applies per-bank weighted scoring (Principle V). `age` stays
/// null — the results cubit fills it from the profile (`/auth/me`).
///
/// Codes mirror `backend/prisma/seed-questionnaire.ts`.
ApplyRequest mapMortgageAnswersToApplyRequest(
  Map<String, QuestionAnswer> answers,
) {
  final money = MoneyFigures.fromAnswers(answers);
  final employmentCode = pickedOption(answers, 'employment_status');
  final employmentType =
      _employmentType[employmentCode] ?? employmentCode ?? 'salaried';

  final propertyValue =
      _propertyValueEgp[pickedOption(answers, 'property_value')] ?? 0;
  final downPayment = propertyValue *
      (_downPaymentPct[pickedOption(answers, 'down_payment')] ?? 0);

  return ApplyRequest(
    loanPurpose: 'mortgage',
    requestedAmountEGP: money.requestedAmountEGP,
    preferredTenorMonths: money.tenorMonths,
    priority: _priority(pickedOption(answers, 'priority_factor')),
    employment: EmploymentPayload(
      employmentType: employmentType,
      monthlyNetSalaryEGP: money.monthlyIncomeEGP,
      // Mortgage questions don't ask job tenure — use the shared fallback.
      monthsInJob: monthsFromTenure(null),
      salaryTransferType: salaryTransferType(
        answerCode: pickedOption(answers, 'salary_transfer'),
      ),
      companyName: 'N/A',
      companyType: companyTypeFor(employmentType),
    ),
    obligations: ObligationsPayload(
      existingMonthlyObligationsEGP: money.existingObligationsEGP,
      hasCurrentLoan: money.hasCurrentLoan,
      hasPreviousRejection: pickedOption(answers, 'prior_rejection') == 'yes',
    ),
    assets: const AssetsPayload(),
    mortgageDetails: MortgageDetailsPayload(
      propertyValueEGP: egp(propertyValue),
      downPaymentEGP: egp(downPayment),
      propertyType: _propertyType(pickedOption(answers, 'property_type')),
      isCompound: pickedOption(answers, 'in_compound') == 'yes',
      constructionStage:
          _constructionStage(pickedOption(answers, 'registration_status')),
    ),
    category: 'mortgage',
    questionnaireAnswers: toSubmittedAnswers(answers),
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

/// `employment_status` seed code → the engine's `employmentType` token
/// (the engine keys on the shorter legacy tokens for bank-employee programs).
const Map<String, String> _employmentType = {
  'government_employee': 'government_employee',
  'private_sector_employee': 'private_employee',
  'business_owner_company_owner': 'business_owner',
  'freelancer': 'freelancer',
  'retired': 'retired',
};

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
