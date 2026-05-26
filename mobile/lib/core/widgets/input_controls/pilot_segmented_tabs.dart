import 'package:flutter/material.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import 'package:app/core/theme/colors/pilot_color_theme.dart';
import 'package:app/core/theme/typography/pilot_text_theme.dart';

/// Two-or-more-segment toggle pill. Each segment owns its own border + radius
/// so the active segment renders flush against the inactive one with no
/// double-border seam.
///
/// Visual spec (Figma node 3173-91865, Settings → Filter Logic):
/// - 24h tall, 12w/4h padding per segment
/// - Inactive: transparent bg, 1px `border.main` border, `text.tertiary` label
/// - Active:   `primary.main` bg, no border, white label
/// - 8r radius — top-left/bottom-left on the first segment, top-right/bottom-right
///   on the last segment, square edges where segments meet.
/// - Label: 12sp regular line-height 16.
class PilotSegmentedTabs<T> extends StatelessWidget {
  const PilotSegmentedTabs({
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

    return SizedBox(
      height: 24.h,
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: List.generate(options.length, (i) {
          final isSelected = options[i] == selected;
          final isFirst = i == 0;
          final isLast = i == options.length - 1;
          final radius = Radius.circular(8.r);
          final segmentRadius = BorderRadius.only(
            topLeft: isFirst ? radius : Radius.zero,
            bottomLeft: isFirst ? radius : Radius.zero,
            topRight: isLast ? radius : Radius.zero,
            bottomRight: isLast ? radius : Radius.zero,
          );

          return GestureDetector(
            behavior: HitTestBehavior.opaque,
            onTap: () => onChanged(options[i]),
            child: Semantics(
              label: labels[i],
              button: true,
              selected: isSelected,
              child: Container(
                padding: EdgeInsets.symmetric(horizontal: 12.w, vertical: 4.h),
                decoration: BoxDecoration(
                  color: isSelected ? colors.primary.main : Colors.transparent,
                  borderRadius: segmentRadius,
                  border: isSelected
                      ? null
                      : Border.all(color: colors.border.main),
                ),
                alignment: Alignment.center,
                child: Text(
                  labels[i],
                  style: text.bodySmall.regular().copyWith(
                        color: isSelected
                            ? colors.white
                            : colors.text.tertiary,
                        fontSize: 12.sp,
                        height: 16 / 12,
                      ),
                ),
              ),
            ),
          );
        }),
      ),
    );
  }
}
