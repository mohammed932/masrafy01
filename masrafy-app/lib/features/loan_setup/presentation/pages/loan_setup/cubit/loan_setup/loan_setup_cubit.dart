import 'package:bloc/bloc.dart';
import 'package:freezed_annotation/freezed_annotation.dart';
import 'package:injectable/injectable.dart';

import 'package:app/core/enums/request_state.dart';
import 'package:app/core/result/failure.dart';
import 'package:app/features/loan_setup/domain/entities/program_options_entity.dart';
import 'package:app/features/loan_setup/domain/enums/income_type.dart';
import 'package:app/features/loan_setup/domain/usecases/program_options_usecase.dart';
import 'package:app/features/questionnaire/domain/enums/loan_category.dart';

part 'loan_setup_cubit.freezed.dart';
part 'loan_setup_state.dart';

/// Orchestrates the three-step loan-setup wizard: loan category → income basis →
/// catalog program name.
///
/// The order is the whole point. Each step's options are only knowable once the
/// step before it is answered — a category decides which bases have live programs,
/// and a basis decides which names those programs instantiate. Asking all three at
/// once (the old Home screen) meant offering names that no bank sells on the basis
/// the customer would go on to need, and only saying so after the entire
/// questionnaire had been filled in.
///
/// Pure orchestration — every derivation lives on [LoanSetupState]
/// (Principle XXXI). The `PageView` animation is owned by the view.
@injectable
class LoanSetupCubit extends Cubit<LoanSetupState> {
  LoanSetupCubit(this._useCase) : super(const LoanSetupState());

  final ProgramOptionsUseCase _useCase;

  /// Enter the wizard with [category] already chosen on Home, landing on step 2.
  ///
  /// Step 1 is still a real, reachable step — the customer can walk back to it —
  /// so the progress bar reads 3 and the category is a decision they can revise
  /// without losing the route.
  Future<void> start(LoanCategory category) async {
    emit(state.copyWith(category: category, currentStep: 1));
    await _fetch(category);
  }

  /// Re-run the availability read after a failure.
  Future<void> retry() => _fetch(state.category);

  Future<void> _fetch(LoanCategory category) async {
    emit(state.copyWith(status: RequestState.loading, failure: null));
    final result = await _useCase.forCategory(category);
    result.fold(
      (failure) =>
          emit(state.copyWith(status: RequestState.error, failure: failure)),
      (options) => emit(state.copyWith(
        status: RequestState.loaded,
        options: options,
        failure: null,
      )),
    );
  }

  /// Pick a loan category on step 1.
  ///
  /// Re-fetches, and clears BOTH later answers: the basis and the name were both
  /// chosen from a list this category does not produce. Keeping either would send
  /// a triple the backend narrows to nothing.
  Future<void> selectCategory(LoanCategory category) async {
    if (category == state.category) return;
    emit(state.copyWith(
      category: category,
      incomeType: null,
      programKey: null,
      options: null,
    ));
    await _fetch(category);
  }

  /// Pick an income basis on step 2. Clears the program name for the same reason
  /// [selectCategory] does — the name list is per basis.
  void selectIncomeType(IncomeType incomeType) {
    if (!state.isIncomeTypeAvailable(incomeType)) return;
    if (incomeType == state.incomeType) return;
    emit(state.copyWith(incomeType: incomeType, programKey: null));
  }

  /// Pick a catalog program name on step 3.
  void selectProgram(String programKey) =>
      emit(state.copyWith(programKey: programKey));

  /// Advance. Guarded by [LoanSetupState.canAdvance]; on the last step it flips
  /// [LoanSetupState.submitted] and the page routes into the questionnaire.
  void next() {
    if (!state.canAdvance) return;
    if (state.isLastStep) {
      emit(state.copyWith(submitted: true));
      return;
    }
    emit(state.copyWith(currentStep: state.stepIndex + 1));
  }

  /// Disarm the one-shot submit flag once the page has routed on.
  ///
  /// Left standing it breaks the wizard on return from the questionnaire:
  /// re-pressing Continue emits an identical state, which the cubit drops, so
  /// nothing navigates — and any later step change re-fires the push.
  void submissionHandled() {
    if (!state.submitted) return;
    emit(state.copyWith(submitted: false));
  }

  /// Step backward. Returns `false` on the first step so the page pops instead.
  bool back() {
    if (state.isFirstStep) return false;
    emit(state.copyWith(currentStep: state.stepIndex - 1));
    return true;
  }

  void goToStep(int step) {
    // Only backward, and only to a step already satisfied. Forward jumps would
    // skip a choice the next step's options are derived from.
    if (step >= state.stepIndex || step < 0) return;
    emit(state.copyWith(currentStep: step));
  }
}
