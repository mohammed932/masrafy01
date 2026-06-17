part of 'mortgage.imports.dart';

/// Mortgage questionnaire — the 4-step wizard host (Figma `4024:2197`,
/// `4024:2914`, `4024:3528`, `4024:3928`). A button-driven [PageView] of the
/// four step bodies with a gradient Next / Finish CTA pinned below. Each step
/// owns its own collapse-on-scroll gradient hero (per-step title + shared
/// subtitle + back + segmented progress) via [MortgageStepScaffold], so the
/// header shrinks as the form scrolls (Principle XXXIII / A35). The single
/// route-level widget for this file (Principle XXXVI); the step bodies are
/// flow-local non-route widgets.
@RoutePage()
class MortgageQuestionnairePage extends StatelessWidget {
  const MortgageQuestionnairePage({super.key});

  @override
  Widget build(BuildContext context) {
    return BlocProvider<MortgageQuestionnaireCubit>(
      create: (_) => getIt<MortgageQuestionnaireCubit>(),
      child: const _MortgageView(),
    );
  }
}

class _MortgageView extends StatefulWidget {
  const _MortgageView();

  @override
  State<_MortgageView> createState() => _MortgageViewState();
}

class _MortgageViewState extends State<_MortgageView> {
  final PageController _controller = PageController();

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final colors = MasrafyColorTheme.of(context);
    final l = AppLocalizations.of(context);

    return BlocConsumer<MortgageQuestionnaireCubit, MortgageQuestionnaireState>(
      listenWhen: (prev, curr) =>
          prev.currentStep != curr.currentStep ||
          (!prev.submitted && curr.submitted),
      listener: (ctx, state) {
        if (state.submitted) {
          ctx.router.push(
            MatchResultsRoute(
              args: MatchResultsArgs.mock(
                loanTypeKey: 'mortgage',
                amount: state.propertyValueEnd,
                durationMonths: (state.repaymentPeriod * 12).round(),
              ),
            ),
          );
          return;
        }
        _controller.animateToPage(
          state.currentStep,
          duration: const Duration(milliseconds: 300),
          curve: Curves.easeInOut,
        );
      },
      builder: (ctx, state) {
        final cubit = ctx.read<MortgageQuestionnaireCubit>();

        return PopScope(
          canPop: state.isFirstStep,
          onPopInvokedWithResult: (didPop, _) {
            if (!didPop) cubit.back();
          },
          child: Scaffold(
            backgroundColor: colors.bg.layout,
            body: Column(
              children: [
                Expanded(
                  // Each step is its own collapse-on-scroll CustomScrollView
                  // (header + sheet live inside MortgageStepScaffold); the
                  // PageView is only the button-driven slide transition.
                  child: PageView(
                    controller: _controller,
                    physics: const NeverScrollableScrollPhysics(),
                    children: [
                      MortgageStepProperty(state: state),
                      MortgageStepEmployment(state: state),
                      MortgageStepCredit(state: state),
                      MortgageStepPreferences(state: state),
                    ],
                  ),
                ),
                Padding(
                  padding: EdgeInsetsDirectional.fromSTEB(24.w, 8.h, 24.w, 12.h),
                  child: SafeArea(
                    top: false,
                    child: MasrafyGradientButton(
                      label: state.isLastStep
                          ? l.q_mortgage_finish
                          : l.q_mortgage_next,
                      onPressed: state.canAdvance ? cubit.next : null,
                    ),
                  ),
                ),
              ],
            ),
          ),
        );
      },
    );
  }
}
