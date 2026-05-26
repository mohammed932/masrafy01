import 'package:flutter/material.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import 'package:app/core/theme/colors/pilot_color_theme.dart';
import 'package:app/core/theme/typography/pilot_text_theme.dart';

/// One option in a [PilotPopupMenu].
class PilotPopupMenuOption<T> {
  const PilotPopupMenuOption({required this.value, required this.label});

  final T value;
  final String label;
}

/// Pilot-themed popup (kebab) menu — a [PopupMenuButton] wrapper that
/// attaches a list of [PilotPopupMenuOption]s to any trigger [child]
/// (kebab dots, sort pill, header action, etc.).
///
/// The opened menu inherits the global `popupMenuTheme` set in `main.dart`
/// (rounded container, soft shadow, themed border). This widget adds the
/// per-item rounded selected pill: `primary.bg` background + `primary.main`
/// text on the option whose value matches [selectedValue].
class PilotPopupMenu<T> extends StatelessWidget {
  const PilotPopupMenu({
    super.key,
    required this.options,
    required this.selectedValue,
    required this.onSelected,
    required this.child,
    this.position = PopupMenuPosition.under,
  });

  final List<PilotPopupMenuOption<T>> options;
  final T? selectedValue;
  final ValueChanged<T> onSelected;
  final Widget child;
  final PopupMenuPosition position;

  @override
  Widget build(BuildContext context) {
    final colors = PilotColorTheme.of(context);
    final texts = PilotTextTheme.of(context);

    return PopupMenuButton<T>(
      tooltip: '',
      padding: EdgeInsets.zero,
      position: position,
      onSelected: onSelected,
      itemBuilder: (_) => [
        for (final option in options)
          PopupMenuItem<T>(
            value: option.value,
            padding: EdgeInsets.zero,
            height: 40.h,
            child: Container(
              height: 40.h,
              alignment: Alignment.centerLeft,
              padding: EdgeInsets.symmetric(horizontal: 16.w),
              decoration: BoxDecoration(
                color: option.value == selectedValue
                    ? colors.primary.bg
                    : Colors.transparent,
                borderRadius: BorderRadius.circular(12.r),
              ),
              child: Text(
                option.label,
                style: texts.body.copyWith(
                  color: option.value == selectedValue
                      ? colors.primary.main
                      : colors.text.primary,
                ),
              ),
            ),
          ),
      ],
      child: child,
    );
  }
}
