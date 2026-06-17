import 'package:flutter/material.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import 'package:gap/gap.dart';
import 'package:app/core/theme/colors/masrafy_color_theme.dart';
import 'package:app/core/theme/typography/masrafy_text_theme.dart';

/// Plain profile screen header (Figma `4028:4449`): a white rounded back chip
/// followed by the "Profile" title on the light layout background. The profile
/// screens use this in place of the gradient hero (so A35 does not apply); it
/// is flow-local (Principle XXXII) — bakes in the back-chip + title layout
/// specific to this flow.
class ProfileHeader extends StatelessWidget {
  const ProfileHeader({super.key, required this.title, required this.onBack});

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
