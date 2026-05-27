import 'package:flutter/material.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import 'package:percent_indicator/percent_indicator.dart';
import 'package:app/core/theme/colors/masrafy_color_theme.dart';

class MasrafyLinearProgress extends StatelessWidget {
  const MasrafyLinearProgress({
    super.key,
    required this.value,
    this.height,
    this.fillColor,
    this.trackColor,
    this.radius,
  });

  /// Progress value in [0.0, 1.0].
  final double value;
  final double? height;
  final Color? fillColor;
  final Color? trackColor;
  final double? radius;

  @override
  Widget build(BuildContext context) {
    final colors = MasrafyColorTheme.of(context);
    final clampedValue = value.clamp(0.0, 1.0);

    return LinearPercentIndicator(
      percent: clampedValue,
      lineHeight: height ?? 8.h,
      backgroundColor: trackColor ?? colors.fill.secondary,
      progressColor: fillColor ?? colors.primary.main,
      barRadius: Radius.circular(radius ?? 100.r),
      padding: EdgeInsets.zero,
      animation: false,
    );
  }
}
