import 'package:app/features/matching/data/models/request/apply_request.dart';
import 'package:app/features/questionnaire/domain/entities/question_answer.dart';
import 'package:app/features/questionnaire/presentation/mappers/apply_mapping.dart';

/// Maps the questionnaire answers to a personal-loan `ApplyRequest`.
///
/// The four economic figures (amount, tenor, income, current installments) come
/// straight from the bound NUMERIC questions via [MoneyFigures] — the bucket →
/// representative-value maps this file used to carry are gone (feature 010:
/// an applicant asking for 500 000 was being quoted on 300 000). Job, months in
/// the current job and salary transfer go through the shared helpers
/// ([employmentTypeFor], [monthsInJobFrom], [salaryTransferTypeFrom]) and the
/// priority through [mapPriority], so car and mortgage read them identically.
/// The full answer set also rides along as `questionnaireAnswers` — the only
/// path for an answer with no field of its own on the request (`i_score_band`,
/// the residence pair, the yes/no income-proof questions). No `age`: the server
/// derives it from the profile's birthday (A31). The sub-purpose has no backend
/// field, so `loanPurpose` carries the category id `personal`.
///
/// Feature 011 adds the SURROGATE FACTS ([SurrogateFacts]) — military grade, academic
/// rank, years in practice and the credit-card limit. Each is omitted when unanswered
/// rather than defaulted, so a bank's rule can say "we haven't asked you this" instead
/// of pricing a guess.
///
/// `questionnaireVersionId` is deliberately unset: the snapshot exposes a
/// version NUMBER, not the version id the DTO wants, and the backend falls back
/// to the active version.
///
/// Codes mirror `backend/prisma/seed-questionnaire.ts`.
ApplyRequest mapPersonalAnswersToApplyRequest(
  Map<String, QuestionAnswer> answers, {
  String? programNameKey,
  String? programType,
}) {
  final money = MoneyFigures.fromAnswers(answers);
  // Feature 011 — the surrogate-income facts. Which programs ask them is decided
  // server-side (a program asks what its bank program reads), not by a list in
  // code, so the car mapper reads them the same way. The server derives the same
  // facts from `questionnaireAnswers`; these body fields are the documented duplicate.
  final facts = SurrogateFacts.fromAnswers(answers);
  final employmentType =
      employmentTypeFor(pickedOption(answers, 'employment_status'));

  return ApplyRequest(
    loanPurpose: 'personal',
    requestedAmountEGP: money.requestedAmountEGP,
    preferredTenorMonths: money.tenorMonths,
    priority: mapPriority(pickedOption(answers, 'priority_factor')),
    employment: EmploymentPayload(
      employmentType: employmentType,
      monthlyNetSalaryEGP: money.monthlyIncomeEGP,
      monthsInJob: monthsInJobFrom(answers),
      salaryTransferType: salaryTransferTypeFrom(answers),
      companyName: 'N/A',
      companyType: companyTypeFor(employmentType),
      // Each stays null — and is therefore omitted from the JSON — when the fact was
      // not answered, which is the normal case for most applicants. Sending a zero or
      // an empty string instead would make the bank's rule report "your grade isn't in
      // this table" when the truth is "we never asked you" (FR-020).
      militaryGrade: facts.militaryGrade,
      professorRank: facts.professorRank,
      yearsInPractice: facts.yearsInPractice,
    ),
    obligations: ObligationsPayload(
      existingMonthlyObligationsEGP: money.existingObligationsEGP,
      // Both derived from the itemised debt answers — the total is the SUM of the
      // per-debt amounts, and this flag comes from which TYPES were ticked (a
      // card at a zero minimum payment is still a loan on book).
      hasCurrentLoan: money.hasCurrentLoan,
      hasPreviousRejection: pickedOption(answers, 'prior_rejection') == 'yes',
    ),
    // Was `const AssetsPayload()` — an empty object. The card limit IS answered, in
    // the commitments step, and fed the 5% obligation discount server-side; it just
    // never left the phone as an asset, so every `byCreditCardLimit` income rule
    // resolved to nothing for every customer alive (FR-019).
    assets: facts.assets,
    category: 'personal',
    programNameKey: programNameKey,
    programType: programType,
    questionnaireAnswers: toSubmittedAnswers(answers),
  );
}
