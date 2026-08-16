import 'package:flutter/material.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import 'package:gap/gap.dart';

import 'package:app/core/theme/colors/masrafy_color_theme.dart';
import 'package:app/core/theme/typography/masrafy_text_theme.dart';
import 'package:app/core/widgets/common/masrafy_gradient_header.dart';
import 'package:app/core/widgets/slivers/masrafy_sliver_gradient_header_delegate.dart';
import 'package:app/core/widgets/steppers/masrafy_segmented_progress.dart';

/// Collapse-on-scroll host for one loan-setup step.
///
/// Same shape as `QuestionnaireStepScaffold`, and deliberately so: the wizard the
/// customer is about to enter looks exactly like this one, so the two must not
/// read as different products. Each step is its OWN [CustomScrollView] with a
/// pinned gradient hero over a rounded sheet — per-step scroll views give each
/// step its own collapse offset, so a short step always opens fully expanded
/// (Principle XXXIII / A35; a shared `NestedScrollView` would pre-collapse them).
///
/// No keyboard handling here, unlike the questionnaire: every step of this wizard
/// is a tap-to-select list with no text input, so there is no inset to ride.
class LoanSetupStepScaffold extends StatelessWidget {
  const LoanSetupStepScaffold({
    super.key,
    required this.title,
    required this.subtitle,
    required this.stepIndex,
    required this.totalSteps,
    required this.onBack,
    required this.child,
    this.heading,
    this.helper,
  });

  /// Hero title for this step.
  final String title;

  /// Hero subtitle — the choices made so far, so the customer can see what this
  /// step is narrowing without walking back to check.
  final String subtitle;

  final int stepIndex;
  final int totalSteps;
  final VoidCallback onBack;

  /// Optional in-sheet heading above the choices.
  final String? heading;

  /// Optional one-liner under the heading.
  final String? helper;

  final Widget child;

  @override
  Widget build(BuildContext context) {
    final colors = MasrafyColorTheme.of(context);
    final text = MasrafyTextTheme.of(context);
    final topInset = MediaQuery.viewPaddingOf(context).top;
    final collapsedHeight = topInset + kToolbarHeight + 14;

    return CustomScrollView(
      physics: const BouncingScrollPhysics(
        parent: AlwaysScrollableScrollPhysics(),
      ),
      slivers: [
        SliverPersistentHeader(
          pinned: true,
          delegate: MasrafySliverGradientHeaderDelegate(
            title: title,
            subtitle: subtitle,
            onBack: onBack,
            bottom: MasrafySegmentedProgress(
              total: totalSteps,
              current: stepIndex,
            ),
            expandedHeight: MasrafyGradientHeader.expandedHeightFor(
              context,
              title: title,
              subtitle: subtitle,
              hasBack: true,
              bottomExtent: 18.h + 4.h, // Gap(18) + progress bar height
              minHeight: 180.h,
            ),
            collapsedHeight: collapsedHeight,
          ),
        ),
        SliverToBoxAdapter(
          // Pull the rounded sheet up over the hero's bottom edge, leaving a
          // small breathing band above the first choice.
          child: Transform.translate(
            offset: Offset(0, -28.h),
            child: Container(
              width: double.infinity,
              constraints: BoxConstraints(minHeight: 220.h),
              decoration: BoxDecoration(
                color: colors.bg.layout,
                borderRadius: BorderRadiusDirectional.only(
                  topStart: Radius.circular(28.r),
                  topEnd: Radius.circular(28.r),
                ),
              ),
              child: Padding(
                padding: EdgeInsetsDirectional.fromSTEB(24.w, 32.h, 24.w, 24.h),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    if (heading != null) ...[
                      Text(
                        heading!,
                        style: text.bodyLarge.bold().copyWith(
                              color: colors.text.heading,
                            ),
                      ),
                      if (helper != null) ...[
                        Gap(6.h),
                        Text(
                          helper!,
                          style: text.bodySmall.regular().copyWith(
                                color: colors.text.secondary,
                              ),
                        ),
                      ],
                      Gap(18.h),
                    ],
                    child,
                  ],
                ),
              ),
            ),
          ),
        ),
      ],
    );
  }
}
