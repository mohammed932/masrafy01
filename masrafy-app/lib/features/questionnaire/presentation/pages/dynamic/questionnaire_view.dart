import 'package:auto_route/auto_route.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import 'package:gap/gap.dart';

import 'package:app/core/di/injection.dart';
import 'package:app/core/enums/request_state.dart';
import 'package:app/core/router/router.gr.dart';
import 'package:app/core/theme/colors/masrafy_color_theme.dart';
import 'package:app/core/theme/typography/masrafy_text_theme.dart';
import 'package:app/core/widgets/buttons/masrafy_gradient_button.dart';
import 'package:app/features/matching/data/models/request/apply_request.dart';
import 'package:app/features/offers/presentation/models/match_results_args.dart';
import 'package:app/features/questionnaire/domain/enums/loan_category.dart';
import 'package:app/features/questionnaire/presentation/pages/dynamic/questionnaire_cubit.dart';
import 'package:app/features/questionnaire/presentation/pages/dynamic/questionnaire_shimmer.dart';
import 'package:app/features/questionnaire/presentation/pages/dynamic/questionnaire_step.dart';
import 'package:app/l10n/generated/app_localizations.dart';

/// Backend-driven questionnaire renderer shared by every loan category
/// (Principle II — the questionnaire is DATA). Creates the [QuestionnaireCubit],
/// loads the snapshot for [category] (the pool is global; [category] decides both
/// which of its questions are asked and which programs match), and renders one step per
/// group with a gradient Next/Finish CTA. On finish it maps the answers to an
/// [ApplyRequest] via [buildRequest] and pushes the match results (which runs
/// `/api/v1/apply`). Shimmer while loading, retry on error (Principle XXXIV).
/// Not a route itself — a per-category `*QuestionnairePage` hosts it (XXXVI).
class QuestionnaireView extends StatelessWidget {
  const QuestionnaireView({
    super.key,
    required this.category,
    required this.buildRequest,
  });

  final LoanCategory category;

  /// Maps the loaded state (visible answers + version) to the apply request.
  final ApplyRequest Function(QuestionnaireState state) buildRequest;

  @override
  Widget build(BuildContext context) {
    return BlocProvider<QuestionnaireCubit>(
      create: (_) => getIt<QuestionnaireCubit>()..load(category),
      child: _QuestionnaireBody(category: category, buildRequest: buildRequest),
    );
  }
}

class _QuestionnaireBody extends StatefulWidget {
  const _QuestionnaireBody(
      {required this.category, required this.buildRequest});

  final LoanCategory category;
  final ApplyRequest Function(QuestionnaireState state) buildRequest;

  @override
  State<_QuestionnaireBody> createState() => _QuestionnaireBodyState();
}

class _QuestionnaireBodyState extends State<_QuestionnaireBody> {
  final PageController _controller = PageController();

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final colors = MasrafyColorTheme.of(context);

    return BlocConsumer<QuestionnaireCubit, QuestionnaireState>(
      listenWhen: (prev, curr) =>
          prev.currentStep != curr.currentStep ||
          (!prev.submitted && curr.submitted),
      listener: (ctx, state) {
        if (state.submitted) {
          final args = MatchResultsArgs.fromRequest(
            request: widget.buildRequest(state),
            loanTypeKey: widget.category.code,
          );
          // Disarmed BEFORE routing: the flag is a one-shot, so coming back and
          // pressing Finish again submits afresh instead of emitting the same
          // state (which the cubit drops, leaving the CTA dead).
          ctx.read<QuestionnaireCubit>().submissionHandled();
          ctx.router.push(MatchResultsRoute(args: args));
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
        final cubit = ctx.read<QuestionnaireCubit>();
        // Read OUTSIDE the Scaffold: with resizeToAvoidBottomInset it strips
        // viewInsets.bottom from its body's MediaQuery, so a descendant always
        // reads 0 and never sees the keyboard.
        final keyboardOpen = MediaQuery.viewInsetsOf(ctx).bottom > 0;

        return Scaffold(
          backgroundColor: colors.bg.layout,
          body: switch (state.status) {
            RequestState.initial ||
            RequestState.loading =>
              const QuestionnaireShimmer(),
            RequestState.error =>
              _MessageView(onRetry: () => cubit.load(widget.category)),
            // No step with a question left = nothing to ask, not a blank wizard.
            RequestState.loaded => state.steps.isEmpty
                ? const _MessageView()
                : _LoadedView(
                    state: state,
                    controller: _controller,
                    keyboardOpen: keyboardOpen,
                  ),
          },
        );
      },
    );
  }
}

