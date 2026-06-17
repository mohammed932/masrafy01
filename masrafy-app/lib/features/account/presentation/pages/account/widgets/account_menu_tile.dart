import 'package:flutter/material.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import 'package:gap/gap.dart';
import 'package:app/core/theme/colors/masrafy_color_theme.dart';
import 'package:app/core/theme/typography/masrafy_text_theme.dart';

/// A single Account-menu row (Figma `4028:4395`): a white rounded card holding
/// a coloured icon tile and a title, tappable as a whole. Flow-local to the
/// account flow (Principle XXXII); UI-only.
class AccountMenuTile extends StatelessWidget {
  const AccountMenuTile({
    super.key,
    required this.icon,
    required this.iconColor,
    required this.title,
    required this.onTap,
  });

  final IconData icon;
  final Color iconColor;
  final String title;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = MasrafyColorTheme.of(context);
    final text = MasrafyTextTheme.of(context);

    return Material(
      color: colors.bg.container,
      borderRadius: BorderRadius.circular(15.r),
      child: InkWell(
        borderRadius: BorderRadius.circular(15.r),
        onTap: onTap,
        child: Padding(
          padding: EdgeInsetsDirectional.fromSTEB(14.w, 12.h, 14.w, 12.h),
          child: Row(
            children: [
              Container(
                width: 40.r,
                height: 40.r,
                decoration: BoxDecoration(
                  color: iconColor,
                  borderRadius: BorderRadius.circular(10.r),
                ),
                child: Icon(icon, color: colors.white, size: 22.r),
              ),
              Gap(16.w),
              Expanded(
                child: Text(
                  title,
                  style: text.bodyLarge.bold().copyWith(
                        color: colors.text.heading,
                      ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
