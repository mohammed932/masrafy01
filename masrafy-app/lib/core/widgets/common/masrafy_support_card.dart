import 'package:flutter/material.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import 'package:gap/gap.dart';
import 'package:app/core/theme/colors/masrafy_color_theme.dart';
import 'package:app/core/theme/typography/masrafy_text_theme.dart';

/// Navy "Ask Masrafy anything" support card (Figma `137:2966` / `4028:4421`).
/// A tappable dark banner with a bordered support icon, an uppercase [label]
/// and a [title]. Shared by the home + account screens (Principle XXXIII).
class MasrafySupportCard extends StatelessWidget {
  const MasrafySupportCard({
    super.key,
    required this.label,
    required this.title,
    required this.onTap,
  });

  final String label;
  final String title;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = MasrafyColorTheme.of(context);
    final text = MasrafyTextTheme.of(context);
    return InkWell(
      borderRadius: BorderRadius.circular(18.r),
      onTap: onTap,
      child: Container(
        padding: EdgeInsetsDirectional.all(17.r),
        decoration: BoxDecoration(
          color: Color.lerp(colors.primary.active, Colors.black, 0.4),
          borderRadius: BorderRadius.circular(18.r),
          border: Border.all(color: colors.secondary.main.withValues(alpha: 0.2)),
        ),
        child: Row(
          children: [
            Container(
              width: 46.r,
              height: 46.r,
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(14.r),
                border: Border.all(
                  color: colors.secondary.main.withValues(alpha: 0.3),
                ),
              ),
              child: Icon(
                Icons.support_agent_outlined,
                color: colors.secondary.hover,
                size: 24.r,
              ),
            ),
            Gap(14.w),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    label.toUpperCase(),
                    style: text.caption.bold().copyWith(
                          color: colors.secondary.hover,
                          letterSpacing: 0.8,
                        ),
                  ),
                  Gap(2.h),
                  Text(
                    title,
                    style: text.bodySmall.bold().copyWith(color: colors.white),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
