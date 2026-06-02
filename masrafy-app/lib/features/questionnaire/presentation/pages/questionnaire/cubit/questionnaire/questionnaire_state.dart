part of 'questionnaire_cubit.dart';

/// Fields the cubit's `updateField` mutates.
enum QuestionnaireField { category, answer }

/// Where the flow is in the funnel. Decoupled from [RequestState] (the
/// in-flight indicator) so the UI knows form-vs-preview regardless of
/// whether a request is loading.
enum QuestionnaireStep {
  idle,
  loadingQuestionnaire,
  questionnaireReady,
  submittingPreview,
  previewReady,
}

@freezed
class QuestionnaireState with _$QuestionnaireState {
  const factory QuestionnaireState({
    @Default(LoanCategory.personal) LoanCategory category,
    QuestionnaireSnapshotEntity? snapshot,
    @Default(<String, String>{}) Map<String, String> answers,
    @Default(QuestionnaireStep.idle) QuestionnaireStep step,
    @Default(RequestState.initial) RequestState status,
    MatchingPreviewEntity? preview,
    Failure? error,
  }) = _QuestionnaireState;

  const QuestionnaireState._();

  /// `enabledWhen` evaluation against the *current* answer map.
  bool isQuestionVisible(QuestionEntity question) {
    final cond = question.enabledWhen;
    if (cond == null) return true;
    final selected = answers[cond.questionCode];
    switch (cond.operator) {
      case EnabledWhenOperator.equals:
        return selected == cond.optionCode;
      case EnabledWhenOperator.notEquals:
        return selected != null && selected != cond.optionCode;
      case EnabledWhenOperator.unknown:
        return true;
    }
  }

  /// Every visible required question must be answered before preview.
  bool get canSubmit {
    final snap = snapshot;
    if (snap == null) return false;
    for (final question in snap.allQuestions) {
      if (!isQuestionVisible(question)) continue;
      if (question.isRequired && !answers.containsKey(question.code)) {
        return false;
      }
    }
    return true;
  }

  bool get isLoadingQuestionnaire =>
      status.isLoading && step == QuestionnaireStep.loadingQuestionnaire;
  bool get isSubmittingPreview =>
      status.isLoading && step == QuestionnaireStep.submittingPreview;
  bool get isFailure => status.isError && error != null;
}
