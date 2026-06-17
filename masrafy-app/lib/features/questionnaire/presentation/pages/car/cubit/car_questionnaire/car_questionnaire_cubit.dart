import 'package:bloc/bloc.dart';
import 'package:freezed_annotation/freezed_annotation.dart';
import 'package:injectable/injectable.dart';

part 'car_questionnaire_cubit.freezed.dart';
part 'car_questionnaire_state.dart';

/// Orchestrates the 4-step car-loan questionnaire wizard (Figma `4024:2586`,
/// `4024:3204`, `4024:3744`, `4024:4023`). Holds every answer plus the active
/// step and which inline-expand dropdown is open. Pure orchestration — all
/// validation/derivation lives on [CarQuestionnaireState] (Principle XXXI).
/// Screen-scoped via the page's `BlocProvider`; never shared across features.
///
/// Mirrors `MortgageQuestionnaireCubit`: lookups are local/static for this
/// iteration ("for now"), so there is no async [RequestState] and no shimmer is
/// required (Principle XXXIV — applies only to async, content-bearing screens).
@injectable
class CarQuestionnaireCubit extends Cubit<CarQuestionnaireState> {
  CarQuestionnaireCubit() : super(const CarQuestionnaireState());

  /// Scalar field edits (selects, installments text, repayment slider).
  /// Exhaustive over [CarField] — no `default:` (the cast target is explicit
  /// per case). Select edits also collapse any open accordion so the layout
  /// settles after a pick.
  void updateField(CarField field, Object value) {
    switch (field) {
      case CarField.vehicleCondition:
        emit(state.copyWith(vehicleCondition: value as String, openField: null));
      case CarField.modelYear:
        emit(state.copyWith(modelYear: value as String, openField: null));
      case CarField.downPaymentPct:
        emit(state.copyWith(downPaymentPct: value as String, openField: null));
      case CarField.repaymentPeriod:
        emit(state.copyWith(repaymentPeriod: value as double, openField: null));
      case CarField.employmentStatus:
        emit(state.copyWith(
            employmentStatus: value as String, openField: null));
      case CarField.monthlyIncome:
        emit(state.copyWith(monthlyIncome: value as String, openField: null));
      case CarField.salaryTransfer:
        emit(state.copyWith(salaryTransfer: value as bool, openField: null));
      case CarField.employerApproved:
        emit(state.copyWith(
            employerApproved: value as String, openField: null));
      case CarField.currentLoans:
        emit(state.copyWith(currentLoans: value as bool, openField: null));
      case CarField.currentInstallments:
        emit(state.copyWith(
            currentInstallments: value as String, openField: null));
      case CarField.hasCreditCard:
        emit(state.copyWith(hasCreditCard: value as bool, openField: null));
      case CarField.priorityFactor:
        emit(state.copyWith(priorityFactor: value as String, openField: null));
      case CarField.wantsInsurance:
        emit(state.copyWith(wantsInsurance: value as bool, openField: null));
    }
  }

  /// Vehicle-price range edit (two-thumb slider). Kept off [updateField] so the
  /// cubit stays free of any `package:flutter` `RangeValues` import.
  void updateVehiclePrice({required double start, required double end}) =>
      emit(state.copyWith(vehiclePriceStart: start, vehiclePriceEnd: end));

  /// Toggle the inline-expand accordion for [field]; only one open at a time.
  void toggleField(CarField field) => emit(state.copyWith(
        openField: state.openField == field ? null : field,
      ));

  /// Advance the wizard. Guarded by [CarQuestionnaireState.canAdvance]; on the
  /// last step it flips [CarQuestionnaireState.submitted] (the page shows the
  /// placeholder toast — no backend submit "for now").
  void next() {
    if (!state.canAdvance) return;
    if (state.isLastStep) {
      emit(state.copyWith(submitted: true));
      return;
    }
    emit(state.copyWith(currentStep: state.currentStep + 1, openField: null));
  }

  /// Step backward. Returns `false` when already on the first step so the page
  /// can pop the route instead.
  bool back() {
    if (state.isFirstStep) return false;
    emit(state.copyWith(currentStep: state.currentStep - 1, openField: null));
    return true;
  }

  /// Sync from `PageView.onPageChanged` (kept in case swipe is re-enabled).
  void goToStep(int step) =>
      emit(state.copyWith(currentStep: step, openField: null));
}
