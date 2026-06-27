part of 'car_questionnaire_cubit.dart';

/// Editable answers across the 4 car-loan steps, addressed by [updateField].
enum CarField {
  // Step 1 — Vehicle & Financing
  vehicleCondition,
  modelYear,
  downPaymentPct,
  repaymentPeriod,
  // Step 2 — Employment & Income
  employmentStatus,
  monthlyIncome,
  salaryTransfer,
  employerApproved,
  // Step 3 — Financial Status
  currentLoans,
  currentInstallments,
  hasCreditCard,
  // Step 4 — Preferences
  priorityFactor,
  wantsInsurance,
}

/// Flat answer state for the car wizard (mirrors `MortgageQuestionnaireState`).
/// Option fields hold language-neutral ids (`'new'`); Yes/No fields are `bool?`;
/// the vehicle price is two `double` bounds. Derivations live here, not on the
/// cubit (Principle XXXI).
@freezed
class CarQuestionnaireState with _$CarQuestionnaireState {
  const factory CarQuestionnaireState({
    @Default(0) int currentStep,
    // Step 1
    String? vehicleCondition,
    String? modelYear,
    @Default(500000) double vehiclePriceStart,
    @Default(1500000) double vehiclePriceEnd,
    String? downPaymentPct,
    @Default(5) double repaymentPeriod,
    // Step 2
    String? employmentStatus,
    String? monthlyIncome,
    bool? salaryTransfer,
    String? employerApproved,
    // Step 3
    bool? currentLoans,
    @Default('') String currentInstallments,
    bool? hasCreditCard,
    // Step 4
    String? priorityFactor,
    bool? wantsInsurance,
    // UI
    @Default(false) bool submitted,
  }) = _CarQuestionnaireState;

  const CarQuestionnaireState._();

  static const int totalSteps = 4;

  bool get isFirstStep => currentStep == 0;
  bool get isLastStep => currentStep == totalSteps - 1;

  /// 1-based fill ratio used by the segmented progress bar.
  double get progress => (currentStep + 1) / totalSteps;

  bool get _step1Valid =>
      vehicleCondition != null &&
      modelYear != null &&
      downPaymentPct != null;

  bool get _step2Valid =>
      employmentStatus != null &&
      monthlyIncome != null &&
      salaryTransfer != null &&
      employerApproved != null;

  bool get _step3Valid =>
      currentLoans != null &&
      hasCreditCard != null &&
      // Installments are only required when the user has current obligations.
      (currentLoans == false || currentInstallments.trim().isNotEmpty);

  bool get _step4Valid => priorityFactor != null && wantsInsurance != null;

  /// Gate for the "Next" / "Finish" button on the active step.
  bool get canAdvance => switch (currentStep) {
        0 => _step1Valid,
        1 => _step2Valid,
        2 => _step3Valid,
        _ => _step4Valid,
      };
}
