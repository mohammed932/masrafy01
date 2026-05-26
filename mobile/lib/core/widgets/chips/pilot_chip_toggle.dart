import 'package:flutter/material.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import 'package:gap/gap.dart';
import 'package:app/core/theme/colors/pilot_color_theme.dart';
import 'package:app/core/theme/typography/pilot_text_theme.dart';

/// T152 — generic toggle chip with leading icon.
class PilotChipToggle extends StatelessWidget {
  const PilotChipToggle({
    super.key,
    required this.icon,
    required this.label,
    required this.isOn,
    required this.onTap,
  });

  final IconData icon;
  final String label;
  final bool isOn;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = PilotColorTheme.of(context);
    final texts = PilotTextTheme.of(context);

    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: EdgeInsets.symmetric(horizontal: 10.w, vertical: 6.h),
        decoration: BoxDecoration(
          color: isOn ? colors.primary.bg : colors.fill.handleBg,
          border: Border.all(
            color: isOn ? colors.primary.border : colors.border.main,
          ),
          borderRadius: BorderRadius.circular(24.r),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              icon,
              size: 18.r,
              color: isOn ? colors.primary.text : colors.text.primary,
            ),
            Gap(6.w),
            Text(
              label,
              style: texts.bodySmall.copyWith(
                color: isOn ? colors.primary.text : colors.text.primary,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
