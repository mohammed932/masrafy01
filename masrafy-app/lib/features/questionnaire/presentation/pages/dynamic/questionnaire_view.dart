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
/// loads the snapshot for [category], and renders one step per group with a
/// gradient Next/Finish CTA. On finish it maps the picked answers to an
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
  const _QuestionnaireBody({required this.category, required this.buildRequest});

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
          ctx.router.push(
            MatchResultsRoute(
              args: MatchResultsArgs.fromRequest(
                request: widget.buildRequest(state),
                loanTypeKey: widget.category.code,
              ),
            ),
          );
          return;
        }
        if (_controller.hasClients) {
          _controller.animateToPage(
            state.currentStep,
            duration: const Duration(milliseconds: 300),
            curve: Curves.easeInOut,
          );
        }
      },
      builder: (ctx, state) {
        final cubit = ctx.read<QuestionnaireCubit>();

        return Scaffold(
          backgroundColor: colors.bg.layout,
          body: switch (state.status) {
            RequestState.initial ||
            RequestState.loading =>
              const QuestionnaireShimmer(),
            RequestState.error =>
              _MessageView(onRetry: () => cubit.load(widget.category)),
            RequestState.loaded => state.groups.isEmpty
                ? const _MessageView()
                : _LoadedView(state: state, controller: _controller),
          },
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
    final l = AppLocalizations.of(context);
    final cubit = context.read<QuestionnaireCubit>();

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
                for (var i = 0; i < state.groups.length; i++)
                  QuestionnaireStep(
                    state: state,
                    group: state.groups[i],
                    stepIndex: i,
                  ),
              ],
            ),
          ),
          Padding(
            padding: EdgeInsetsDirectional.fromSTEB(24.w, 8.h, 24.w, 12.h),
            child: SafeArea(
              top: false,
              child: MasrafyGradientButton(
                label: state.isLastStep ? l.q_dyn_finish : l.q_dyn_next,
                onPressed: state.canAdvance ? cubit.next : null,
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
