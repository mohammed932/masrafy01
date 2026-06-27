import 'package:flutter/material.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import 'package:gap/gap.dart';
import 'package:app/core/theme/colors/masrafy_color_theme.dart';
import 'package:app/core/theme/typography/masrafy_text_theme.dart';

/// One Settings & Security row (Figma `2107:73` / `2107:88`): a white rounded
/// card with a coloured 40×40 icon tile, a title + subtitle, and an optional
/// [trailing] control (a `MasrafySwitch`) or a whole-row [onTap]. The richer
/// sibling of `AccountMenuTile` (which lacks subtitle + trailing). Flow-local
/// to the settings_security flow (Principle XXXII / XXXIII).
class SettingsTile extends StatelessWidget {
  const SettingsTile({
    super.key,
    required this.icon,
    required this.iconColor,
    required this.title,
    required this.subtitle,
    this.trailing,
    this.onTap,
  });

  final IconData icon;
  final Color iconColor;
  final String title;
  final String subtitle;
  final Widget? trailing;
  final VoidCallback? onTap;

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
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      title,
                      style: text.bodyLarge.bold().copyWith(
                            color: colors.text.heading,
                          ),
                    ),
                    Gap(2.h),
                    Text(
                      subtitle,
                      style: text.bodySmall.copyWith(
                            color: colors.text.tertiary,
                          ),
                    ),
                  ],
                ),
              ),
              if (trailing != null) ...[
                Gap(12.w),
                trailing!,
              ],
            ],
          ),
        ),
      ),
    );
  }
}
