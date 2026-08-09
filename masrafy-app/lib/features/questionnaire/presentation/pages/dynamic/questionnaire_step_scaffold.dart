import 'package:flutter/material.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';

import 'package:app/core/theme/colors/masrafy_color_theme.dart';
import 'package:app/core/widgets/common/masrafy_gradient_header.dart';
import 'package:app/core/widgets/keyboard/masrafy_keyboard_inset.dart';
import 'package:app/core/widgets/slivers/masrafy_sliver_gradient_header_delegate.dart';
import 'package:app/core/widgets/steppers/masrafy_segmented_progress.dart';

/// Collapse-on-scroll host for one questionnaire step (one backend group).
/// Each step is its OWN [CustomScrollView] with a pinned gradient hero (group
/// title + shared subtitle + back + segmented progress) over a rounded sheet
/// holding the step's questions. Per-step independent scroll views give each
/// step its own collapse offset, so a short step always opens fully expanded —
/// a single `NestedScrollView` would pre-collapse short steps (Principle
/// XXXIII / A35, scrollable wizard step). Generic sibling of the bespoke
/// `PersonalStepScaffold`, parameterised so every category reuses it.
class QuestionnaireStepScaffold extends StatelessWidget {
  const QuestionnaireStepScaffold({
    super.key,
    required this.title,
    required this.subtitle,
    required this.stepIndex,
    required this.totalSteps,
    required this.onBack,
    required this.child,
  });

  /// Hero title for this step — the backend group title, locale-resolved.
  final String title;

  /// Shared hero subtitle (same across all steps).
  final String subtitle;

  /// 0-based step index — drives the segmented progress fill.
  final int stepIndex;

  /// Total number of steps (groups) — the progress bar segment count.
  final int totalSteps;

  /// Step-back / pop-route handler (owned by the view).
  final VoidCallback onBack;

  /// The step's form `Column` (the scaffold owns the surrounding padding).
  final Widget child;

  @override
  Widget build(BuildContext context) {
    final colors = MasrafyColorTheme.of(context);
    final topInset = MediaQuery.viewPaddingOf(context).top;
    final collapsedHeight = topInset + kToolbarHeight + 14;

    // Hand the shrinking viewport back to the form: as the keyboard rises the
    // delegate collapses the hero IN PLACE toward its compact toolbar, riding
    // the platform inset 1:1 (see MasrafyKeyboardInset — never re-animate it).
    //
    // Collapsing the header rather than scrolling it away is deliberate:
    // EditableText re-reveals the caret with a jumpTo on EVERY inset frame, and
    // jumpTo starts with goIdle(), which would kill an in-flight animateTo on
    // its second frame. This also works on a short step with no scroll extent.
    final keyboardProgress = MasrafyKeyboardInset.progressOf(context);

    return CustomScrollView(
      physics: const BouncingScrollPhysics(
        parent: AlwaysScrollableScrollPhysics(),
      ),
      // The CTA sits in the Scaffold's bottom slot, so the keyboard occludes it
      // rather than hiding it; dragging to dismiss uncovers it again.
      keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
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
            keyboardProgress: keyboardProgress,
          ),
        ),
        SliverToBoxAdapter(
          // Pull the rounded sheet up over the hero's bottom edge, leaving a
          // small breathing band above the first field.
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
