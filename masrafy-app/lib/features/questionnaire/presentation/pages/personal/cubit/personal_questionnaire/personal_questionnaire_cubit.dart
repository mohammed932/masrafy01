import 'package:bloc/bloc.dart';
import 'package:freezed_annotation/freezed_annotation.dart';
import 'package:injectable/injectable.dart';

part 'personal_questionnaire_cubit.freezed.dart';
part 'personal_questionnaire_state.dart';

/// Orchestrates the 4-step personal-loan questionnaire wizard (Figma
/// `4024:2442`, `4024:3049`, `4024:3620`, `4024:4213`). Holds every answer plus
/// the active step. Pure orchestration — all validation/derivation lives on
/// [PersonalQuestionnaireState] (Principle XXXI). Screen-scoped via the page's
/// `BlocProvider`; never shared across features.
///
/// Mirrors `CarQuestionnaireCubit`: lookups are local/static for this iteration
/// ("for now"), so there is no async [RequestState] and no shimmer is required
/// (Principle XXXIV — applies only to async, content-bearing screens).
@injectable
class PersonalQuestionnaireCubit extends Cubit<PersonalQuestionnaireState> {
  PersonalQuestionnaireCubit() : super(const PersonalQuestionnaireState());

  /// Scalar + list field edits (selects, multi-select obligations, amount /
  /// installment text, repayment slider). Exhaustive over [PersonalField] —
  /// no `default:` (the cast target is explicit per case).
  void updateField(PersonalField field, Object value) {
    switch (field) {
      case PersonalField.loanAmount:
        emit(state.copyWith(loanAmount: value as String));
      case PersonalField.repaymentPeriod:
        emit(state.copyWith(repaymentPeriod: value as double));
      case PersonalField.loanPurpose:
        emit(state.copyWith(loanPurpose: value as String));
      case PersonalField.employmentStatus:
        emit(state.copyWith(employmentStatus: value as String));
      case PersonalField.jobTenure:
        emit(state.copyWith(jobTenure: value as String));
      case PersonalField.monthlyIncome:
        emit(state.copyWith(monthlyIncome: value as String));
      case PersonalField.salaryTransfer:
        emit(state.copyWith(salaryTransfer: value as bool));
      case PersonalField.employerApproved:
        emit(state.copyWith(employerApproved: value as String));
      case PersonalField.obligations:
        emit(state.copyWith(obligations: value as List<String>));
      case PersonalField.monthlyInstallment:
        emit(state.copyWith(monthlyInstallment: value as String));
      case PersonalField.hasCreditCard:
        emit(state.copyWith(hasCreditCard: value as bool));
      case PersonalField.creditCardUsage:
        emit(state.copyWith(creditCardUsage: value as String));
      case PersonalField.priorityFactor:
        emit(state.copyWith(priorityFactor: value as String));
      case PersonalField.previouslyRejected:
        emit(state.copyWith(previouslyRejected: value as bool));
      case PersonalField.needsAssistance:
        emit(state.copyWith(needsAssistance: value as bool));
    }
  }

  /// Advance the wizard. Guarded by [PersonalQuestionnaireState.canAdvance]; on
  /// the last step it flips [PersonalQuestionnaireState.submitted] (the page
  /// then routes to the match results — no backend submit "for now").
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

  /// Sync from `PageView.onPageChanged` (kept in case swipe is re-enabled).
  void goToStep(int step) => emit(state.copyWith(currentStep: step));
}
