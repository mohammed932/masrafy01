import 'package:app/features/matching/data/models/request/apply_request.dart';
import 'package:app/features/questionnaire/domain/entities/question_answer.dart';
import 'package:app/features/questionnaire/presentation/mappers/apply_mapping.dart';

/// Maps the questionnaire answers to a car-loan `ApplyRequest`.
///
/// Amount, tenor, income and current installments come from the bound NUMERIC
/// questions via [MoneyFigures] (feature 010 — no bucket midpoints). The
/// vehicle price and down-payment percentage are still choice answers with no
/// NUMERIC binding, so they keep their documented representative values and
/// feed `carDetails` only; the financed principal is the amount the applicant
/// actually asked for. The full answer set rides along as `questionnaireAnswers`
/// so the engine applies per-bank weighted scoring (Principle V). `age` stays
/// null — the results cubit fills it from the profile (`/auth/me`).
///
/// Codes mirror `backend/prisma/seed-questionnaire.ts`.
ApplyRequest mapCarAnswersToApplyRequest(Map<String, QuestionAnswer> answers) {
  final money = MoneyFigures.fromAnswers(answers);
  final employmentCode = pickedOption(answers, 'employment_status');
  final employmentType =
      _employmentType[employmentCode] ?? employmentCode ?? 'salaried';

  final price = _vehiclePriceEgp[pickedOption(answers, 'vehicle_price')] ?? 0;
  final downPayment =
      price * (_downPaymentPct[pickedOption(answers, 'down_payment')] ?? 0);

  return ApplyRequest(
    loanPurpose: 'car',
    requestedAmountEGP: money.requestedAmountEGP,
    preferredTenorMonths: money.tenorMonths,
    priority: _priority(pickedOption(answers, 'priority_factor')),
    employment: EmploymentPayload(
      employmentType: employmentType,
      monthlyNetSalaryEGP: money.monthlyIncomeEGP,
      // Car questions don't ask job tenure — use the shared fallback.
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
      hasPreviousRejection: false, // not asked in the car questions
    ),
    assets: const AssetsPayload(),
    carDetails: CarDetailsPayload(
      carValueEGP: egp(price),
      downPaymentEGP: egp(downPayment),
    ),
    category: 'car',
    questionnaireAnswers: toSubmittedAnswers(answers),
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

/// `employment_status` seed code → the engine's `employmentType` token
/// (the engine keys on the shorter legacy tokens for bank-employee programs).
const Map<String, String> _employmentType = {
  'government_employee': 'government_employee',
  'private_sector_employee': 'private_employee',
  'business_owner_company_owner': 'business_owner',
  'freelancer': 'freelancer',
  'retired': 'retired',
};

/// `priority_factor` seed code → backend `priority` enum
/// (`lowest_installment | lowest_interest | fastest_approval | least_paperwork`).
String _priority(String? code) => switch (code) {
      'lowest_down_payment' || 'lowest_monthly_installment' => 'lowest_installment',
      'lowest_interest_rate' => 'lowest_interest',
      'financing_without_a_guarantor' => 'least_paperwork',
      _ => 'fastest_approval',
    };
