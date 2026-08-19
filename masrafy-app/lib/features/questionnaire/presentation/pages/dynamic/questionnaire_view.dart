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
import 'package:app/core/widgets/keyboard/masrafy_keyboard_inset.dart';
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
        // No step with a question left = nothing to ask, not a blank wizard.
        final hasSteps =
            state.status == RequestState.loaded && state.steps.isNotEmpty;

        // Publishes the live keyboard inset past the Scaffold (which strips it
        // from its body's MediaQuery) so each step's hero can collapse as the
        // keyboard rises.
        return MasrafyKeyboardInset(
          child: Scaffold(
            backgroundColor: colors.bg.layout,
            body: switch (state.status) {
              RequestState.initial ||
              RequestState.loading =>
                const QuestionnaireShimmer(),
              RequestState.error =>
                _MessageView(onRetry: () => cubit.load(widget.category)),
              RequestState.loaded => state.steps.isEmpty
                  ? const _MessageView()
                  : _LoadedView(state: state, controller: _controller),
            },
            // Hosted here, NOT as a Column sibling of the body: _ScaffoldLayout
            // pins the bottom slot to `size.height - ctaHeight` ignoring the
            // keyboard inset, and insets the body by max(inset, ctaHeight). So
            // the CTA never moves — the real keyboard surface slides over it —
            // and the form rides the inset frame-by-frame. The sync is exact
            // because no Flutter animation is involved at all.
            bottomNavigationBar: hasSteps ? _StepCta(state: state) : null,
          ),
        );
      },
    );
  }
}

class _LoadedView extends StatelessWidget {
  const _LoadedView({required this.state, required this.controller});

  final QuestionnaireState state;
  final PageController controller;

  @override
  Widget build(BuildContext context) {
    final cubit = context.read<QuestionnaireCubit>();

    return PopScope(
      canPop: state.isFirstStep,
      onPopInvokedWithResult: (didPop, _) {
        if (!didPop) cubit.back();
      },
      // Each step is its own collapse-on-scroll CustomScrollView; the PageView
      // is only the button-driven slide transition.
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
    );
  }
}

/// The step's Next/Finish CTA, hosted in [Scaffold.bottomNavigationBar] — see
/// the note at the Scaffold for why that slot is what makes the keyboard motion
/// exact. It is occluded by the rising keyboard, never animated out of the way.
class _StepCta extends StatelessWidget {
  const _StepCta({required this.state});

  final QuestionnaireState state;

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    final cubit = context.read<QuestionnaireCubit>();
    // The last step additionally requires every money binding to resolve.
    final canProceed = state.isLastStep ? state.canFinish : state.canAdvance;
    final blocked = state.isLastStep && state.missingMoneyFigures.isNotEmpty;

    return Padding(
      padding: EdgeInsetsDirectional.fromSTEB(24.w, 8.h, 24.w, 12.h),
      // maintainBottomViewPadding is load-bearing here: the bottom slot inherits
      // `padding.bottom`, which the engine collapses 34 -> 0 over the keyboard's
      // first 34px of travel, so without it the CTA loses its home-indicator
      // inset and visibly sinks into the keyboard at twice its speed.
      // viewPadding.bottom is keyboard-independent, which is what a bar that
      // never moves needs.
      child: SafeArea(
        top: false,
        maintainBottomViewPadding: true,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            // A money-bound question left unanswered is never defaulted
            // (FR-044) — say why Finish is locked instead of submitting a
            // fabricated figure.
            if (blocked) ...[
              Text(
                l.q_dyn_money_missing,
                textAlign: TextAlign.center,
                style: MasrafyTextTheme.of(context).caption.regular().copyWith(
                      color: MasrafyColorTheme.of(context).text.secondary,
                    ),
              ),
              Gap(8.h),
            ],
            MasrafyGradientButton(
              label: state.isLastStep
                  ? l.q_dyn_finish
                  : state.isSkippableStep
                      ? l.collateral_skip_step
                      : l.q_dyn_next,
              onPressed: canProceed ? cubit.next : null,
            ),
            // Only on an all-optional, all-blank step. Says what skipping costs, so the
            // choice is informed rather than a guess about whether the CTA will refuse.
            if (!state.isLastStep && state.isSkippableStep) ...[
              Gap(8.h),
              Text(
                l.collateral_skip_hint,
                textAlign: TextAlign.center,
                style: MasrafyTextTheme.of(context).caption.regular().copyWith(
                      color: MasrafyColorTheme.of(context).text.secondary,
                    ),
              ),
            ],
          ],
        ),
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
