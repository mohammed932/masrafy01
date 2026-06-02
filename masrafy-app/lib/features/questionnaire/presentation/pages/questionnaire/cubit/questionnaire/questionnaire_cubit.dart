import 'package:bloc/bloc.dart';
import 'package:freezed_annotation/freezed_annotation.dart';
import 'package:injectable/injectable.dart';

import '../../../../../../../core/enums/request_state.dart';
import '../../../../../../../core/result/failure.dart';
import '../../../../../data/models/request/matching_preview_request.dart';
import '../../../../../domain/entities/matching_preview_entity.dart';
import '../../../../../domain/entities/question_entity.dart';
import '../../../../../domain/entities/questionnaire_snapshot_entity.dart';
import '../../../../../domain/enums/enabled_when_operator.dart';
import '../../../../../domain/enums/loan_category.dart';
import '../../../../../domain/usecases/questionnaire_usecase.dart';

part 'questionnaire_cubit.freezed.dart';
part 'questionnaire_state.dart';

/// One cubit per screen (Constitution Principle XXXI). Orchestration only —
/// all derived data (visibility, submit-gate) lives on the Freezed state.
@injectable
class QuestionnaireCubit extends Cubit<QuestionnaireState> {
  QuestionnaireCubit(this._useCase) : super(const QuestionnaireState());

  final QuestionnaireUseCase _useCase;

  /// Exhaustive switch over [QuestionnaireField] — no `default` branch.
  void updateField(QuestionnaireField field, Object value) {
    switch (field) {
      case QuestionnaireField.category:
        emit(state.copyWith(category: value as LoanCategory));
        break;
      case QuestionnaireField.answer:
        _applyAnswer(value as ({String questionCode, String optionCode}));
        break;
    }
  }

  void _applyAnswer(({String questionCode, String optionCode}) answer) {
    final next = Map<String, String>.from(state.answers)
      ..[answer.questionCode] = answer.optionCode;
    emit(state.copyWith(answers: _pruneHiddenAnswers(next)));
  }

  /// Re-evaluate every `enabledWhen` rule against the candidate map and
  /// drop answers whose owning question just became hidden, so a stale
  /// answer can never be submitted for an invisible question.
  Map<String, String> _pruneHiddenAnswers(Map<String, String> candidate) {
    final snapshot = state.snapshot;
    if (snapshot == null) return candidate;
    final pruned = Map<String, String>.from(candidate);
    // Iterate to a fixpoint: `allQuestions` is not dependency-ordered, so a
    // multi-level chain (Q1→Q2→Q3) needs repeated passes until no answer is
    // dropped. Converges regardless of question order.
    bool changed;
    do {
      changed = false;
      for (final question in snapshot.allQuestions) {
        if (!_isVisibleIn(question, pruned) && pruned.remove(question.code) != null) {
          changed = true;
        }
      }
    } while (changed);
    return pruned;
  }

  bool _isVisibleIn(QuestionEntity question, Map<String, String> answers) {
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

  Future<void> loadQuestionnaire(LoanCategory category) async {
    if (state.status.isLoading) return;
    emit(state.copyWith(
      category: category,
      status: RequestState.loading,
      step: QuestionnaireStep.loadingQuestionnaire,
      snapshot: null,
      answers: const <String, String>{},
      preview: null,
      error: null,
    ));
    final res = await _useCase.fetchQuestionnaire(category.wireValue);
    res.fold(
      (err) => emit(state.copyWith(status: RequestState.error, error: err)),
      (snapshot) => emit(state.copyWith(
        status: RequestState.loaded,
        step: QuestionnaireStep.questionnaireReady,
        snapshot: snapshot,
        error: null,
      )),
    );
  }

  Future<void> submitPreview() async {
    if (state.status.isLoading) return;
    if (!state.canSubmit) return;
    emit(state.copyWith(
      status: RequestState.loading,
      step: QuestionnaireStep.submittingPreview,
      error: null,
    ));
    final answers = state.answers.entries
        .map((e) => PreviewAnswer(questionCode: e.key, optionCode: e.value))
        .toList();
    final res = await _useCase.previewMatches(
      MatchingPreviewRequest(
        category: state.category.wireValue,
        answers: answers,
      ),
    );
    res.fold(
      // Return to the form on failure so the skeleton clears and the form's
      // error listener surfaces the (localized) message — the preview route
      // has no error UI of its own.
      (err) => emit(state.copyWith(
        status: RequestState.error,
        step: QuestionnaireStep.questionnaireReady,
        error: err,
      )),
      (preview) => emit(state.copyWith(
        status: RequestState.loaded,
        step: QuestionnaireStep.previewReady,
        preview: preview,
        error: null,
      )),
    );
  }

  void backToForm() => emit(state.copyWith(
        step: QuestionnaireStep.questionnaireReady,
        status: RequestState.loaded,
        preview: null,
      ));

  void reset() => emit(const QuestionnaireState());
}
