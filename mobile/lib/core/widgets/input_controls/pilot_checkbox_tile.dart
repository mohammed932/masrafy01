import 'package:flutter/material.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import 'package:gap/gap.dart';
import 'package:app/core/theme/colors/pilot_color_theme.dart';
import 'package:app/core/theme/typography/pilot_text_theme.dart';

class PilotCheckboxTile extends StatelessWidget {
  const PilotCheckboxTile({
    super.key,
    required this.label,
    this.value = false,
    this.onChanged,
    this.leadingIcon,
    this.tooltip,
    this.showDivider = true,
  });

  final String label;
  final bool value;
  final ValueChanged<bool>? onChanged;
  final Widget? leadingIcon;
  final String? tooltip;
  final bool showDivider;

  @override
  Widget build(BuildContext context) {
    final colors = PilotColorTheme.of(context);
    final text = PilotTextTheme.of(context);

    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        GestureDetector(
          behavior: HitTestBehavior.opaque,
          onTap: () => onChanged?.call(!value),
          child: Padding(
            padding: EdgeInsets.symmetric(vertical: 13.h),
            child: Row(
              children: [
                if (leadingIcon != null) ...[
                  leadingIcon!,
                  Gap(12.w),
                ],
                SizedBox(
                  width: 18.r,
                  height: 18.r,
                  child: Checkbox(
                    value: value,
                    onChanged: (v) => onChanged?.call(v ?? false),
                    activeColor: colors.primary.main,
                    materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
                    visualDensity: VisualDensity.compact,
                    shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(3.r)),
                  ),
                ),
                Gap(12.w),
                Expanded(
                  child: Text(
                    label,
                    style: text.body.copyWith(color: colors.text.heading),
                  ),
                ),
              ],
            ),
          ),
        ),
        if (showDivider) Divider(height: 1.h, color: colors.border.secondary),
      ],
    );
  }
}
