import 'package:flutter/material.dart';
import 'package:app/core/theme/colors/masrafy_color_theme.dart';
import 'package:app/core/theme/typography/masrafy_text_theme.dart';

/// Single-thumb value slider (Masrafy questionnaire `4024:2197` — repayment
/// period). Uppercase [label] on the start, the formatted current value on the
/// end, the track, and optional min/max end labels below. The native [Slider]
/// is wrapped in a token-driven [SliderTheme] (azure `secondary` active track +
/// thumb) so it carries no raw hex (Principle VIII / A18). Stateless — [value]
/// and [onChanged] are owned by the caller (a cubit). Shared via
/// `core/widgets/sliders/` per Principle XXXIII.
class MasrafyValueSlider extends StatelessWidget {
  const MasrafyValueSlider({
    super.key,
    required this.label,
    required this.value,
    required this.min,
    required this.max,
    required this.onChanged,
    this.divisions,
    this.valueLabelBuilder,
    this.minLabel,
    this.maxLabel,
  });

  final String label;
  final double value;
  final double min;
  final double max;
  final ValueChanged<double> onChanged;
  final int? divisions;

  /// Formats the current value for the header (e.g. `(v) => '${v.toInt()} y'`).
  final String Function(double value)? valueLabelBuilder;
  final String? minLabel;
  final String? maxLabel;

  @override
  Widget build(BuildContext context) {
    final colors = MasrafyColorTheme.of(context);
    final text = MasrafyTextTheme.of(context);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Expanded(
              child: Text(
                label.toUpperCase(),
                style: text.caption.semiBold().copyWith(
                      color: colors.text.secondary,
                      letterSpacing: 0.5,
                    ),
              ),
            ),
            if (valueLabelBuilder != null)
              Text(
                valueLabelBuilder!(value),
                style: text.bodySmall.semiBold().copyWith(
                      color: colors.text.heading,
                    ),
              ),
          ],
        ),
        SliderTheme(
          data: masrafySliderTheme(colors),
          child: Slider(
            value: value.clamp(min, max),
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

/// Shared token-driven [SliderThemeData] for Masrafy value/range sliders.
SliderThemeData masrafySliderTheme(MasrafyColorTheme colors) {
  return SliderThemeData(
    trackHeight: 4,
    activeTrackColor: colors.secondary.main,
    inactiveTrackColor: colors.border.main,
    thumbColor: colors.secondary.main,
    overlayColor: colors.secondary.main.withValues(alpha: 0.12),
    rangeTrackShape: const RoundedRectRangeSliderTrackShape(),
    thumbShape: const RoundSliderThumbShape(enabledThumbRadius: 9),
    rangeThumbShape: const RoundRangeSliderThumbShape(enabledThumbRadius: 9),
    overlayShape: const RoundSliderOverlayShape(overlayRadius: 18),
    showValueIndicator: ShowValueIndicator.never,
  );
}
