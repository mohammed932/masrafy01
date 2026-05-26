import 'package:flutter/material.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import 'package:app/core/theme/colors/pilot_color_theme.dart';
import 'package:app/core/theme/typography/pilot_text_theme.dart';
import 'package:app/core/widgets/input_controls/pilot_popup_menu.dart';

class PilotPeriodSelector<T> extends StatelessWidget {
  const PilotPeriodSelector({
    super.key,
    required this.options,
    required this.labels,
    required this.selected,
    required this.onChanged,
  });

  final List<T> options;
  final List<String> labels;
  final T selected;
  final ValueChanged<T> onChanged;

  @override
  Widget build(BuildContext context) {
    final colors = PilotColorTheme.of(context);
    final text = PilotTextTheme.of(context);
    final idx = options.indexOf(selected);
    final currentLabel = idx >= 0 ? labels[idx] : '';

    return PilotPopupMenu<T>(
      selectedValue: selected,
      onSelected: onChanged,
      options: [
        for (var i = 0; i < options.length; i++)
          PilotPopupMenuOption(value: options[i], label: labels[i]),
      ],
      child: Container(
        padding: EdgeInsets.symmetric(horizontal: 10.w, vertical: 6.h),
        decoration: BoxDecoration(
          color: colors.fill.tertiary,
          borderRadius: BorderRadius.circular(8.r),
          border: Border.all(color: colors.border.secondary),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              currentLabel,
              style: text.bodySmall.medium().copyWith(color: colors.text.primary),
            ),
            SizedBox(width: 4.w),
            Icon(Icons.keyboard_arrow_down_rounded, size: 14.r, color: colors.text.secondary),
          ],
        ),
      ),
    );
  }
}
