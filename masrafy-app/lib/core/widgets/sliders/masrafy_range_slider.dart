import 'package:flutter/material.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import 'package:gap/gap.dart';
import 'package:app/core/theme/colors/masrafy_color_theme.dart';
import 'package:app/core/theme/typography/masrafy_text_theme.dart';
import 'package:app/core/widgets/sliders/masrafy_value_slider.dart' show masrafySliderTheme;

/// Two-thumb range slider (Masrafy questionnaire `4024:2197` — approximate
/// property value, EGP). Uppercase [label], the formatted current range
/// (`start — end`) centered above the track, the [RangeSlider], and optional
/// min/max end labels. Shares the token-driven [masrafySliderTheme] (azure
/// `secondary` active track + thumbs) so it carries no raw hex (Principle VIII
/// / A18). Stateless — [values]/[onChanged] owned by the caller. Shared via
/// `core/widgets/sliders/` per Principle XXXIII.
class MasrafyRangeSlider extends StatelessWidget {
  const MasrafyRangeSlider({
    super.key,
    required this.label,
    required this.values,
    required this.min,
    required this.max,
    required this.onChanged,
    this.divisions,
    this.valueLabelBuilder,
    this.minLabel,
    this.maxLabel,
  });

  final String label;
  final RangeValues values;
  final double min;
  final double max;
  final ValueChanged<RangeValues> onChanged;
  final int? divisions;

  /// Formats a single bound for display (e.g. EGP compact: `(v) => 'EGP 3M'`).
  final String Function(double value)? valueLabelBuilder;
  final String? minLabel;
  final String? maxLabel;

  @override
  Widget build(BuildContext context) {
    final colors = MasrafyColorTheme.of(context);
    final text = MasrafyTextTheme.of(context);
    final builder = valueLabelBuilder;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label.toUpperCase(),
          style: text.caption.semiBold().copyWith(
                color: colors.text.secondary,
                letterSpacing: 0.5,
              ),
        ),
        if (builder != null) ...[
          Gap(8.h),
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Text(
                builder(values.start),
                style: text.bodySmall.semiBold().copyWith(
                      color: colors.text.heading,
                    ),
              ),
              Gap(8.w),
              Text(
                '—',
                style: text.bodySmall.copyWith(color: colors.text.tertiary),
              ),
              Gap(8.w),
              Text(
                builder(values.end),
                style: text.bodySmall.semiBold().copyWith(
                      color: colors.text.heading,
                    ),
              ),
            ],
          ),
        ],
        SliderTheme(
          data: masrafySliderTheme(colors),
          child: RangeSlider(
            values: RangeValues(
              values.start.clamp(min, max),
              values.end.clamp(min, max),
            ),
            min: min,
            max: max,
            divisions: divisions,
            onChanged: onChanged,
          ),
        ),
        if (minLabel != null || maxLabel != null)
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                minLabel ?? '',
                style: text.caption.regular().copyWith(
                      color: colors.text.tertiary,
                    ),
              ),
              Text(
                maxLabel ?? '',
                style: text.caption.regular().copyWith(
                      color: colors.text.tertiary,
                    ),
              ),
            ],
          ),
      ],
    );
  }
}
