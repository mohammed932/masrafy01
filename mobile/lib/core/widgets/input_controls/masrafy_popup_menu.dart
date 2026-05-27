import 'package:flutter/material.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import 'package:app/core/theme/colors/masrafy_color_theme.dart';
import 'package:app/core/theme/typography/masrafy_text_theme.dart';

/// One option in a [MasrafyPopupMenu].
class MasrafyPopupMenuOption<T> {
  const MasrafyPopupMenuOption({required this.value, required this.label});

  final T value;
  final String label;
}

/// Masrafy-themed popup (kebab) menu — a [PopupMenuButton] wrapper that
/// attaches a list of [MasrafyPopupMenuOption]s to any trigger [child]
/// (kebab dots, sort pill, header action, etc.).
///
/// The opened menu inherits the global `popupMenuTheme` set in `main.dart`
/// (rounded container, soft shadow, themed border). This widget adds the
/// per-item rounded selected pill: `primary.bg` background + `primary.main`
/// text on the option whose value matches [selectedValue].
class MasrafyPopupMenu<T> extends StatelessWidget {
  const MasrafyPopupMenu({
    super.key,
    required this.options,
    required this.selectedValue,
    required this.onSelected,
    required this.child,
    this.position = PopupMenuPosition.under,
  });

  final List<MasrafyPopupMenuOption<T>> options;
  final T? selectedValue;
  final ValueChanged<T> onSelected;
  final Widget child;
  final PopupMenuPosition position;

  @override
  Widget build(BuildContext context) {
    final colors = MasrafyColorTheme.of(context);
    final texts = MasrafyTextTheme.of(context);

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
              alignment: AlignmentDirectional.centerStart,
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
