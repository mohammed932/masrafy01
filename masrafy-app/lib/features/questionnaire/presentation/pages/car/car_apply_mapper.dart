import 'package:app/features/matching/data/models/request/apply_request.dart';
import 'package:app/features/questionnaire/domain/entities/question_answer.dart';
import 'package:app/features/questionnaire/presentation/mappers/apply_mapping.dart';

/// Maps the questionnaire answers to a car-loan `ApplyRequest`.
///
/// Amount, tenor, income and current installments come from the bound NUMERIC
/// questions via [MoneyFigures] (feature 010 — no bucket midpoints). The car's
/// PRICE and DOWN PAYMENT are now typed too: a bank that reads the down payment
/// as proof of income (`income = down payment ÷ 3.6`) and caps the loan at a
/// share of the price cannot be quoted off a bucket midpoint. Both are omitted
/// when unanswered rather than zeroed — the backend then applies no LTV cap and
/// says so, instead of capping at nothing. The financed principal is still the
/// amount the applicant actually asked for. The full answer set rides along as `questionnaireAnswers`
/// so the engine applies per-bank weighted scoring (Principle V). `age` stays
/// null — the results cubit fills it from the profile (`/auth/me`).
///
/// Carries the SURROGATE FACTS ([SurrogateFacts]) for the same reason the personal
/// mapper does: an auto loan is surrogate-CAPABLE (backend
/// `SURROGATE_CAPABLE_CATEGORIES`), so a bank may finance a car off an assumed income
/// worked out from a grade, a rank, years in practice or a card limit. The backend
/// derives the same facts from `questionnaireAnswers`, so these body fields are the
/// documented duplicate rather than the only path — they exist so a car apply reads
/// identically to a personal one (A25).
///
/// Codes mirror `backend/prisma/seed-questionnaire.ts`.
ApplyRequest mapCarAnswersToApplyRequest(
  Map<String, QuestionAnswer> answers, {
  String? programNameKey,
  String? programType,
}) {
  final money = MoneyFigures.fromAnswers(answers);
  final facts = SurrogateFacts.fromAnswers(answers);
  final employmentCode = pickedOption(answers, 'employment_status');
  final employmentType =
      _employmentType[employmentCode] ?? employmentCode ?? 'salaried';

  final price = num.tryParse(numericOf(answers, 'car_price') ?? '')?.toDouble();
  final downPayment =
      num.tryParse(numericOf(answers, 'car_down_payment') ?? '')?.toDouble();

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
      // Omitted from the JSON when unanswered, never zeroed: a bank rule must be able
      // to say "we never asked you this" rather than "your grade isn't in our table"
      // (FR-020).
      militaryGrade: facts.militaryGrade,
      professorRank: facts.professorRank,
      yearsInPractice: facts.yearsInPractice,
    ),
    obligations: ObligationsPayload(
      existingMonthlyObligationsEGP: money.existingObligationsEGP,
      hasCurrentLoan: money.hasCurrentLoan,
      hasPreviousRejection: false, // not asked in the car questions
    ),
    // The card limit IS answered, in the commitments step, and feeds both the 5%
    // obligation discount and a `byCreditCardLimit` income rule.
    assets: facts.assets,
    // Omitted when either is unanswered: the server derives the same pair from
    // `questionnaireAnswers`, and a zeroed price would cap every LTV program at nothing.
    carDetails: (price != null && downPayment != null)
        ? CarDetailsPayload(
            carValueEGP: egp(price),
            downPaymentEGP: egp(downPayment),
          )
        : null,
    category: 'car',
    programNameKey: programNameKey,
    programType: programType,
    questionnaireAnswers: toSubmittedAnswers(answers),
  );
}

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
