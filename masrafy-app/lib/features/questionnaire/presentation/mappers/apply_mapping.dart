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

/// Job-tenure bucket → representative `monthsInJob`. [fallback] covers the business
/// wizard, which asks `business_age` instead and maps it itself.
///
/// The case labels ARE the `job_tenure` option codes the questionnaire seed emits
/// (`JOB_TENURE_Q`). They used to read `under_6m` / `6m_1y` / `1_3y` / `over_3y`, which
/// no question has ever emitted, so every arm was dead and every applicant was reported
/// at the 24-month fallback — including the ones the personal wizard passed a real bucket
/// to. Personal escaped it only because that mapper carried a second, correct copy of this
/// map; the copy is deleted and both now read this one.
int monthsFromTenure(String? bucket, {int fallback = 24}) {
  switch (bucket) {
    case 'less_than_6_months':
      return 3;
    case '6_months_to_1_year':
      return 9;
    case '1_to_3_years':
      return 24;
    case 'more_than_3_years':
      return 48;
    default:
      return fallback;
  }
}

/// `priority_factor` option code → backend `priority` enum
/// (`lowest_installment | lowest_interest | fastest_approval | least_paperwork`).
///
/// ONE function for all four categories, because `priority_factor` is ONE question
/// in the global pool (v12.0.0) with ONE option set, and what it decides is the
/// ORDER the customer is shown — which Principle V / A33 require every path to
/// derive the same way. It used to be five: this shared one, keyed on a vocabulary
/// (`longest_period`, `minimum_docs`, `no_guarantor`, `lowest_fees`) the question has
/// never emitted and with no callers at all, plus a private partial copy in each of
/// the four `*_apply_mapper.dart` files. Each copy covered a different subset, so the
/// SAME answer produced a different order depending on the loan type: a mortgage
/// applicant who asked for the lowest interest rate was ranked by `fastest_approval`
/// (partner bank, then fewest documents) and a business applicant who asked for the
/// lowest monthly instalment was too. Two arms were also dead —
/// `financing_without_a_guarantor` (car) and `lowest_administrative_fees` (mortgage)
/// are not option codes of this question, so neither category could ever reach
/// `least_paperwork`.
///
/// Every arm below is the reading one of those copies already expressed; taking the
/// union rather than re-deciding keeps this a bug fix. The four codes with no sort
/// key of their own (`lowest_down_payment`, `longest_repayment_period`,
/// `highest_financing_amount`, `flexible_repayment`) are read as instalment-shaped,
/// which is what car, mortgage, personal and business respectively already did with
/// them — `rankOffers` has no down-payment or ticket-size key to sort by.
///
/// Unanswered falls to `fastest_approval`: the question is optional, and that arm is
/// the engine's documented default (partner bank, then fewest documents).
String mapPriority(String? code) => switch (code) {
      'lowest_monthly_installment' ||
      'longest_repayment_period' ||
      'lowest_down_payment' ||
      'highest_financing_amount' ||
      'flexible_repayment' =>
        'lowest_installment',
      'lowest_interest_rate' => 'lowest_interest',
      'least_documentation_required' => 'least_paperwork',
      _ => 'fastest_approval',
    };

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

    // DERIVED, not defaulted (FR-044 forbids a guess, not arithmetic).
    //
    // A loan type may legitimately stop asking a figure it can WORK OUT. A car flow
    // that asks the price and the down payment has already been told the amount —
    // making the customer type `price - down payment` a third time is a question that
    // exists only to satisfy this constructor. Obligations are the other one: a flow
    // that never asks what the applicant owes has been told nothing, and "nothing
    // declared" is 0, which is a statement rather than an invention.
    //
    // Income and tenor are NOT here and must not be: no answer in any flow implies
    // them, and a surrogate programme's assumed income is the server's to compute
    // from the facts. Inventing either is the bucket-midpoint bug feature 010 removed.
    final derived = <String, String>{};
    if (numericOf(answers, kRequestedAmountQuestion) == null) {
      final price = num.tryParse(numericOf(answers, 'car_price') ?? '');
      final down = num.tryParse(numericOf(answers, 'car_down_payment') ?? '');
      if (price != null && down != null && price > down) {
        derived[kRequestedAmountQuestion] = egp(price - down);
      }
    }
    if (numericOf(answers, kExistingObligationsQuestion) == null &&
        itemisedTotal == null &&
        answers[kDebtTypesQuestion] == null) {
      derived[kExistingObligationsQuestion] = egp(0);
    }

    String? figure(String code) =>
        numericOf(answers, code) ?? derived[code];

    // A figure the flow never asks for is not "missing" — it is not part of this loan
    // type's form. The TERM is then the programme's own maximum (the apply DTO takes no
    // `preferredTenorMonths` and `resolveTenor` uses the programme ceiling), and the INCOME
    // is nothing declared, which a no-payslip product works out for itself and a payslip
    // one correctly reports as too low to lend against.
    final missing = <String>[
      for (final code in kMoneyFieldQuestionCodes)
        if (figure(code) == null &&
            !(code == kTenorMonthsQuestion) &&
            !(code == kMonthlyIncomeQuestion) &&
            !(code == kExistingObligationsQuestion && itemisedTotal != null))
          code,
    ];
    if (missing.isNotEmpty) {
      throw StateError(
        'Missing bound money answers: ${missing.join(', ')} — '
        'the published questionnaire must ask these as REQUIRED questions of this '
        'loan type. `check:money` on the backend is what proves it does; reaching '
        'here means a snapshot shipped that it would have refused.',
      );
    }

    final amount = num.tryParse(figure(kRequestedAmountQuestion)!);
    final tenorAnswer = figure(kTenorMonthsQuestion);
    final tenor = tenorAnswer == null ? null : num.tryParse(tenorAnswer);
    final incomeAnswer = figure(kMonthlyIncomeQuestion);
    final income = incomeAnswer == null ? 0 : num.tryParse(incomeAnswer);
    // Itemised sum when the debt-type question is served; the stated figure only
    // on the fallback path, where `missing` above already proved it is present.
    final obligations = itemisedTotal ??
        num.tryParse(figure(kExistingObligationsQuestion)!);
    if (amount == null ||
        (tenorAnswer != null && tenor == null) ||
        income == null ||
        obligations == null) {
      throw StateError('Bound money answers must be numeric.');
    }

    return MoneyFigures(
      // Passed through as stated — no bucket midpoint, no clamp. The apply DTO
      // accepts 5,000–50,000,000, so a question bound outside that band is
      // rejected server-side rather than silently rewritten here.
      requestedAmountEGP: egp(amount),
      tenorMonths: tenor?.round().clamp(_minTenorMonths, _maxTenorMonths),
      monthlyIncomeEGP: egp(income),
      existingObligationsEGP: egp(obligations),
      hasCurrentLoan: itemisedTotal != null
          ? obligationsCarryDebt(answers)
          : obligations > 0,
    );
  }

  final String requestedAmountEGP;
  /// Null when this loan type never asks for a term — the request then omits
  /// `preferredTenorMonths` and every programme quotes at its own maximum.
  final int? tenorMonths;
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
