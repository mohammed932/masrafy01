part of 'loan_setup.imports.dart';

/// The three-step loan-setup wizard: category → income basis → catalog program.
///
/// Pushed from Home with the category the customer tapped, so it opens on step 2
/// with step 1 already satisfied and still walkable-back. The order is forced by
/// the data: a category decides which income bases have live programs, and a
/// basis decides which catalog names those programs instantiate. The old Home
/// screen asked for a name up front from the catalog's ASSIGNMENT, which offered
/// names no bank sells on the basis the customer would go on to need — and only
/// said so after the whole questionnaire had been filled in.
///
/// One public widget in its own file (Principle XXXVI); private leaves below.
@RoutePage()
class LoanSetupPage extends StatelessWidget {
  const LoanSetupPage({super.key, required this.categoryCode});

  /// Wire slug of the category chosen on Home. A slug rather than the enum so
  /// the generated route args stay primitive.
  final String categoryCode;

  @override
  Widget build(BuildContext context) {
    final category = LoanCategory.fromCode(categoryCode);
    return BlocProvider<LoanSetupCubit>(
      create: (_) => getIt<LoanSetupCubit>()..start(category),
      child: const _LoanSetupBody(),
    );
  }
}

class _LoanSetupBody extends StatefulWidget {
  const _LoanSetupBody();

  @override
  State<_LoanSetupBody> createState() => _LoanSetupBodyState();
}

class _LoanSetupBodyState extends State<_LoanSetupBody> {
  // Opens on step 2 — the category arrives answered from Home. Set here rather
  // than animated on the first frame so the wizard does not visibly slide past
  // a step the customer never sees.
  final PageController _controller = PageController(initialPage: 1);

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final colors = MasrafyColorTheme.of(context);

    return BlocConsumer<LoanSetupCubit, LoanSetupState>(
      listenWhen: (prev, curr) =>
          prev.currentStep != curr.currentStep ||
          (!prev.submitted && curr.submitted),
      listener: (ctx, state) {
        if (state.submitted) {
          // Disarmed BEFORE routing: the flag is a one-shot, so coming back and
          // pressing Continue again submits afresh instead of emitting the same
          // state (which the cubit drops, leaving the CTA dead).
          ctx.read<LoanSetupCubit>().submissionHandled();
          _openQuestionnaire(ctx, state);
          return;
        }
        if (_controller.hasClients) {
          _controller.animateToPage(
            state.stepIndex,
            duration: const Duration(milliseconds: 300),
            curve: Curves.easeInOut,
          );
        }
      },
      builder: (ctx, state) {
        final cubit = ctx.read<LoanSetupCubit>();
        // Anything that replaces the PageView detaches the controller, and a
        // detached PageController re-attaches at its `initialPage` rather than
        // where the wizard actually is. Re-sync after the frame so a remount can
        // never leave the rendered step and `stepIndex` disagreeing — the step
        // listener only fires on a CHANGE, so it would not catch this.
        WidgetsBinding.instance.addPostFrameCallback((_) {
          if (!mounted || !_controller.hasClients) return;
          if (_controller.page?.round() == state.stepIndex) return;
          _controller.jumpToPage(state.stepIndex);
        });

        // Step 1 is the four static categories — it needs nothing from the
        // network, so a category change must not flash the whole wizard away and
        // back. Only the steps built FROM the availability read wait for it.
        final awaitingOptions = state.stepIndex > 0 && state.options == null;
        // Also step-gated: on step 1 a category with nothing on offer must stay
        // a CHOICE — replacing the cards with a message would strand the
        // customer on a screen whose only exit is back to Home. There it is a
        // note under the cards (and a dead Next), not a wall.
        final nothingOnOffer =
            state.stepIndex > 0 && state.options != null && !state.hasAnyProgram;
        final blocked = state.hasError || awaitingOptions || nothingOnOffer;

        return Scaffold(
          backgroundColor: colors.bg.layout,
          body: switch (state) {
            _ when state.hasError => _MessageView(onRetry: cubit.retry),
            _ when awaitingOptions => const LoanSetupShimmer(),
            // The category exists but no bank sells it right now. Say so instead
            // of opening a step where every choice is dead.
            _ when nothingOnOffer => const _MessageView(),
            _ => _StepsView(state: state, controller: _controller),
          },
          bottomNavigationBar: blocked ? null : _StepCta(state: state),
        );
      },
    );
  }

  /// Hand the three choices to the questionnaire the customer is really here
  /// for. The category picks the route; the other two ride along as args and end
  /// up on the apply request, where they narrow the programs that are matched.
  void _openQuestionnaire(BuildContext context, LoanSetupState state) {
    final programNameKey = state.programKey;
    final incomeType = state.incomeType?.code;
    switch (state.category) {
      case LoanCategory.mortgage:
        context.router.push(MortgageQuestionnaireRoute(
          programNameKey: programNameKey,
          incomeType: incomeType,
        ));
      case LoanCategory.car:
        context.router.push(CarQuestionnaireRoute(
          programNameKey: programNameKey,
          incomeType: incomeType,
        ));
      case LoanCategory.business:
        context.router.push(BusinessQuestionnaireRoute(
          programNameKey: programNameKey,
          incomeType: incomeType,
        ));
      case LoanCategory.personal:
        context.router.push(PersonalQuestionnaireRoute(
          programNameKey: programNameKey,
          incomeType: incomeType,
        ));
    }
  }
}

