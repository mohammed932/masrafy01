part of 'business.imports.dart';

/// Business-loan questionnaire — the 4-step wizard host (Figma `4024:2741`,
/// `4024:3359`, `4024:3836`, `4024:4118`). A button-driven [PageView] of the
/// four step bodies with a gradient Next / Finish CTA pinned below. Each step
/// owns its own collapse-on-scroll gradient hero (per-step title + shared
/// subtitle + back + segmented progress) via [BusinessStepScaffold], so the
/// header shrinks as the form scrolls (Principle XXXIII / A35). The single
/// route-level widget for this file (Principle XXXVI); the step bodies are
/// flow-local non-route widgets. Mirrors the mortgage questionnaire flow.
@RoutePage()
class BusinessQuestionnairePage extends StatelessWidget {
  const BusinessQuestionnairePage({super.key});

  @override
  Widget build(BuildContext context) {
    return BlocProvider<BusinessQuestionnaireCubit>(
      create: (_) => getIt<BusinessQuestionnaireCubit>(),
      child: const _BusinessView(),
    );
  }
}

class _BusinessView extends StatefulWidget {
  const _BusinessView();

  @override
  State<_BusinessView> createState() => _BusinessViewState();
}

class _BusinessViewState extends State<_BusinessView> {
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

    return BlocConsumer<BusinessQuestionnaireCubit, BusinessQuestionnaireState>(
      listenWhen: (prev, curr) =>
          prev.currentStep != curr.currentStep ||
          (!prev.submitted && curr.submitted),
      listener: (ctx, state) {
        if (state.submitted) {
          ctx.router.push(
            MatchResultsRoute(
              args: MatchResultsArgs.mock(
                loanTypeKey: 'business',
                amount: double.tryParse(state.financingAmount) ?? 0,
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
        final cubit = ctx.read<BusinessQuestionnaireCubit>();

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
                  // (header + sheet live inside BusinessStepScaffold); the
                  // PageView is only the button-driven slide transition.
                  child: PageView(
                    controller: _controller,
                    physics: const NeverScrollableScrollPhysics(),
                    children: [
                      BusinessStepFinancing(state: state),
                      BusinessStepFinancial(state: state),
                      BusinessStepObligations(state: state),
                      BusinessStepPreferences(state: state),
                    ],
                  ),
                ),
                Padding(
                  padding: EdgeInsetsDirectional.fromSTEB(24.w, 8.h, 24.w, 12.h),
                  child: SafeArea(
                    top: false,
                    child: MasrafyGradientButton(
                      label: state.isLastStep
                          ? l.q_business_finish
                          : l.q_business_next,
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
