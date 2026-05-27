import 'package:flutter/material.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import 'package:gap/gap.dart';
import 'package:app/core/theme/colors/masrafy_color_theme.dart';
import 'package:app/core/theme/typography/masrafy_text_theme.dart';

/// Full-width radio row: outlined card with a circular indicator on the
/// leading edge and a label. Selected state swaps to the primary border
/// + a filled center dot. Designed to mirror the Figma chip-radio used
/// by the Study Planner mode picker (node 3258:39381).
class MasrafyRadioTile<T> extends StatelessWidget {
  const MasrafyRadioTile({
    super.key,
    required this.value,
    required this.groupValue,
    required this.label,
    required this.onChanged,
    this.isEnabled = true,
  });

  final T value;
  final T? groupValue;
  final String label;
  final ValueChanged<T>? onChanged;
  final bool isEnabled;

  @override
  Widget build(BuildContext context) {
    final colors = MasrafyColorTheme.of(context);
    final texts = MasrafyTextTheme.of(context);
    final isSelected = value == groupValue;

    return Semantics(
      button: true,
      selected: isSelected,
      enabled: isEnabled,
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: isEnabled ? () => onChanged?.call(value) : null,
        child: Container(
          padding: EdgeInsets.symmetric(horizontal: 12.w, vertical: 12.h),
          decoration: BoxDecoration(
            color: colors.bg.container,
            borderRadius: BorderRadius.circular(12.r),
            border: Border.all(
              color: isSelected ? colors.primary.main : colors.border.main,
              width: isSelected ? 1.5 : 1,
            ),
          ),
          child: Row(
            children: [
              _RadioDot(isSelected: isSelected),
              Gap(8.w),
              Expanded(
                child: Text(
                  label,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: texts.body.regular().copyWith(
                        color: isEnabled
                            ? colors.text.primary
                            : colors.text.disabled,
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

class _RadioDot extends StatelessWidget {
  const _RadioDot({required this.isSelected});

  final bool isSelected;

  @override
  Widget build(BuildContext context) {
    final colors = MasrafyColorTheme.of(context);
    return Container(
      width: 16.r,
      height: 16.r,
      alignment: Alignment.center,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        border: Border.all(
          color: isSelected ? colors.primary.main : colors.border.main,
          width: 1.5,
        ),
        color: isSelected ? colors.primary.main : Colors.transparent,
      ),
      child: isSelected
          ? Container(
              width: 6.r,
              height: 6.r,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: colors.text.lightSolid,
              ),
            )
          : null,
    );
  }
}
