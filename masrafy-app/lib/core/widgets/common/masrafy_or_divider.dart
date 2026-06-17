import 'package:flutter/material.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import 'package:app/core/theme/colors/masrafy_color_theme.dart';
import 'package:app/core/theme/typography/masrafy_text_theme.dart';

/// "OR CONTINUE WITH" horizontal divider (Figma login + onboarding-3).
/// Shared per Principle XXXIII (used on ≥2 screens). Tokens only.
class MasrafyOrDivider extends StatelessWidget {
  const MasrafyOrDivider({super.key, required this.label});

  final String label;

  @override
  Widget build(BuildContext context) {
    final colors = MasrafyColorTheme.of(context);
    final text = MasrafyTextTheme.of(context);
    final line = Expanded(child: Divider(color: colors.border.split, height: 1));
    return Row(
      children: [
        line,
        Padding(
          padding: EdgeInsetsDirectional.symmetric(horizontal: 12.w),
          child: Text(
            label.toUpperCase(),
            style: text.caption.semiBold().copyWith(
                  color: colors.text.placeholder,
                  letterSpacing: 0.88,
                ),
          ),
        ),
        line,
      ],
    );
  }
}
