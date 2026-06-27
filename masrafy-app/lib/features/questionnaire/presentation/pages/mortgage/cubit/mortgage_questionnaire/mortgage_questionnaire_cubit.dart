import 'package:bloc/bloc.dart';
import 'package:freezed_annotation/freezed_annotation.dart';
import 'package:injectable/injectable.dart';

part 'mortgage_questionnaire_cubit.freezed.dart';
part 'mortgage_questionnaire_state.dart';

/// Orchestrates the 4-step mortgage questionnaire wizard (Figma `4024:2197`+).
/// Holds every answer plus the active step. Pure orchestration — all
/// validation/derivation lives on
/// [MortgageQuestionnaireState] (Principle XXXI). Screen-scoped via the page's
/// `BlocProvider`; never shared across features (Principle XXXI).
///
/// Lookups are local/static for this iteration ("for now"); no backend call,
/// so there is no async [RequestState] and no shimmer is required
/// (Principle XXXIV — applies only to async, content-bearing screens).
@injectable
class MortgageQuestionnaireCubit extends Cubit<MortgageQuestionnaireState> {
  MortgageQuestionnaireCubit() : super(const MortgageQuestionnaireState());

  /// Scalar field edits (selects, address text, installments text, repayment
  /// slider). Exhaustive over [MortgageField] — no `default:` (A15: the cast
  /// target is explicit per case).
  void updateField(MortgageField field, Object value) {
    switch (field) {
      case MortgageField.propertyType:
        emit(state.copyWith(propertyType: value as String));
      case MortgageField.inCompound:
        emit(state.copyWith(inCompound: value as bool));
      case MortgageField.registrationStatus:
        emit(state.copyWith(
            registrationStatus: value as String));
      case MortgageField.governorate:
        emit(state.copyWith(governorate: value as String));
      case MortgageField.address:
        emit(state.copyWith(address: value as String));
      case MortgageField.downPaymentPct:
        emit(state.copyWith(downPaymentPct: value as String));
      case MortgageField.repaymentPeriod:
        emit(state.copyWith(repaymentPeriod: value as double));
      case MortgageField.employmentStatus:
        emit(state.copyWith(
            employmentStatus: value as String));
      case MortgageField.monthlyIncome:
        emit(state.copyWith(monthlyIncome: value as String));
      case MortgageField.salaryTransfer:
        emit(state.copyWith(salaryTransfer: value as bool));
      case MortgageField.additionalIncome:
        emit(state.copyWith(additionalIncome: value as bool));
      case MortgageField.currentLoans:
        emit(state.copyWith(currentLoans: value as bool));
      case MortgageField.currentInstallments:
        emit(state.copyWith(
            currentInstallments: value as String));
      case MortgageField.priorRejection:
        emit(state.copyWith(priorRejection: value as bool));
      case MortgageField.priorityFactor:
        emit(state.copyWith(priorityFactor: value as String));
      case MortgageField.needsAssistance:
        emit(state.copyWith(needsAssistance: value as bool));
    }
  }

  /// Property-value range edit (two-thumb slider). Kept off [updateField] so
  /// the cubit stays free of any `package:flutter` `RangeValues` import.
  void updatePropertyValue({required double start, required double end}) =>
      emit(state.copyWith(propertyValueStart: start, propertyValueEnd: end));

  /// Advance the wizard. Guarded by [MortgageQuestionnaireState.canAdvance];
  /// on the last step it flips [MortgageQuestionnaireState.submitted] (the page
  /// shows the placeholder toast — no backend submit "for now").
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
  void goToStep(int step) =>
      emit(state.copyWith(currentStep: step));
}
