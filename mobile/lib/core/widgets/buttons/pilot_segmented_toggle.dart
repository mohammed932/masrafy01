import 'package:flutter/material.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import 'package:gap/gap.dart';
import 'package:app/core/theme/colors/pilot_color_theme.dart';
import 'package:app/core/theme/typography/pilot_text_theme.dart';

class PilotSegmentOption<T> {
  final T value;
  final String label;
  final IconData icon;

  const PilotSegmentOption({
    required this.value,
    required this.label,
    required this.icon,
  });
}

class PilotSegmentedToggle<T> extends StatelessWidget {
  const PilotSegmentedToggle({
    super.key,
    required this.options,
    required this.selectedValue,
    required this.onChanged,
  });

  final List<PilotSegmentOption<T>> options;
  final T selectedValue;
  final ValueChanged<T> onChanged;

  @override
  Widget build(BuildContext context) {
    final colors = PilotColorTheme.of(context);
    final text = PilotTextTheme.of(context);

    return Row(
      children: options.map((option) {
        final isActive = option.value == selectedValue;
        return Expanded(
          child: GestureDetector(
            onTap: isActive ? null : () => onChanged(option.value),
            child: Container(
              height: 36.h,
              padding: EdgeInsets.symmetric(horizontal: 12.w),
              decoration: BoxDecoration(
                color: isActive ? colors.primary.main : colors.bg.layout,
                border: Border.all(
                  color: isActive ? colors.primary.main : colors.border.main,
                ),
                borderRadius: BorderRadius.circular(18.r),
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(
                    option.icon,
                    size: 16.r,
                    color: isActive ? colors.white : colors.text.secondary,
                  ),
                  Gap(8.w),
                  Text(
                    option.label,
                    style: text.bodySmall.semiBold().copyWith(
                          color: isActive ? colors.white : colors.text.secondary,
                        ),
                  ),
                ],
              ),
            ),
          ),
        );
      }).toList(),
    );
  }
}
