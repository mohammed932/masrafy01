/// Shared pure helpers that translate questionnaire answers into the typed
/// values `POST /api/v1/apply` expects (see the per-category
/// `*_apply_mapper.dart`).
///
/// Feature 010 split these into two kinds:
///   - **Money figures** — amount, tenor, income and current installments come
///     from the four bound NUMERIC questions (`MONEY_FIELD_BINDINGS`) and are
///     passed through verbatim. They are NEVER derived from a bucket midpoint
///     and never defaulted (FR-044): a customer asking for 500 000 used to be
///     quoted on 300 000.
///   - **Everything else** — job tenure, priority, property/vehicle bands — is
///     still a choice answer, so the documented MVP approximations below stay.
///
/// Money helpers emit decimal strings (Constitution Principle I / A3).
library;

import 'package:app/features/matching/data/models/request/apply_request.dart';
import 'package:app/features/questionnaire/domain/constants/money_field_bindings.dart';
import 'package:app/features/questionnaire/domain/constants/surrogate_fact_bindings.dart';
import 'package:app/features/questionnaire/domain/entities/question_answer.dart';

/// Backend apply bounds (`ApplyRequestDto`) for the values we still derive.
const double _minAmountEgp = 5000;
const double _maxAmountEgp = 50000000;
const int _minTenorMonths = 6;
const int _maxTenorMonths = 360;

/// Format any amount as a 2-decimal string, never negative.
String egp(num value) => (value < 0 ? 0 : value).toDouble().toStringAsFixed(2);

/// Format a DERIVED principal (car / mortgage financed amount), clamped to the
/// backend's 5,000–50,000,000 band. Never used for a figure the applicant typed
/// — those go through [MoneyFigures] untouched.
String amountEgp(num value) =>
    value.clamp(_minAmountEgp, _maxAmountEgp).toDouble().toStringAsFixed(2);

/// Years (wizard slider) → months, clamped to the backend's 6–360 band.
int tenorMonths(double years) =>
    (years * 12).round().clamp(_minTenorMonths, _maxTenorMonths);

/// Midpoint of a range-slider's two bounds.
double midpoint(double start, double end) => (start + end) / 2;

/// Wizard `salary_transfer` answer code → backend `transfer_type` registry key.
///
/// The question asks HOW the salary arrives, so every key a bank program can be
/// configured with is reachable. Option codes are slugged from the English label
/// by the questionnaire seed; only "No salary transfer" needs renaming, since the
/// registry key for it is `none`.
const Map<String, String> _transferTypeByAnswer = {
  'payroll': 'payroll',
  'salary_transfer_letter': 'salary_transfer_letter',
  'income_transfer_letter': 'income_transfer_letter',
  'no_salary_transfer': 'none',
};

/// Unanswered (the question is optional per category) falls back to `none` —
/// the honest reading of "the applicant did not claim a salary transfer".
String salaryTransferType({required String? answerCode}) =>
    _transferTypeByAnswer[answerCode] ?? 'none';

/// Derive `companyType` from the employment id (never collected by the wizard;
/// the engine only reads it for bank-employee programs).
String companyTypeFor(String employmentType) =>
    employmentType == 'government_employee' ? 'public_bank' : 'commercial_bank';

/// Job-tenure bucket → representative `monthsInJob`. [fallback] covers wizards
/// that don't ask (car / mortgage / business).
int monthsFromTenure(String? bucket, {int fallback = 24}) {
  switch (bucket) {
    case 'under_6m':
      return 3;
    case '6m_1y':
      return 9;
    case '1_3y':
      return 24;
    case 'over_3y':
      return 48;
    default:
      return fallback;
  }
}

/// Map any wizard `priorityFactor` id → backend `priority` enum
/// (`lowest_installment | lowest_interest | fastest_approval | least_paperwork`).
/// Only affects ranking; unmapped → `fastest_approval`.
String mapPriority(String? id) {
  switch (id) {
    case 'lowest_installment':
    case 'flexible_repayment':
    case 'lowest_down_payment':
    case 'longest_period':
    case 'highest_amount':
      return 'lowest_installment';
    case 'lowest_interest':
      return 'lowest_interest';
    case 'minimum_docs':
    case 'least_paperwork':
    case 'no_guarantor':
    case 'lowest_fees':
      return 'least_paperwork';
    case 'fastest_approval':
    default:
      return 'fastest_approval';
  }
}

// ---- Answer accessors -------------------------------------------------------

/// The single option code picked for [questionCode], or the first of a
/// multi-pick. Null when unanswered or when the answer is not a choice.
String? pickedOption(Map<String, QuestionAnswer> answers, String questionCode) {
  final codes = answers[questionCode]?.pickedOptionCodes ?? const <String>[];
  return codes.isEmpty ? null : codes.first;
}

