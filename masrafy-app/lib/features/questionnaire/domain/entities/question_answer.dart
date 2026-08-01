/// The value an applicant gave for one question. Feature 010 widened the
/// questionnaire from single-choice-only to four answer types, and the backend
/// accepts **exactly one** of `optionCode | optionCodes | textValue |
/// numericValue` per answer (`SubmittedAnswerDto`) — a sealed hierarchy makes
/// that exclusivity unrepresentable-if-wrong instead of a runtime check.
///
/// Numeric values stay decimal STRINGS end to end (Constitution Principle I /
/// A3): parsed to `num` only for local bound feedback, never for the wire.
///
/// Root type + its four variants live in this one file on purpose (payload
/// co-location); do not split per-class.
sealed class QuestionAnswer {
  const QuestionAnswer();

  /// Codes picked on a choice question — empty for numeric / text. Used by
  /// `enabledWhen` branching, which always compares option codes.
  List<String> get pickedOptionCodes;

  /// True when the answer carries nothing the backend would accept, so a
  /// required question counts as unanswered.
  bool get isEmpty;

  bool get isNotEmpty => !isEmpty;
}

class SingleChoiceAnswer extends QuestionAnswer {
  const SingleChoiceAnswer(this.optionCode);

  final String optionCode;

  @override
  List<String> get pickedOptionCodes => [optionCode];

  @override
  bool get isEmpty => optionCode.isEmpty;
}

class MultiChoiceAnswer extends QuestionAnswer {
  const MultiChoiceAnswer(this.optionCodes);

  final List<String> optionCodes;

  @override
  List<String> get pickedOptionCodes => optionCodes;

  @override
  bool get isEmpty => optionCodes.isEmpty;
}

/// NUMERIC answer. [value] is the raw decimal string the applicant typed,
/// already trimmed; bounds are enforced locally for feedback and authoritatively
/// by the server (`ANSWER_OUT_OF_RANGE`).
class NumericAnswer extends QuestionAnswer {
  const NumericAnswer(this.value);

  final String value;

  /// Parsed for local comparisons only (bounds / step). Null when unparseable.
  num? get asNum => num.tryParse(value);

  @override
  List<String> get pickedOptionCodes => const [];

  @override
  bool get isEmpty => value.trim().isEmpty;
}

class TextAnswer extends QuestionAnswer {
  const TextAnswer(this.value);

  final String value;

  @override
  List<String> get pickedOptionCodes => const [];

  @override
  bool get isEmpty => value.trim().isEmpty;
}
