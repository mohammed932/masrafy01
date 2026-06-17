import 'package:flutter/material.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import 'package:gap/gap.dart';
import 'package:intl/intl.dart';
import 'package:app/core/theme/colors/masrafy_color_theme.dart';
import 'package:app/core/theme/typography/masrafy_text_theme.dart';

/// Date-of-birth control (Figma `91:475`): an uppercase label over Day / Month
/// / Year display pills (Day + Month share a row, Year spans below) and an
/// optional green hint line. Tapping any pill calls [onTap], which the page
/// wires to [MasrafySingleDatePickerSheet]; the picker owns day/month validity
/// so this widget only displays the chosen [value].
///
/// Promoted to `core/widgets/input_controls/` per Principle XXXIII (shared by
/// signup + profile). State is fully external — the caller owns [value].
class MasrafyDobSelector extends StatelessWidget {
  const MasrafyDobSelector({
    super.key,
    required this.label,
    required this.onTap,
    required this.dayPlaceholder,
    required this.monthPlaceholder,
    required this.yearPlaceholder,
    this.value,
    this.ageVerifiedText,
  });

  final String label;
  final VoidCallback onTap;
  final String dayPlaceholder;
  final String monthPlaceholder;
  final String yearPlaceholder;
  final DateTime? value;
  final String? ageVerifiedText;

  @override
  Widget build(BuildContext context) {
    final colors = MasrafyColorTheme.of(context);
    final text = MasrafyTextTheme.of(context);
    final locale = Localizations.localeOf(context).toString();
    final v = value;
    final filled = v != null;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label.toUpperCase(),
          style: text.caption.semiBold().copyWith(
                color: colors.primary.main,
                letterSpacing: 0.66,
              ),
        ),
        Gap(6.h),
        Row(
          children: [
            Expanded(
              child: _Pill(
                value: filled ? v.day.toString() : dayPlaceholder,
                filled: filled,
                onTap: onTap,
              ),
            ),
            Gap(8.w),
            Expanded(
              child: _Pill(
                value: filled ? DateFormat.MMMM(locale).format(v) : monthPlaceholder,
                filled: filled,
                onTap: onTap,
              ),
            ),
          ],
        ),
        Gap(8.h),
        _Pill(
          value: filled ? v.year.toString() : yearPlaceholder,
          filled: filled,
          onTap: onTap,
        ),
        if (ageVerifiedText != null && ageVerifiedText!.isNotEmpty) ...[
          Gap(4.h),
          Padding(
            padding: EdgeInsetsDirectional.only(start: 2.w),
            child: Text(
              ageVerifiedText!,
              style: text.bodySmall.regular().copyWith(color: colors.success.main),
            ),
          ),
        ],
      ],
    );
  }
}

class _Pill extends StatelessWidget {
  const _Pill({required this.value, required this.filled, required this.onTap});

  final String value;
  final bool filled;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = MasrafyColorTheme.of(context);
    final text = MasrafyTextTheme.of(context);
    return GestureDetector(
      onTap: onTap,
      behavior: HitTestBehavior.opaque,
      child: Container(
        padding: EdgeInsets.symmetric(horizontal: 12.w, vertical: 13.h),
        decoration: BoxDecoration(
          color: filled
              ? colors.success.main.withValues(alpha: 0.06)
              : colors.bg.layout,
          border: Border.all(
            color: filled ? colors.success.main : colors.border.main,
          ),
          borderRadius: BorderRadius.circular(12.r),
        ),
        child: Text(
          value,
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: text.body.copyWith(
            color: filled ? colors.text.heading : colors.text.placeholder,
          ),
        ),
      ),
    );
  }
}
