import 'package:flutter/material.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import 'package:app/core/theme/colors/masrafy_color_theme.dart';

class MasrafyCard extends StatelessWidget {
  const MasrafyCard({
    super.key,
    required this.child,
    this.padding,
    this.onTap,
    this.radius,
    this.color,
    this.borderColor,
  });

  final Widget child;
  final EdgeInsetsGeometry? padding;
  final VoidCallback? onTap;
  final double? radius;
  final Color? color;
  final Color? borderColor;

  @override
  Widget build(BuildContext context) {
    final colors = MasrafyColorTheme.of(context);
    final effectiveRadius = radius ?? 12.r;
    final effectiveColor = color ?? colors.bg.container;

    return Material(
      color: effectiveColor,
      borderRadius: BorderRadius.circular(effectiveRadius),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(effectiveRadius),
        child: Container(
          padding: padding ?? EdgeInsets.all(16.r),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(effectiveRadius),
            border: borderColor != null
                ? Border.all(color: borderColor!, width: 1)
                : Border.all(color: colors.border.secondary, width: 1),
          ),
          child: child,
        ),
      ),
    );
  }
}
