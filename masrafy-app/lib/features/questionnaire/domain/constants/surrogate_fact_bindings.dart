/// Which questionnaire answer feeds which SURROGATE-INCOME fact — the mobile
/// mirror of `backend/src/matching/pipeline/surrogate-fact-bindings.ts`.
///
/// CODE CONSTANTS on both sides, for the same reason the money bindings are:
/// Anti-Pattern A33 forbids scoring / eligibility / profile-mapping fields on
/// `Question`, so the binding can never live on the question row. Renaming a bound
/// question code is therefore a code change on both platforms — the accepted
/// residual limit feature 010 recorded and this feature inherits.
///
/// The codes are the SLUG of each question's English label (`slug.util.ts` derives
/// them; hand-typed codes are an A33 violation), so the labels in
/// `prisma/seed-questionnaire.ts` are load-bearing on this side too: "Military
/// grade" → `military_grade` binds, "Your military grade" would not.
///
/// A fact the applicant was not asked, or skipped, is OMITTED from the apply body —
/// never sent as zero and never defaulted. The bank's rule then reports
/// `SURROGATE_FACT_MISSING` and the program is still listed, with a stated reason
/// (FR-020, FR-022).
library;

/// `employment.militaryGrade` — SINGLE_SELECT whose option codes ARE the active
/// `military_grade` platform-registry keys, which is what the admin's table rows are
/// keyed by. Gated on `employment_status == government_employee`.
const String kMilitaryGradeQuestion = 'military_grade';

/// `employment.professorRank` — SINGLE_SELECT over the `professor_rank` registry.
///
/// The QUESTION is "Academic rank" while the REGISTRY is `professor_rank`: a lecturer
/// is not a professor and would not answer a question that said so. Shares the
/// `government_employee` gate with the grade question, because `enabledWhen` holds one
/// option code and no employment option separates a soldier from an academic — so a
/// government employee is asked both and skips the one that does not apply.
const String kAcademicRankQuestion = 'academic_rank';

/// `employment.yearsInPractice` — NUMERIC, 0–60 whole years. Ungated: its population
/// spans freelancers and business owners, which one branch rule cannot express.
const String kYearsInPracticeQuestion = 'years_in_practice';

/// `assets.creditCardLimitEGP` — the FOURTH fact, and NOT a new question.
///
/// Deliberately the same `credit_card_total_limit` the commitments step already asks
/// (see `money_field_bindings.dart`), whose figure feeds the 5% monthly-obligation
/// discount. One fact, two uses, asked once — a second card-limit question would ask
/// the applicant the same thing twice.
///
/// Accepted limit: that question is itself branched behind ticking `credit_cards` in
/// `current_loans`, so a card holder who declared no card debt is never asked and a
/// `byCreditCardLimit` rule reports `SURROGATE_FACT_MISSING`. Correct per FR-020, but
/// it caps how often that one method produces a figure.
const String kCreditCardLimitFactQuestion = 'credit_card_total_limit';

/// Every question code a surrogate fact binds to. Used by tests and by any surface
/// that needs to know whether an answer is fact-bearing.
const List<String> kSurrogateFactQuestionCodes = [
  kMilitaryGradeQuestion,
  kAcademicRankQuestion,
  kYearsInPracticeQuestion,
  kCreditCardLimitFactQuestion,
];
