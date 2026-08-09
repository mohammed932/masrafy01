import 'package:flutter/material.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import 'package:gap/gap.dart';
import 'package:intl/intl.dart';
import 'package:app/core/theme/colors/masrafy_color_theme.dart';
import 'package:app/core/theme/typography/masrafy_text_theme.dart';
import 'package:app/core/widgets/input_controls/masrafy_field_metrics.dart';

/// Date-of-birth control: an uppercase label over a single tappable, read-only
/// field that shows the chosen date (localized, e.g. `21 March 1992`), plus an
/// optional green hint line. Tapping the field calls [onTap], which the page
/// wires to [MasrafySingleDatePickerSheet]; the picker owns date validity, so
/// this widget only displays the chosen [value] (or [hint] when empty).
///
/// Styled to match the app's canonical trigger `MasrafySelectField` (uppercase
/// label, shared [MasrafyFieldMetrics] geometry) but opens a calendar sheet
/// rather than the select sheet. A filled field keeps the neutral chrome — the
/// age line below is the only "valid" signal, matching `MasrafyLabeledField`.
///
/// Promoted to `core/widgets/input_controls/` per Principle XXXIII (shared by
/// signup + profile). State is fully external — the caller owns [value].
class MasrafyDobSelector extends StatelessWidget {
  const MasrafyDobSelector({
    super.key,
    required this.label,
    required this.onTap,
    this.value,
    this.hint,
    this.ageVerifiedText,
    this.enabled = true,
  });

  final String label;
  final VoidCallback onTap;
  final DateTime? value;
  final String? hint;
  final String? ageVerifiedText;

  /// When false the field is locked (no tap, lock icon shown) — used where the
  /// value is immutable once set (e.g. birthday post-completion, Principle XXXVII).
  final bool enabled;

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
        Gap(MasrafyFieldMetrics.labelGap),
        GestureDetector(
          onTap: enabled ? onTap : null,
          behavior: HitTestBehavior.opaque,
          child: Container(
            height: MasrafyFieldMetrics.height,
            padding: EdgeInsetsDirectional.symmetric(
              horizontal: MasrafyFieldMetrics.horizontalPadding,
            ),
            decoration: BoxDecoration(
              color: enabled ? Colors.transparent : colors.fill.quaternary,
              border: Border.all(
                color: enabled ? colors.border.field : colors.border.main,
                width: MasrafyFieldMetrics.borderWidth,
              ),
              borderRadius:
                  BorderRadius.circular(MasrafyFieldMetrics.radius),
            ),
            child: Row(
              children: [
                Expanded(
                  child: Text(
                    filled ? DateFormat.yMMMMd(locale).format(v) : (hint ?? ''),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: text.body.copyWith(
                      color: filled
                          ? colors.text.heading
                          : colors.text.tertiary,
                    ),
                  ),
                ),
                Gap(8.w),
                Icon(
                  enabled ? Icons.calendar_today_rounded : Icons.lock_outline_rounded,
                  size: 20.r,
                  color: enabled ? colors.icon.main : colors.text.tertiary,
                ),
              ],
            ),
          ),
        ),
        if (ageVerifiedText != null && ageVerifiedText!.isNotEmpty) ...[
          Gap(4.h),
          Padding(
            padding: EdgeInsetsDirectional.only(start: 2.w),
            child: Text(
              ageVerifiedText!,
              style:
                  text.bodySmall.regular().copyWith(color: colors.success.main),
            ),
          ),
        ],
      ],
    );
  }
}