/// Step CTA enter/exit motion — tuned to read as one movement with the
/// platform keyboard slide rather than a separate pop.
const Duration _ctaMotion = Duration(milliseconds: 220);
const Curve _ctaCurve = Curves.easeOutCubic;

class _LoadedView extends StatelessWidget {
  const _LoadedView({
    required this.state,
    required this.controller,
    required this.keyboardOpen,
  });

  final QuestionnaireState state;
  final PageController controller;

  /// Keyboard visibility, resolved above the Scaffold (its body's MediaQuery
  /// has viewInsets.bottom removed). Drives hiding the CTA while typing.
  final bool keyboardOpen;

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    final cubit = context.read<QuestionnaireCubit>();
    // The last step additionally requires every money binding to resolve.
    final canProceed = state.isLastStep ? state.canFinish : state.canAdvance;
    final blocked = state.isLastStep && state.missingMoneyFigures.isNotEmpty;

    return PopScope(
      canPop: state.isFirstStep,
      onPopInvokedWithResult: (didPop, _) {
        if (!didPop) cubit.back();
      },
      child: Column(
        children: [
          Expanded(
            // Each step is its own collapse-on-scroll CustomScrollView; the
            // PageView is only the button-driven slide transition.
            child: PageView(
              controller: controller,
              physics: const NeverScrollableScrollPhysics(),
              children: [
                for (var i = 0; i < state.steps.length; i++)
                  QuestionnaireStep(
                    state: state,
                    group: state.steps[i],
                    stepIndex: i,
                  ),
              ],
            ),
          ),
          // The CTA lands right on top of the field being typed into once the
          // keyboard pushes the body up, so it slides out while typing and back
          // in when the keyboard closes (scroll-drag dismisses it too — see the
          // step scaffold's keyboardDismissBehavior). The SizeTransition frees
          // the row's height in step with the slide + fade, so the PageView
          // above grows smoothly instead of snapping.
          AnimatedSwitcher(
            duration: _ctaMotion,
            switchInCurve: _ctaCurve,
            switchOutCurve: _ctaCurve,
            transitionBuilder: (child, animation) => SizeTransition(
              sizeFactor: animation,
              axisAlignment: -1,
              child: SlideTransition(
                position: Tween<Offset>(
                  begin: const Offset(0, 0.4),
                  end: Offset.zero,
                ).animate(animation),
                child: FadeTransition(opacity: animation, child: child),
              ),
            ),
            child: keyboardOpen
                ? const SizedBox(
                    key: ValueKey('cta-hidden'),
                    width: double.infinity,
                  )
                : Padding(
                    key: const ValueKey('cta'),
                    padding:
                        EdgeInsetsDirectional.fromSTEB(24.w, 8.h, 24.w, 12.h),
                    child: SafeArea(
                      top: false,
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          // A money-bound question left unanswered is never
                          // defaulted (FR-044) — say why Finish is locked
                          // instead of submitting a fabricated figure.
                          if (blocked) ...[
                            Text(
                              l.q_dyn_money_missing,
                              textAlign: TextAlign.center,
                              style: MasrafyTextTheme.of(context)
                                  .caption
                                  .regular()
                                  .copyWith(
                                    color: MasrafyColorTheme.of(context)
                                        .text
                                        .secondary,
                                  ),
                            ),
                            Gap(8.h),
                          ],
                          MasrafyGradientButton(
                            label: state.isLastStep
                                ? l.q_dyn_finish
                                : l.q_dyn_next,
                            onPressed: canProceed ? cubit.next : null,
                          ),
                        ],
                      ),
                    ),
                  ),
          ),
        ],
      ),
    );
  }
}

/// Full-screen error / empty state. Shows a retry CTA when [onRetry] is set
/// (fetch failure); otherwise a plain "no questions" message (empty snapshot).
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
              if (isError)
                Text(
                  l.q_dyn_error_title,
                  textAlign: TextAlign.center,
                  style: text.heading4.semiBold().copyWith(
                        color: colors.text.heading,
                      ),
                ),
              if (isError) Gap(8.h),
              Text(
                isError ? l.q_dyn_error_message : l.q_dyn_empty,
                textAlign: TextAlign.center,
                style: text.body.regular().copyWith(
                      color: colors.text.secondary,
                    ),
              ),
              if (isError) ...[
                Gap(24.h),
                MasrafyGradientButton(label: l.q_dyn_retry, onPressed: onRetry),
              ],
            ],
          ),
        ),
      ),
    );
  }
}
