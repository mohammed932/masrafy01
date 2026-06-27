part of 'mortgage_questionnaire_cubit.dart';

/// Editable answers across the 4 mortgage steps, addressed by [updateField].
enum MortgageField {
  // Step 1 — Property & Financing
  propertyType,
  inCompound,
  registrationStatus,
  governorate,
  address,
  downPaymentPct,
  repaymentPeriod,
  // Step 2 — Employment & Income
  employmentStatus,
  monthlyIncome,
  salaryTransfer,
  additionalIncome,
  // Step 3 — Credit Profile
  currentLoans,
  currentInstallments,
  priorRejection,
  // Step 4 — Preferences
  priorityFactor,
  needsAssistance,
}

/// Flat answer state for the mortgage wizard (mirrors `SignupState`'s flat
/// shape). Option fields hold language-neutral ids (`'apartment'`); Yes/No
/// fields are `bool?`; the property value is two `double` bounds. Derivations
/// live here, not on the cubit (Principle XXXI).
@freezed
class MortgageQuestionnaireState with _$MortgageQuestionnaireState {
  const factory MortgageQuestionnaireState({
    @Default(0) int currentStep,
    // Step 1
    String? propertyType,
    bool? inCompound,
    String? registrationStatus,
    String? governorate,
    @Default('') String address,
    @Default(3200000) double propertyValueStart,
    @Default(8400000) double propertyValueEnd,
    String? downPaymentPct,
    @Default(15) double repaymentPeriod,
    // Step 2
    String? employmentStatus,
    String? monthlyIncome,
    bool? salaryTransfer,
    bool? additionalIncome,
    // Step 3
    bool? currentLoans,
    @Default('') String currentInstallments,
    bool? priorRejection,
    // Step 4
    String? priorityFactor,
    bool? needsAssistance,
    // UI
    @Default(false) bool submitted,
  }) = _MortgageQuestionnaireState;

  const MortgageQuestionnaireState._();

  static const int totalSteps = 4;

  bool get isFirstStep => currentStep == 0;
  bool get isLastStep => currentStep == totalSteps - 1;

  /// 1-based fill ratio used by the segmented progress bar.
  double get progress => (currentStep + 1) / totalSteps;

  bool get _step1Valid =>
      propertyType != null &&
      inCompound != null &&
      registrationStatus != null &&
      governorate != null &&
      downPaymentPct != null;

  bool get _step2Valid =>
      employmentStatus != null &&
      monthlyIncome != null &&
      salaryTransfer != null &&
      additionalIncome != null;

  bool get _step3Valid =>
      currentLoans != null &&
      priorRejection != null &&
      // Installments are only required when the user has current obligations.
      (currentLoans == false || currentInstallments.trim().isNotEmpty);

  bool get _step4Valid => priorityFactor != null && needsAssistance != null;

  /// Gate for the "Next" / "Finish" button on the active step.
  bool get canAdvance => switch (currentStep) {
        0 => _step1Valid,
        1 => _step2Valid,
        2 => _step3Valid,
        _ => _step4Valid,
      };
}
