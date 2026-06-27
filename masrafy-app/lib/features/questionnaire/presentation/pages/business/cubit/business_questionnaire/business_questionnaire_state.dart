part of 'business_questionnaire_cubit.dart';

/// Editable answers across the 4 business-loan steps, addressed by
/// [updateField]. Monthly revenue is edited via
/// [BusinessQuestionnaireCubit.updateMonthlyRevenue], not this enum.
enum BusinessField {
  // Step 1 — Business & Financing
  activityType,
  businessAge,
  financingAmount,
  financingPurpose,
  repaymentPeriod,
  // Step 2 — Financial Information
  businessAccount,
  registered,
  taxRegistration,
  // Step 3 — Obligations & Credit Status
  currentFacilities,
  currentInstallments,
  priorRejection,
  // Step 4 — Preferences & Support
  priorityFactor,
  needsConsultation,
}

/// Flat answer state for the business-loan wizard (mirrors the mortgage state's
/// flat shape). Option fields hold language-neutral ids (`'trade'`); Yes/No
/// fields are `bool?`; the monthly revenue is two `double` bounds; business age,
/// financing amount and installments are free-text (digits). Derivations live
/// here, not on the cubit (Principle XXXI).
@freezed
class BusinessQuestionnaireState with _$BusinessQuestionnaireState {
  const factory BusinessQuestionnaireState({
    @Default(0) int currentStep,
    // Step 1
    String? activityType,
    @Default('') String businessAge,
    @Default('') String financingAmount,
    String? financingPurpose,
    @Default(4) double repaymentPeriod,
    // Step 2
    @Default(2000000) double monthlyRevenueStart,
    @Default(5000000) double monthlyRevenueEnd,
    bool? businessAccount,
    String? registered,
    bool? taxRegistration,
    // Step 3
    bool? currentFacilities,
    @Default('') String currentInstallments,
    bool? priorRejection,
    // Step 4
    String? priorityFactor,
    bool? needsConsultation,
    // UI
    @Default(false) bool submitted,
  }) = _BusinessQuestionnaireState;

  const BusinessQuestionnaireState._();

  static const int totalSteps = 4;

  bool get isFirstStep => currentStep == 0;
  bool get isLastStep => currentStep == totalSteps - 1;

  /// 1-based fill ratio used by the segmented progress bar.
  double get progress => (currentStep + 1) / totalSteps;

  bool get _step1Valid =>
      activityType != null &&
      businessAge.trim().isNotEmpty &&
      financingAmount.trim().isNotEmpty &&
      financingPurpose != null;

  bool get _step2Valid =>
      businessAccount != null &&
      registered != null &&
      taxRegistration != null;

  bool get _step3Valid =>
      currentFacilities != null &&
      priorRejection != null &&
      // Installments are only required when the business has current facilities.
      (currentFacilities == false || currentInstallments.trim().isNotEmpty);

  bool get _step4Valid => priorityFactor != null && needsConsultation != null;

  /// Gate for the "Next" / "Finish" button on the active step.
  bool get canAdvance => switch (currentStep) {
        0 => _step1Valid,
        1 => _step2Valid,
        2 => _step3Valid,
        _ => _step4Valid,
      };
}
