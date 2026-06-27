import 'package:bloc/bloc.dart';
import 'package:freezed_annotation/freezed_annotation.dart';
import 'package:injectable/injectable.dart';

part 'business_questionnaire_cubit.freezed.dart';
part 'business_questionnaire_state.dart';

/// Orchestrates the 4-step business-loan questionnaire wizard (Figma
/// `4024:2741`, `4024:3359`, `4024:3836`, `4024:4118`). Holds every answer plus
/// the active step. Pure orchestration
/// — all validation/derivation lives on [BusinessQuestionnaireState]
/// (Principle XXXI). Screen-scoped via the page's `BlocProvider`; never shared
/// across features (Principle XXXI).
///
/// Lookups are local/static for this iteration ("for now"); no backend call,
/// so there is no async [RequestState] and no shimmer is required
/// (Principle XXXIV — applies only to async, content-bearing screens). Mirrors
/// the mortgage questionnaire flow.
@injectable
class BusinessQuestionnaireCubit extends Cubit<BusinessQuestionnaireState> {
  BusinessQuestionnaireCubit() : super(const BusinessQuestionnaireState());

  /// Scalar field edits (selects, business-age / financing-amount /
  /// installments text, repayment slider). Exhaustive over [BusinessField] — no
  /// `default:` (A15: the cast target is explicit per case).
  void updateField(BusinessField field, Object value) {
    switch (field) {
      case BusinessField.activityType:
        emit(state.copyWith(activityType: value as String));
      case BusinessField.businessAge:
        emit(state.copyWith(businessAge: value as String));
      case BusinessField.financingAmount:
        emit(state.copyWith(financingAmount: value as String));
      case BusinessField.financingPurpose:
        emit(state.copyWith(
            financingPurpose: value as String));
      case BusinessField.repaymentPeriod:
        emit(state.copyWith(repaymentPeriod: value as double));
      case BusinessField.businessAccount:
        emit(state.copyWith(businessAccount: value as bool));
      case BusinessField.registered:
        emit(state.copyWith(registered: value as String));
      case BusinessField.taxRegistration:
        emit(state.copyWith(taxRegistration: value as bool));
      case BusinessField.currentFacilities:
        emit(state.copyWith(
            currentFacilities: value as bool));
      case BusinessField.currentInstallments:
        emit(state.copyWith(
            currentInstallments: value as String));
      case BusinessField.priorRejection:
        emit(state.copyWith(priorRejection: value as bool));
      case BusinessField.priorityFactor:
        emit(state.copyWith(priorityFactor: value as String));
      case BusinessField.needsConsultation:
        emit(state.copyWith(
            needsConsultation: value as bool));
    }
  }

  /// Monthly-revenue range edit (two-thumb slider). Kept off [updateField] so
  /// the cubit stays free of any `package:flutter` `RangeValues` import.
  void updateMonthlyRevenue({required double start, required double end}) =>
      emit(state.copyWith(monthlyRevenueStart: start, monthlyRevenueEnd: end));

  /// Advance the wizard. Guarded by [BusinessQuestionnaireState.canAdvance];
  /// on the last step it flips [BusinessQuestionnaireState.submitted] (the page
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