/// Every option code picked for [questionCode] (empty when unanswered).
List<String> pickedOptions(
  Map<String, QuestionAnswer> answers,
  String questionCode,
) =>
    answers[questionCode]?.pickedOptionCodes ?? const <String>[];

// ---- Itemised obligations ---------------------------------------------------

/// The applicant's total monthly commitments, summed from the per-debt answers.
///
/// Only debts whose TYPE is currently ticked contribute, so un-ticking a type
/// drops its amount from the total even if the figure is still in state — the
/// same rule the server applies, and the same rule `visibleAnswers` applies when
/// deciding what to submit.
///
/// "Commitments", not "instalments": the credit-card answer is a LIMIT, and only
/// [obligationMonthlyAmountFor]'s discounted share of it is a monthly burden.
/// Every other type converts by identity.
///
/// Returns null when the snapshot serves no debt-type question (a questionnaire
/// published before this feature): the caller then falls back to the stated
/// figure, exactly as before. Picking "none" is NOT null — it is a real 0.
double? obligationsTotalOf(Map<String, QuestionAnswer> answers) {
  final picks = answers[kDebtTypesQuestion];
  if (picks == null || picks.isEmpty) return null;
  var total = 0.0;
  for (final pick in picks.pickedOptionCodes) {
    final itemCode = obligationItemQuestionFor(pick);
    if (itemCode == null) continue; // `none`, or a type with no amount question
    final stated = num.tryParse(numericOf(answers, itemCode) ?? '')?.toDouble();
    if (stated == null) continue;
    total += obligationMonthlyAmountFor(pick, stated);
  }
  return total;
}

/// Whether the applicant ticked any real debt type.
///
/// Derived from the PICKS, not from `total > 0`: a credit card carried at a zero
/// minimum payment is still a loan on book, which the old lump-sum derivation
/// could never express.
bool obligationsCarryDebt(Map<String, QuestionAnswer> answers) =>
    pickedOptions(answers, kDebtTypesQuestion)
        .any((pick) => obligationItemQuestionFor(pick) != null);

/// The raw decimal string typed for a NUMERIC [questionCode], or null.
String? numericOf(Map<String, QuestionAnswer> answers, String questionCode) {
  final answer = answers[questionCode];
  return answer is NumericAnswer && answer.isNotEmpty ? answer.value : null;
}

/// Every answer in the payload shape `POST /api/v1/apply` expects — one key per
/// answer, chosen by the answer's own type.
List<QuestionnaireAnswer> toSubmittedAnswers(
  Map<String, QuestionAnswer> answers,
) {
  final out = <QuestionnaireAnswer>[];
  for (final entry in answers.entries) {
    final code = entry.key;
    out.add(switch (entry.value) {
      SingleChoiceAnswer(:final optionCode) =>
        QuestionnaireAnswer.single(questionCode: code, optionCode: optionCode),
      MultiChoiceAnswer(:final optionCodes) =>
        QuestionnaireAnswer.multi(questionCode: code, optionCodes: optionCodes),
      NumericAnswer(:final value) =>
        QuestionnaireAnswer.number(questionCode: code, value: value),
      TextAnswer(:final value) =>
        QuestionnaireAnswer.text(questionCode: code, value: value),
    });
  }
  return out;
}

// ---- Money figures ----------------------------------------------------------

/// The four economic inputs the applicant states directly, read from the bound
/// NUMERIC questions. Mirrors `MONEY_FIELD_BINDING_SPECS` on the backend.
///
/// Amounts stay decimal strings; only the tenor becomes an int, because
/// `preferredTenorMonths` is an integer month count on the DTO.
class MoneyFigures {
  const MoneyFigures({
    required this.requestedAmountEGP,
    required this.tenorMonths,
    required this.monthlyIncomeEGP,
    required this.existingObligationsEGP,
    required this.hasCurrentLoan,
  });

