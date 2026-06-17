import 'package:flutter/material.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import 'package:gap/gap.dart';
import 'package:app/core/theme/colors/masrafy_color_theme.dart';

/// Thin segmented progress bar for multi-step flows, rendered on the brand
/// gradient hero (Figma mortgage questionnaire `4024:2197`+). [total] equal
/// segments; every segment at index `<= current` (0-based active step) reads
/// as filled, the rest are dimmed. Colors are white-based because it sits on
/// the gradient — derived from `colors.white` so it stays token-driven and
/// flips correctly with the theme (Principle VIII / A18). Promoted to
/// `core/widgets/steppers/` per Principle XXXIII (shared across the four
/// questionnaire groups).
class MasrafySegmentedProgress extends StatelessWidget {
  const MasrafySegmentedProgress({
    super.key,
    required this.total,
    required this.current,
    this.height = 4,
    this.gap = 6,
  });

  /// Number of segments (steps).
  final int total;

  /// 0-based index of the active step; segments up to and including it fill.
  final int current;

  final double height;
  final double gap;

  @override
  Widget build(BuildContext context) {
    final colors = MasrafyColorTheme.of(context);
    return Row(
      children: [
        for (int i = 0; i < total; i++) ...[
          if (i > 0) Gap(gap.w),
          Expanded(
            child: AnimatedContainer(
              duration: const Duration(milliseconds: 250),
              curve: Curves.easeOut,
              height: height.h,
              decoration: BoxDecoration(
                color: i <= current
                    ? colors.white
                    : colors.white.withValues(alpha: 0.25),
                borderRadius: BorderRadius.circular(height.r),
              ),
            ),
          ),
        ],
      ],
    );
  }
}
