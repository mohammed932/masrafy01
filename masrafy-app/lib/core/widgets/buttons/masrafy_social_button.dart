import 'package:flutter/material.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import 'package:gap/gap.dart';
import 'package:app/core/theme/colors/masrafy_color_theme.dart';
import 'package:app/core/theme/typography/masrafy_text_theme.dart';

/// Outlined social-provider button (Google / Apple) used on the login screen
/// and the final onboarding slide. Shared per Principle XXXIII. Tokens only.
class MasrafySocialButton extends StatelessWidget {
  const MasrafySocialButton({
    super.key,
    required this.icon,
    required this.label,
    required this.onTap,
  });

  final IconData icon;
  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = MasrafyColorTheme.of(context);
    final text = MasrafyTextTheme.of(context);
    return InkWell(
      borderRadius: BorderRadius.circular(14.r),
      onTap: onTap,
      child: Container(
        height: 54.h,
        decoration: BoxDecoration(
          color: colors.bg.layout,
          borderRadius: BorderRadius.circular(14.r),
          border: Border.all(color: colors.border.main),
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(icon, size: 22.r, color: colors.text.heading),
            Gap(8.w),
            Text(
              label,
              style: text.bodySmall.semiBold().copyWith(color: colors.text.heading),
            ),
          ],
        ),
      ),
    );
  }
}
