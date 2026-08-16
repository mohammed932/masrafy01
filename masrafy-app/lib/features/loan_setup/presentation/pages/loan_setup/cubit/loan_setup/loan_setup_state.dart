part of 'loan_setup_cubit.dart';

/// The three wizard steps, in the order each one's options become knowable.
enum LoanSetupStep { category, incomeType, program }

@freezed
class LoanSetupState with _$LoanSetupState {
  const factory LoanSetupState({
    @Default(LoanCategory.personal) LoanCategory category,

    /// What the backend says is pickable for [category]. Null until the first
    /// successful read, and cleared on every category change so a stale list can
    /// never be rendered under a new heading.
    ProgramOptionsEntity? options,
    @Default(RequestState.initial) RequestState status,
    Failure? failure,

    /// The chosen income basis, or null before step 2 is answered.
    IncomeType? incomeType,

    /// The chosen catalog name, or null before step 3 is answered / when the
    /// chosen basis offers none.
    String? programKey,
    @Default(0) int currentStep,

    /// One-shot: the page has everything it needs and should route on.
    @Default(false) bool submitted,
  }) = _LoanSetupState;

  // ignore: unused_element
  const LoanSetupState._();

  static const List<LoanSetupStep> steps = LoanSetupStep.values;

  int get totalSteps => steps.length;

  /// Clamped, so a step index can never point past the wizard.
  int get stepIndex => currentStep.clamp(0, totalSteps - 1);

  LoanSetupStep get step => steps[stepIndex];

  bool get isFirstStep => stepIndex == 0;
  bool get isLastStep => stepIndex == totalSteps - 1;

  bool get isLoading =>
      status == RequestState.initial || status == RequestState.loading;
  bool get hasError => status == RequestState.error;

  /// The income bases to render on step 2 — always both, including any with
  /// nothing behind them.
  ///
  /// A basis with no live program is shown DISABLED with a reason, never hidden.
  /// Hiding it turns a two-choice step into a one-choice step with no
  /// explanation, and the customer cannot tell "no bank sells this category that
  /// way" from "the app is broken".
  List<IncomeTypeOptionEntity> get incomeTypeOptions =>
      options?.incomeTypes ?? const [];

  bool isIncomeTypeAvailable(IncomeType type) =>
      options?.optionFor(type)?.isAvailable ?? false;

  /// The catalog names offered on the chosen basis. Empty before step 2 is
  /// answered.
  List<ProgramNameOptionEntity> get programsForSelection {
    final type = incomeType;
    if (type == null) return const [];
    return options?.optionFor(type)?.programNames ?? const [];
  }

  /// True when the category has at least one live program on either basis.
  /// False is a real state — an operator has not staffed this category yet — and
  /// the wizard says so rather than offering a step where every choice is dead.
  bool get hasAnyProgram => options?.hasAnyProgram ?? false;

  /// Whether a program name must be picked before finishing.
  ///
  /// False when the chosen basis offers none, so the customer is never trapped on
  /// the last step by a catalog an operator has not filled in. The request then
  /// goes out category + basis only, which still narrows correctly.
  bool get requiresProgram => programsForSelection.isNotEmpty;

  /// Whether the current step is answered well enough to move on.
  bool get canAdvance => switch (step) {
        // Always satisfied — the category arrives pre-selected from Home and the
        // enum has no empty value.
        LoanSetupStep.category => !isLoading && !hasError && hasAnyProgram,
        LoanSetupStep.incomeType =>
          incomeType != null && isIncomeTypeAvailable(incomeType!),
        LoanSetupStep.program => !requiresProgram || programKey != null,
      };
}
