import 'package:flutter/material.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import 'package:app/core/theme/colors/pilot_color_theme.dart';
import 'package:app/core/theme/typography/pilot_text_theme.dart';

enum PilotBadgeVariant { primary, success, warning, error, neutral }

class PilotBadge extends StatelessWidget {
  const PilotBadge({
    super.key,
    required this.label,
    this.variant = PilotBadgeVariant.primary,
    this.backgroundColor,
    this.textColor,
    this.borderColor,
  });

  final String label;
  final PilotBadgeVariant variant;
  final Color? backgroundColor;
  final Color? textColor;
  final Color? borderColor;

  @override
  Widget build(BuildContext context) {
    final colors = PilotColorTheme.of(context);
    final text = PilotTextTheme.of(context);

    final (bg, fg, border) = _resolveColors(colors);

    return Container(
      padding: EdgeInsets.symmetric(horizontal: 8.w, vertical: 2.h),
      decoration: BoxDecoration(
        color: backgroundColor ?? bg,
        borderRadius: BorderRadius.circular(100.r),
        border: Border.all(color: borderColor ?? border, width: 1),
      ),
      child: Text(
        label,
        style: text.bodySmall.semiBold().copyWith(color: textColor ?? fg),
      ),
    );
  }

  (Color, Color, Color) _resolveColors(PilotColorTheme colors) {
    return switch (variant) {
      PilotBadgeVariant.primary => (
          colors.primary.bg,
          colors.primary.text,
          colors.primary.border,
        ),
      PilotBadgeVariant.success => (
          colors.success.bg,
          colors.success.text,
          colors.success.border,
        ),
      PilotBadgeVariant.warning => (
          colors.warning.bg,
          colors.warning.text,
          colors.warning.border,
        ),
      PilotBadgeVariant.error => (
          colors.error.bg,
          colors.error.text,
          colors.error.border,
        ),
      PilotBadgeVariant.neutral => (
          colors.fill.secondary,
          colors.text.secondary,
          colors.border.main,
        ),
    };
  }
}
