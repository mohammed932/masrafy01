import 'package:flutter/material.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import 'package:gap/gap.dart';
import 'package:app/core/theme/colors/masrafy_color_theme.dart';
import 'package:app/core/theme/typography/masrafy_text_theme.dart';

/// Plain screen header (Figma `4028:4449` / `4028:4383`): a white rounded back
/// chip followed by the screen title on the light layout background. Used in
/// place of the gradient hero on flat screens (so A35 does not apply). Shared
/// across the profile + account flows (Principle XXXIII).
class MasrafyBackTitleHeader extends StatelessWidget {
  const MasrafyBackTitleHeader({
    super.key,
    required this.title,
    required this.onBack,
  });

  final String title;
  final VoidCallback onBack;

  @override
  Widget build(BuildContext context) {
    final colors = MasrafyColorTheme.of(context);
    final text = MasrafyTextTheme.of(context);
    final isRtl = Directionality.of(context) == TextDirection.rtl;

    return Padding(
      padding: EdgeInsetsDirectional.fromSTEB(20.w, 12.h, 20.w, 8.h),
      child: Row(
        children: [
          GestureDetector(
            onTap: onBack,
            behavior: HitTestBehavior.opaque,
            child: Container(
              width: 40.r,
              height: 40.r,
              decoration: BoxDecoration(
                color: colors.bg.container,
                borderRadius: BorderRadius.circular(12.r),
                border: Border.all(color: colors.border.main),
              ),
              child: Icon(
                isRtl ? Icons.chevron_right : Icons.chevron_left,
                size: 24.r,
                color: colors.text.heading,
              ),
            ),
          ),
          Gap(12.w),
          Text(
            title,
            style: text.heading4.bold().copyWith(color: colors.text.heading),
          ),
        ],
      ),
    );
  }
}
