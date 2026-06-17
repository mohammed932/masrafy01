import 'package:auto_route/auto_route.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';

import 'package:app/core/theme/colors/masrafy_color_theme.dart';
import 'package:app/core/widgets/common/masrafy_gradient_header.dart';
import 'package:app/core/widgets/slivers/masrafy_sliver_gradient_header_delegate.dart';
import 'package:app/core/widgets/steppers/masrafy_segmented_progress.dart';
import 'package:app/l10n/generated/app_localizations.dart';

import '../cubit/car_questionnaire/car_questionnaire_cubit.dart';

/// Collapse-on-scroll host shared by the four car-loan wizard step bodies
/// (Figma `4024:2586`+). Each step is its OWN [CustomScrollView] with a pinned
/// gradient hero (per-step title + shared subtitle + back + segmented progress)
/// over a rounded sheet holding the step's form. Per-step independent scroll
/// views give each step its own collapse offset, so a short step always opens
/// fully expanded — unlike a single `NestedScrollView` whose shared offset
/// would leave short steps pre-collapsed (Principle XXXIII / A35, scrollable
/// wizard step).
///
/// Flow-local (Principle XXXII), NOT core: it bakes in this wizard's progress
/// semantics ([CarQuestionnaireState.totalSteps]) and back behaviour. The
/// gradient/glass-back/collapse styling stays in the shared
/// [MasrafyGradientHeader] + [MasrafySliverGradientHeaderDelegate].
class CarStepScaffold extends StatelessWidget {
  const CarStepScaffold({
    super.key,
    required this.title,
    required this.stepIndex,
    required this.child,
  });

  /// Localized hero title for this step.
  final String title;

  /// 0-based step index — drives the segmented progress fill.
  final int stepIndex;

  /// The step's form `Column` (the scaffold owns the surrounding padding).
  final Widget child;

  @override
  Widget build(BuildContext context) {
    final colors = MasrafyColorTheme.of(context);
    final l = AppLocalizations.of(context);
    final cubit = context.read<CarQuestionnaireCubit>();
    final topInset = MediaQuery.of(context).viewPadding.top;

    // Same semantics as the page's PopScope / back button: step back, and pop
    // the route only when already on the first step.
    void onBack() {
      if (!cubit.back()) context.router.maybePop();
    }

    return CustomScrollView(
      physics: const BouncingScrollPhysics(
        parent: AlwaysScrollableScrollPhysics(),
      ),
      slivers: [
        SliverPersistentHeader(
          pinned: true,
          delegate: MasrafySliverGradientHeaderDelegate(
            title: title,
            subtitle: l.q_car_subtitle,
            onBack: onBack,
            bottom: MasrafySegmentedProgress(
              total: CarQuestionnaireState.totalSteps,
              current: stepIndex,
            ),
            expandedHeight: MasrafyGradientHeader.expandedHeightFor(
              context,
              title: title,
              subtitle: l.q_car_subtitle,
              hasBack: true,
              bottomExtent: 18.h + 4.h, // Gap(18) + progress bar height
              minHeight: 180.h,
            ),
            collapsedHeight: topInset + kToolbarHeight + 14,
          ),
        ),
        SliverToBoxAdapter(
          // Pull the rounded sheet up over the hero's bottom edge, leaving a
          // small breathing band (40.h - 28.h ≈ 12.h) above the first field.
          child: Transform.translate(
            offset: Offset(0, -28.h),
            child: Container(
              width: double.infinity,
              decoration: BoxDecoration(
                color: colors.bg.layout,
                borderRadius: BorderRadiusDirectional.only(
                  topStart: Radius.circular(28.r),
                  topEnd: Radius.circular(28.r),
                ),
              ),
              child: Padding(
                padding: EdgeInsetsDirectional.fromSTEB(24.w, 40.h, 24.w, 24.h),
                child: child,
              ),
            ),
          ),
        ),
      ],
    );
  }
}
