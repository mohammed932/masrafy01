import 'package:bloc/bloc.dart';
import 'package:freezed_annotation/freezed_annotation.dart';
import 'package:injectable/injectable.dart';

import 'package:app/core/enums/request_state.dart';
import 'package:app/core/result/failure.dart';
import 'package:app/features/questionnaire/domain/constants/money_field_bindings.dart';
import 'package:app/features/questionnaire/domain/entities/question_answer.dart';
import 'package:app/features/questionnaire/domain/entities/questionnaire_snapshot_entity.dart';
import 'package:app/features/questionnaire/domain/usecases/questionnaire_usecase.dart';

part 'questionnaire_cubit.freezed.dart';
part 'questionnaire_state.dart';

/// Orchestrates the generic, backend-driven questionnaire wizard used by every
/// loan category (Principle II — the questionnaire is DATA). On [load] it
/// fetches the ONE global published snapshot (feature 010: the category filters
/// programs, not questions); one group renders as one step. Holds the typed
/// answers (`questionCode → QuestionAnswer`) plus the active step. Pure
/// orchestration — all derivation/validation lives on [QuestionnaireState]
/// (Principle XXXI). Screen-scoped via the page's `BlocProvider`.
@injectable
class QuestionnaireCubit extends Cubit<QuestionnaireState> {
  QuestionnaireCubit(this._useCase) : super(const QuestionnaireState());

  final QuestionnaireUseCase _useCase;

  /// Fetch (or re-fetch, on retry) the active global snapshot.
  Future<void> load() async {
    emit(state.copyWith(status: RequestState.loading, failure: null));
    final result = await _useCase.getActive();
    result.fold(
      (failure) =>
          emit(state.copyWith(status: RequestState.error, failure: failure)),
      (snapshot) => emit(state.copyWith(
        status: RequestState.loaded,
        snapshot: snapshot,
        failure: null,
      )),
    );
  }

  /// Apply a `SINGLE_SELECT` pick.
  void selectOne(String questionCode, String optionCode) =>
      _put(questionCode, SingleChoiceAnswer(optionCode));

  /// Apply a `MULTI_SELECT` pick. An empty list clears the answer so a required
  /// question falls back to unanswered.
  void selectMany(String questionCode, List<String> optionCodes) =>
      _put(questionCode, MultiChoiceAnswer(List.unmodifiable(optionCodes)));

  /// Apply a `NUMERIC` answer. [raw] is kept as the typed decimal STRING
  /// (Principle I) — never parsed to a double on the way to the wire.
  void setNumber(String questionCode, String raw) =>
      _put(questionCode, NumericAnswer(raw.trim()));

  /// Apply a `TEXT` answer.
  void setText(String questionCode, String raw) =>
      _put(questionCode, TextAnswer(raw.trim()));

  /// Store [answer], or drop the key when it carries nothing. A new map
  /// instance is emitted so the state compares unequal and dependent
  /// `enabledWhen` questions re-evaluate.
  void _put(String questionCode, QuestionAnswer answer) {
    final next = {...state.answers};
    if (answer.isEmpty) {
      next.remove(questionCode);
    } else {
      next[questionCode] = answer;
    }
    emit(state.copyWith(answers: next));
  }

  /// Advance the wizard. Guarded by [QuestionnaireState.canAdvance]; on the last
  /// step it also requires every money binding to resolve
  /// ([QuestionnaireState.canFinish]) and then flips
  /// [QuestionnaireState.submitted] (the page submits + routes to the results).
  void next() {
    if (!state.canAdvance) return;
    if (state.isLastStep) {
      if (!state.canFinish) return;
      emit(state.copyWith(submitted: true));
      return;
    }
    // Stepped from the CLAMPED index: an answer can hide a whole group and
    // shorten the wizard while the cursor sits past its new end.
    emit(state.copyWith(currentStep: state.stepIndex + 1));
  }

  /// Disarm the submit flag once the page has routed to the results.
  ///
  /// [submitted] is a ONE-SHOT signal, not a "has submitted" record. Left
  /// standing it breaks the wizard on return from the results: re-pressing
  /// Finish emits an identical state, which the cubit drops, so nothing
  /// navigates — and any later step change re-fires the results push.
  void submissionHandled() {
    if (!state.submitted) return;
    emit(state.copyWith(submitted: false));
  }

  /// Step backward. Returns `false` when already on the first step so the page
  /// can pop the route instead.
  bool back() {
    if (state.isFirstStep) return false;
    emit(state.copyWith(currentStep: state.stepIndex - 1));
    return true;
  }

  void goToStep(int step) => emit(state.copyWith(currentStep: step));
}
