import 'package:flutter/material.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import 'package:app/core/theme/colors/masrafy_color_theme.dart';
import 'package:app/core/theme/typography/masrafy_text_theme.dart';

enum MasrafyBadgeVariant { primary, success, warning, error, neutral }

class MasrafyBadge extends StatelessWidget {
  const MasrafyBadge({
    super.key,
    required this.label,
    this.variant = MasrafyBadgeVariant.primary,
    this.backgroundColor,
    this.textColor,
    this.borderColor,
  });

  final String label;
  final MasrafyBadgeVariant variant;
  final Color? backgroundColor;
  final Color? textColor;
  final Color? borderColor;

  @override
  Widget build(BuildContext context) {
    final colors = MasrafyColorTheme.of(context);
    final text = MasrafyTextTheme.of(context);

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

  (Color, Color, Color) _resolveColors(MasrafyColorTheme colors) {
    return switch (variant) {
      MasrafyBadgeVariant.primary => (
          colors.primary.bg,
          colors.primary.text,
          colors.primary.border,
        ),
      MasrafyBadgeVariant.success => (
          colors.success.bg,
          colors.success.text,
          colors.success.border,
        ),
      MasrafyBadgeVariant.warning => (
          colors.warning.bg,
          colors.warning.text,
          colors.warning.border,
        ),
      MasrafyBadgeVariant.error => (
          colors.error.bg,
          colors.error.text,
          colors.error.border,
        ),
      MasrafyBadgeVariant.neutral => (
          colors.fill.secondary,
          colors.text.secondary,
          colors.border.main,
        ),
    };
  }
}
