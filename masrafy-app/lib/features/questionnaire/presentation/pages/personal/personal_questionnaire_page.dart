part of 'personal.imports.dart';

/// Personal-loan questionnaire — the 4-step wizard host (Figma `4024:2442`,
/// `4024:3049`, `4024:3620`, `4024:4213`). A button-driven [PageView] of the
/// four step bodies with a gradient Next / Finish CTA pinned below. Each step
/// owns its own collapse-on-scroll gradient hero (per-step title + shared
/// subtitle + back + segmented progress) via [PersonalStepScaffold], so the
/// header shrinks as the form scrolls (Principle XXXIII / A35). The single
/// route-level widget for this file (Principle XXXVI); the step bodies are
/// flow-local non-route widgets.
@RoutePage()
class PersonalQuestionnairePage extends StatelessWidget {
  const PersonalQuestionnairePage({super.key});

  @override
  Widget build(BuildContext context) {
    return BlocProvider<PersonalQuestionnaireCubit>(
      create: (_) => getIt<PersonalQuestionnaireCubit>(),
      child: const _PersonalView(),
    );
  }
}

class _PersonalView extends StatefulWidget {
  const _PersonalView();

  @override
  State<_PersonalView> createState() => _PersonalViewState();
}

class _PersonalViewState extends State<_PersonalView> {
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

    return BlocConsumer<PersonalQuestionnaireCubit, PersonalQuestionnaireState>(
      listenWhen: (prev, curr) =>
          prev.currentStep != curr.currentStep ||
          (!prev.submitted && curr.submitted),
      listener: (ctx, state) {
        if (state.submitted) {
          ctx.router.push(
            MatchResultsRoute(
              args: MatchResultsArgs.fromRequest(
                request: mapPersonalToApplyRequest(state),
                loanTypeKey: 'personal',
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
        final cubit = ctx.read<PersonalQuestionnaireCubit>();

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
                  // (header + sheet live inside PersonalStepScaffold); the
                  // PageView is only the button-driven slide transition.
                  child: PageView(
                    controller: _controller,
                    physics: const NeverScrollableScrollPhysics(),
                    children: [
                      PersonalStepFinancing(state: state),
                      PersonalStepEmployment(state: state),
                      PersonalStepCommitments(state: state),
                      PersonalStepPreferences(state: state),
                    ],
                  ),
                ),
                Padding(
                  padding:
                      EdgeInsetsDirectional.fromSTEB(24.w, 8.h, 24.w, 12.h),
                  child: SafeArea(
                    top: false,
                    child: MasrafyGradientButton(
                      label: state.isLastStep
                          ? l.q_personal_finish
                          : l.q_personal_next,
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
