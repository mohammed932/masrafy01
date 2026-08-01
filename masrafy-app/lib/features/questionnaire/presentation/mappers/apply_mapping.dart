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

/// Wizard `salaryTransfer` yes/no → backend `salaryTransferType` enum value.
String salaryTransferType({required bool? transfers}) =>
    transfers == true ? 'payroll' : 'none';

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
  });

  /// Reads the four bound answers. Throws when any is missing or unparseable —
  /// by design: FR-044 forbids substituting a default, and the wizard already
  /// blocks Finish while `QuestionnaireState.missingMoneyFigures` is non-empty,
  /// so a throw here means the gate was bypassed, not that a user hit it.
  factory MoneyFigures.fromAnswers(Map<String, QuestionAnswer> answers) {
    final missing = <String>[
      for (final code in kMoneyFieldQuestionCodes)
        if (numericOf(answers, code) == null) code,
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
    final obligations =
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
    );
  }

  final String requestedAmountEGP;
  final int tenorMonths;
  final String monthlyIncomeEGP;
  final String existingObligationsEGP;

  /// Whether the applicant carries any current installment — derived from the
  /// stated figure, not from a separate yes/no bucket.
  bool get hasCurrentLoan => (num.tryParse(existingObligationsEGP) ?? 0) > 0;
}
