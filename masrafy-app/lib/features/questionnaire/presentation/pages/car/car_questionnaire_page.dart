part of 'car.imports.dart';

/// Car-loan questionnaire — the 4-step wizard host (Figma `4024:2586`,
/// `4024:3204`, `4024:3744`, `4024:4023`). A button-driven [PageView] of the
/// four step bodies with a gradient Next / Finish CTA pinned below. Each step
/// owns its own collapse-on-scroll gradient hero (per-step title + shared
/// subtitle + back + segmented progress) via [CarStepScaffold], so the header
/// shrinks as the form scrolls (Principle XXXIII / A35). The single route-level
/// widget for this file (Principle XXXVI); the step bodies are flow-local
/// non-route widgets.
@RoutePage()
class CarQuestionnairePage extends StatelessWidget {
  const CarQuestionnairePage({super.key});

  @override
  Widget build(BuildContext context) {
    return BlocProvider<CarQuestionnaireCubit>(
      create: (_) => getIt<CarQuestionnaireCubit>(),
      child: const _CarView(),
    );
  }
}

class _CarView extends StatefulWidget {
  const _CarView();

  @override
  State<_CarView> createState() => _CarViewState();
}

class _CarViewState extends State<_CarView> {
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

    return BlocConsumer<CarQuestionnaireCubit, CarQuestionnaireState>(
      listenWhen: (prev, curr) =>
          prev.currentStep != curr.currentStep ||
          (!prev.submitted && curr.submitted),
      listener: (ctx, state) {
        if (state.submitted) {
          ctx.router.push(
            MatchResultsRoute(
              args: MatchResultsArgs.mock(
                loanTypeKey: 'car',
                amount: state.vehiclePriceEnd,
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
        final cubit = ctx.read<CarQuestionnaireCubit>();

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
                  // (header + sheet live inside CarStepScaffold); the PageView
                  // is only the button-driven slide transition.
                  child: PageView(
                    controller: _controller,
                    physics: const NeverScrollableScrollPhysics(),
                    children: [
                      CarStepVehicle(state: state),
                      CarStepEmployment(state: state),
                      CarStepFinancial(state: state),
                      CarStepPreferences(state: state),
                    ],
                  ),
                ),
                Padding(
                  padding: EdgeInsetsDirectional.fromSTEB(24.w, 8.h, 24.w, 12.h),
                  child: SafeArea(
                    top: false,
                    child: MasrafyGradientButton(
                      label: state.isLastStep ? l.q_car_finish : l.q_car_next,
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
