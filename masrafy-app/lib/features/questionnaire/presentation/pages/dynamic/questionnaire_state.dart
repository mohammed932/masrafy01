part of 'questionnaire_cubit.dart';

/// State for the generic questionnaire wizard. [answers] maps each answered
/// question's code to the picked option code. Derivations (visible questions,
/// step gating, submit payload) live here, not on the cubit (Principle XXXI).
@freezed
class QuestionnaireState with _$QuestionnaireState {
  const factory QuestionnaireState({
    @Default(RequestState.initial) RequestState status,
    QuestionnaireSnapshotEntity? snapshot,
    Failure? failure,
    @Default(<String, String>{}) Map<String, String> answers,
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

  /// Questions in [group] visible after applying each question's `enabledWhen`
  /// rule against the current [answers].
  List<QuestionEntity> visibleQuestions(QuestionGroupEntity group) => group
      .questions
      .where((q) => q.enabledWhen == null || q.enabledWhen!.isSatisfied(answers))
      .toList();

  /// True when every required + visible question in the current step is
  /// answered — gates the Next / Finish button.
  bool get canAdvance {
    final group = currentGroup;
    if (group == null) return false;
    for (final q in visibleQuestions(group)) {
      final a = answers[q.code];
      if (q.isRequired && (a == null || a.isEmpty)) return false;
    }
    return true;
  }

  /// Answers restricted to currently-visible questions across all groups, so a
  /// stale answer for a now-hidden question is never submitted to the backend.
  Map<String, String> get visibleAnswers {
    final out = <String, String>{};
    for (final group in groups) {
      for (final question in visibleQuestions(group)) {
        final a = answers[question.code];
        if (a != null && a.isNotEmpty) out[question.code] = a;
      }
    }
    return out;
  }
}
