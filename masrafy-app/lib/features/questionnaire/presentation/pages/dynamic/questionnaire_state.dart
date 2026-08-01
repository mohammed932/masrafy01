part of 'questionnaire_cubit.dart';

/// State for the generic questionnaire wizard. [answers] maps each answered
/// question's code to its typed [QuestionAnswer] — single choice, multi choice,
/// number or text (feature 010 widened this from option-codes-only).
/// Derivations (visible questions, step gating, submit payload) live here, not
/// on the cubit (Principle XXXI).
@freezed
class QuestionnaireState with _$QuestionnaireState {
  const factory QuestionnaireState({
    @Default(RequestState.initial) RequestState status,
    QuestionnaireSnapshotEntity? snapshot,
    Failure? failure,
    @Default(<String, QuestionAnswer>{}) Map<String, QuestionAnswer> answers,
    @Default(0) int currentStep,
    @Default(false) bool submitted,
  }) = _QuestionnaireState;

  const QuestionnaireState._();

  List<QuestionGroupEntity> get groups => snapshot?.groups ?? const [];
  int get totalSteps => groups.length;
  bool get isFirstStep => currentStep == 0;
  bool get isLastStep => totalSteps == 0 || currentStep >= totalSteps - 1;

  /// 1-based fill ratio for the segmented progress bar.
  double get progress => totalSteps == 0 ? 0 : (currentStep + 1) / totalSteps;

  QuestionGroupEntity? get currentGroup =>
      (currentStep >= 0 && currentStep < groups.length)
          ? groups[currentStep]
          : null;

  /// Every question in the snapshot, keyed by code — used to spot a branch rule
  /// that points at a question the pool no longer has.
  Map<String, QuestionEntity> get _questionsByCode => {
        for (final group in groups)
          for (final question in group.questions) question.code: question,
      };

  /// Questions in [group] visible after applying each question's `enabledWhen`
  /// rule against the current [answers]. A rule whose source question is not in
  /// the pool is DANGLING and never hides its target — mirrors the server's
  /// `isQuestionVisible`.
  List<QuestionEntity> visibleQuestions(QuestionGroupEntity group) {
    final byCode = _questionsByCode;
    return group.questions.where((q) {
      final rule = q.enabledWhen;
      if (rule == null) return true;
      if (!byCode.containsKey(rule.questionCode)) return true;
      return rule.isSatisfied(answers);
    }).toList();
  }

  /// Whether [answer] is one the server would accept for [question]: a required
  /// question needs a value, and a typed number / text must satisfy that
  /// question's own CONTENT rules. Mirrors the server's `validateAnswer` so an
  /// out-of-range figure is caught here instead of coming back as
  /// `ANSWER_OUT_OF_RANGE`.
  bool isAnswerAcceptable(QuestionEntity question, QuestionAnswer? answer) {
    if (answer == null || answer.isEmpty) return !question.isRequired;
    return switch (answer) {
      NumericAnswer(:final asNum) =>
        asNum != null && (question.numeric?.accepts(asNum) ?? true),
      TextAnswer(:final value) =>
        value.length <= (question.text?.maxLength ?? value.length),
      _ => true,
    };
  }

  /// True when every visible question in the current step holds an acceptable
  /// answer — gates the Next / Finish button.
  bool get canAdvance {
    final group = currentGroup;
    if (group == null) return false;
    for (final q in visibleQuestions(group)) {
      if (!isAnswerAcceptable(q, answers[q.code])) return false;
    }
    return true;
  }

  /// Answers restricted to currently-visible questions across all groups, so a
  /// stale answer for a now-hidden question is never submitted to the backend.
  Map<String, QuestionAnswer> get visibleAnswers {
    final out = <String, QuestionAnswer>{};
    for (final group in groups) {
      for (final question in visibleQuestions(group)) {
        final a = answers[question.code];
        if (a != null && a.isNotEmpty) out[question.code] = a;
      }
    }
    return out;
  }

  /// Bound money questions (`MONEY_FIELD_BINDINGS`) that have no usable figure —
  /// unanswered, non-numeric, or out of the question's own bounds. The engine
  /// refuses to substitute a default for these (FR-044), so the wizard blocks
  /// Finish rather than submitting a fabricated figure.
  List<String> get missingMoneyFigures {
    final answered = visibleAnswers;
    final byCode = _questionsByCode;
    return [
      for (final code in kMoneyFieldQuestionCodes)
        if (!_hasUsableFigure(byCode[code], answered[code])) code,
    ];
  }

  bool _hasUsableFigure(QuestionEntity? question, QuestionAnswer? answer) {
    if (question == null || answer is! NumericAnswer) return false;
    return isAnswerAcceptable(question, answer);
  }

  /// Finish is allowed only when the step is complete AND every money binding
  /// resolved.
  bool get canFinish => canAdvance && missingMoneyFigures.isEmpty;
}
