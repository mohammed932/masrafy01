part of 'personal_questionnaire_cubit.dart';

/// Editable answers across the 4 personal-loan steps, addressed by [updateField].
enum PersonalField {
  // Step 1 — Financing Details
  loanAmount,
  repaymentPeriod,
  loanPurpose,
  // Step 2 — Employment & Income
  employmentStatus,
  jobTenure,
  monthlyIncome,
  salaryTransfer,
  employerApproved,
  // Step 3 — Banking Commitments
  obligations,
  monthlyInstallment,
  hasCreditCard,
  creditCardUsage,
  // Step 4 — Preferences & Qualifications
  priorityFactor,
  previouslyRejected,
  needsAssistance,
}

/// Flat answer state for the personal wizard (mirrors `CarQuestionnaireState`).
/// Option fields hold language-neutral ids (`'marriage'`); Yes/No fields are
/// `bool?`; the loan amount + installment are digits-only text; obligations is
/// a multi-select list of obligation-type ids. Derivations live here, not on
/// the cubit (Principle XXXI).
@freezed
class PersonalQuestionnaireState with _$PersonalQuestionnaireState {
  const factory PersonalQuestionnaireState({
    @Default(0) int currentStep,
    // Step 1
    @Default('') String loanAmount,
    @Default(4) double repaymentPeriod,
    String? loanPurpose,
    // Step 2
    String? employmentStatus,
    String? jobTenure,
    String? monthlyIncome,
    bool? salaryTransfer,
    String? employerApproved,
    // Step 3
    @Default([]) List<String> obligations,
    @Default('') String monthlyInstallment,
    bool? hasCreditCard,
    String? creditCardUsage,
    // Step 4
    String? priorityFactor,
    bool? previouslyRejected,
    bool? needsAssistance,
    // UI
    @Default(false) bool submitted,
  }) = _PersonalQuestionnaireState;

  const PersonalQuestionnaireState._();

  static const int totalSteps = 4;

  bool get isFirstStep => currentStep == 0;
  bool get isLastStep => currentStep == totalSteps - 1;

  /// 1-based fill ratio used by the segmented progress bar.
  double get progress => (currentStep + 1) / totalSteps;

  /// The requested principal (EGP) parsed from the digits-only amount field.
  double get amountValue => double.tryParse(loanAmount.trim()) ?? 0;

  /// `true` when the user selected at least one *real* obligation (anything
  /// other than the "none" sentinel), which gates the installment requirement.
  bool get hasRealObligations => obligations.any((o) => o != 'none');

  bool get _step1Valid => loanAmount.trim().isNotEmpty && loanPurpose != null;

  bool get _step2Valid =>
      employmentStatus != null &&
      jobTenure != null &&
      monthlyIncome != null &&
      salaryTransfer != null &&
      employerApproved != null;

  bool get _step3Valid =>
      hasCreditCard != null &&
      // Credit-card usage is only required when the user has a credit card.
      (hasCreditCard == false || creditCardUsage != null) &&
      // Installments are only required when there are real obligations.
      (!hasRealObligations || monthlyInstallment.trim().isNotEmpty);

  bool get _step4Valid =>
      priorityFactor != null &&
      previouslyRejected != null &&
      needsAssistance != null;

  /// Gate for the "Next" / "Finish" button on the active step.
  bool get canAdvance => switch (currentStep) {
        0 => _step1Valid,
        1 => _step2Valid,
        2 => _step3Valid,
        _ => _step4Valid,
      };
}
