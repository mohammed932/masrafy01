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
/// amount the applicant actually asked for. Job, months in the current job and
/// salary transfer go through the same shared helpers as personal and mortgage.
/// The full answer set rides along as `questionnaireAnswers` — the only path for
/// an answer with no field of its own on the request. No `age`: the server
/// derives it from the profile's birthday (A31).
///
/// Carries the SURROGATE FACTS ([SurrogateFacts]) for the same reason the personal
/// mapper does: a car program asks them when its bank program reads them (a question
/// carries no loan type, and there is no capable-category list in code), so a bank may
/// finance a car off an assumed income worked out from a grade, a rank, years in
/// practice or a card limit. The backend derives the same facts from `questionnaireAnswers`, so these
/// body fields are the documented duplicate rather than the only path — they exist so a
/// car apply reads identically to a personal one (A25).
///
/// Codes mirror `backend/prisma/seed-questionnaire.ts`.
ApplyRequest mapCarAnswersToApplyRequest(
  Map<String, QuestionAnswer> answers, {
  String? programNameKey,
  String? programType,
}) {
  final money = MoneyFigures.fromAnswers(answers);
  final facts = SurrogateFacts.fromAnswers(answers);
  // `employment_status` IS asked in car since 2026-09-24: CAE caps a self-employed
  // buyer at 60 months.
  final employmentType =
      employmentTypeFor(pickedOption(answers, 'employment_status'));

  final price = num.tryParse(numericOf(answers, 'car_price') ?? '')?.toDouble();
  final downPayment =
      num.tryParse(numericOf(answers, 'car_down_payment') ?? '')?.toDouble();

  return ApplyRequest(
    loanPurpose: 'car',
    requestedAmountEGP: money.requestedAmountEGP,
    preferredTenorMonths: money.tenorMonths,
    priority: mapPriority(pickedOption(answers, 'priority_factor')),
    employment: EmploymentPayload(
      employmentType: employmentType,
      monthlyNetSalaryEGP: money.monthlyIncomeEGP,
      // Read exactly as personal and mortgage read them: whatever the served snapshot
      // asks (`months_in_current_job` / `can_transfer_salary`, or the retired buckets
      // for a session holding an older questionnaire) is honoured, and an unasked one
      // falls back to 24 months / `none`.
      monthsInJob: monthsInJobFrom(answers),
      salaryTransferType: salaryTransferTypeFrom(answers),
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
