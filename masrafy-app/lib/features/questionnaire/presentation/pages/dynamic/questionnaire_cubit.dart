import 'package:bloc/bloc.dart';
import 'package:freezed_annotation/freezed_annotation.dart';
import 'package:injectable/injectable.dart';

import 'package:app/core/enums/request_state.dart';
import 'package:app/core/result/failure.dart';
import 'package:app/features/questionnaire/domain/entities/questionnaire_snapshot_entity.dart';
import 'package:app/features/questionnaire/domain/enums/loan_category.dart';
import 'package:app/features/questionnaire/domain/usecases/questionnaire_usecase.dart';

part 'questionnaire_cubit.freezed.dart';
part 'questionnaire_state.dart';

/// Orchestrates the generic, backend-driven questionnaire wizard used by every
/// loan category (Principle II — the questionnaire is DATA). On [load] it
/// fetches the published snapshot; one group renders as one step. Holds the
/// picked answers (`questionCode → optionCode`) plus the active step. Pure
/// orchestration — all derivation/validation lives on [QuestionnaireState]
/// (Principle XXXI). Screen-scoped via the page's `BlocProvider`.
@injectable
class QuestionnaireCubit extends Cubit<QuestionnaireState> {
  QuestionnaireCubit(this._useCase) : super(const QuestionnaireState());

  final QuestionnaireUseCase _useCase;

  /// Fetch (or re-fetch, on retry) the active snapshot for [category].
  Future<void> load(LoanCategory category) async {
    emit(state.copyWith(status: RequestState.loading, failure: null));
    final result = await _useCase.getByCategory(category);
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

  /// Apply a single-select answer. A new map instance is emitted so the state
  /// compares unequal and dependent `enabledWhen` questions re-evaluate.
  void select(String questionCode, String optionCode) {
    emit(state.copyWith(
      answers: {...state.answers, questionCode: optionCode},
    ));
  }

  /// Advance the wizard. Guarded by [QuestionnaireState.canAdvance]; on the last
  /// step it flips [QuestionnaireState.submitted] (the page then submits +
  /// routes to the match results).
  void next() {
    if (!state.canAdvance) return;
    if (state.isLastStep) {
      emit(state.copyWith(submitted: true));
      return;
    }
    emit(state.copyWith(currentStep: state.currentStep + 1));
  }

  /// Step backward. Returns `false` when already on the first step so the page
  /// can pop the route instead.
  bool back() {
    if (state.isFirstStep) return false;
    emit(state.copyWith(currentStep: state.currentStep - 1));
    return true;
  }

  void goToStep(int step) => emit(state.copyWith(currentStep: step));
}