class _StepsView extends StatelessWidget {
  const _StepsView({required this.state, required this.controller});

  final LoanSetupState state;
  final PageController controller;

  @override
  Widget build(BuildContext context) {
    final cubit = context.read<LoanSetupCubit>();

    return PopScope(
      // The system back gesture walks the wizard backwards; only the first step
      // pops the route, matching the questionnaire that follows.
      canPop: state.isFirstStep,
      onPopInvokedWithResult: (didPop, _) {
        if (!didPop) cubit.back();
      },
      // Each step is its own collapse-on-scroll CustomScrollView; the PageView is
      // only the button-driven slide.
      child: PageView(
        controller: controller,
        physics: const NeverScrollableScrollPhysics(),
        children: [
          // Keyed by step so each one's staggered entrance replays when the
          // customer arrives, and does NOT replay under their finger when a tap
          // rebuilds the step they are already on.
          LoanSetupCategoryStep(key: const ValueKey('category'), state: state),
          LoanSetupIncomeStep(key: const ValueKey('income'), state: state),
          LoanSetupProgramStep(key: const ValueKey('program'), state: state),
        ],
      ),
    );
  }
}

/// The step CTA, hosted in [Scaffold.bottomNavigationBar] so it sits below the
/// per-step scroll view rather than inside it.
class _StepCta extends StatelessWidget {
  const _StepCta({required this.state});

  final LoanSetupState state;

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    final cubit = context.read<LoanSetupCubit>();

    return Padding(
      padding: EdgeInsetsDirectional.fromSTEB(24.w, 8.h, 24.w, 12.h),
      child: SafeArea(
        top: false,
        maintainBottomViewPadding: true,
        child: MasrafyGradientButton(
          label: state.isLastStep ? l.loan_setup_finish : l.loan_setup_next,
          onPressed: state.canAdvance ? cubit.next : null,
        ),
      ),
    );
  }
}

/// Full-screen error / empty state. Shows a retry CTA when [onRetry] is set
/// (fetch failure); otherwise says the category has nothing on offer.
class _MessageView extends StatelessWidget {
  const _MessageView({this.onRetry});

  final VoidCallback? onRetry;

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    final colors = MasrafyColorTheme.of(context);
    final text = MasrafyTextTheme.of(context);
    final isError = onRetry != null;

    return SafeArea(
      child: Center(
        child: Padding(
          padding: EdgeInsetsDirectional.symmetric(horizontal: 32.w),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              if (isError) ...[
                Text(
                  l.loan_setup_error_title,
                  textAlign: TextAlign.center,
                  style: text.heading4.semiBold().copyWith(
                        color: colors.text.heading,
                      ),
                ),
                Gap(8.h),
              ],
              Text(
                isError ? l.loan_setup_error_message : l.loan_setup_no_options,
                textAlign: TextAlign.center,
                style: text.body.regular().copyWith(color: colors.text.secondary),
              ),
              if (isError) ...[
                Gap(24.h),
                MasrafyGradientButton(
                  label: l.loan_setup_retry,
                  onPressed: onRetry,
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}