  /// Reads the four bound answers. Throws when any is missing or unparseable —
  /// by design: FR-044 forbids substituting a default, and the wizard already
  /// blocks Finish while `QuestionnaireState.missingMoneyFigures` is non-empty,
  /// so a throw here means the gate was bypassed, not that a user hit it.
  factory MoneyFigures.fromAnswers(Map<String, QuestionAnswer> answers) {
    // Obligations are DERIVED — summed from the per-debt answers, never recalled
    // as a lump sum. So the total is not required to be present in `answers`
    // when the itemised questions are being served; it is computed here and the
    // read-only field is filled from the same function.
    final itemisedTotal = obligationsTotalOf(answers);
    final missing = <String>[
      for (final code in kMoneyFieldQuestionCodes)
        if (numericOf(answers, code) == null &&
            !(code == kExistingObligationsQuestion && itemisedTotal != null))
          code,
    ];
    if (missing.isNotEmpty) {
      throw StateError(
        'Missing bound money answers: ${missing.join(', ')} — '
        'the questionnaire must gate Finish until every one is answered.',
      );
    }

    final amount = num.tryParse(numericOf(answers, kRequestedAmountQuestion)!);
    final tenor = num.tryParse(numericOf(answers, kTenorMonthsQuestion)!);
    final income = num.tryParse(numericOf(answers, kMonthlyIncomeQuestion)!);
    // Itemised sum when the debt-type question is served; the stated figure only
    // on the fallback path, where `missing` above already proved it is present.
    final obligations = itemisedTotal ??
        num.tryParse(numericOf(answers, kExistingObligationsQuestion)!);
    if (amount == null ||
        tenor == null ||
        income == null ||
        obligations == null) {
      throw StateError('Bound money answers must be numeric.');
    }

    return MoneyFigures(
      // Passed through as stated — no bucket midpoint, no clamp. The apply DTO
      // accepts 5,000–50,000,000, so a question bound outside that band is
      // rejected server-side rather than silently rewritten here.
      requestedAmountEGP: egp(amount),
      tenorMonths: tenor.round().clamp(_minTenorMonths, _maxTenorMonths),
      monthlyIncomeEGP: egp(income),
      existingObligationsEGP: egp(obligations),
      hasCurrentLoan: itemisedTotal != null
          ? obligationsCarryDebt(answers)
          : obligations > 0,
    );
  }

  final String requestedAmountEGP;
  final int tenorMonths;
  final String monthlyIncomeEGP;

  /// Summed from the per-debt answers when the snapshot serves them; the stated
  /// figure only on the pre-itemisation fallback path.
  final String existingObligationsEGP;

  /// Whether the applicant carries any current instalment.
  ///
  /// From the debt-type PICKS when itemised — a credit card carried at a zero
  /// minimum payment is still a loan on book, and the previous `total > 0`
  /// derivation could never express that. Falls back to `total > 0` only on the
  /// pre-itemisation path, where the picks do not exist.
  final bool hasCurrentLoan;
}

// ---- Surrogate-income facts (feature 011) -----------------------------------

/// The facts a bank's income rule looks its table up by, read off the answers.
///
/// Returned as a typed value object rather than four out-parameters (Principle XXX /
/// A28 — a >2-param method is promoted to a request DTO), and mirrored on the backend
/// by `matching/pipeline/surrogate-facts-from-answers.ts`. Both sides read the same
/// binding constants, so a rename breaks the build rather than the match.
///
/// **Every field is nullable and every null is OMITTED from the request.** That is the
/// contract, not an implementation detail: an unanswered fact must arrive absent so the
/// rule reports `SURROGATE_FACT_MISSING` — a stated reason the customer can read —
/// instead of being priced on a zero or on a plausible-looking default (FR-020).
class SurrogateFacts {
  const SurrogateFacts({
    this.militaryGrade,
    this.professorRank,
    this.yearsInPractice,
    this.creditCardLimitEGP,
  });

  /// Reads the four bound answers. Never throws and never blocks: unlike the money
  /// figures, a missing fact is a normal state — the grade question does not apply to
  /// most applicants, and the wizard must not gate Finish on it.
  factory SurrogateFacts.fromAnswers(Map<String, QuestionAnswer> answers) {
    final years = numericOf(answers, kYearsInPracticeQuestion);
    final cardLimit = numericOf(answers, kCreditCardLimitFactQuestion);
    final parsedYears = years == null ? null : num.tryParse(years);
    final parsedLimit = cardLimit == null ? null : num.tryParse(cardLimit);

    return SurrogateFacts(
      // The picked OPTION CODE, sent as-is. It is the platform-registry key the
      // admin's table rows are keyed by, so translating it here would introduce a
      // third list to keep in step — the drift FR-017 exists to prevent.
      militaryGrade: pickedOption(answers, kMilitaryGradeQuestion),
      professorRank: pickedOption(answers, kAcademicRankQuestion),
      // Whole completed years: the band edges are integers, and 11.9 years in
      // practice is 11 completed years, not 12.
      yearsInPractice: parsedYears?.floor(),
      // EXACT pass-through, no bucket midpoint (FR-018) — the same rule the money
      // figures follow.
      creditCardLimitEGP: parsedLimit == null ? null : egp(parsedLimit),
    );
  }

  final String? militaryGrade;
  final String? professorRank;
  final int? yearsInPractice;

  /// Decimal string (Principle I), or null when the limit was never answered.
  final String? creditCardLimitEGP;

  /// The asset half, ready to hand straight to `ApplyRequest`.
  AssetsPayload get assets => AssetsPayload(creditCardLimitEGP: creditCardLimitEGP);
}
