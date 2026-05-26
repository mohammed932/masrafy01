import 'package:flutter/material.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import 'package:app/core/theme/colors/pilot_color_theme.dart';
import 'package:app/core/theme/typography/pilot_text_theme.dart';
import 'package:app/core/widgets/bottom_sheets/pilot_bottom_sheet_base.dart';

class PilotSelectOption<T> {
  final T value;
  final String label;
  final String? subtitle;

  const PilotSelectOption({
    required this.value,
    required this.label,
    this.subtitle,
  });
}

class PilotSingleSelectSheet<T> extends PilotBottomSheetBase {
  const PilotSingleSelectSheet({
    super.key,
    required String title,
    required this.options,
    this.selectedValue,
    this.nullOptionLabel,
  }) : _title = title;

  final String _title;
  final List<PilotSelectOption<T>> options;
  final T? selectedValue;

  /// When non-null, a "clear / all" row is prepended with this label.
  /// Tapping it pops with `null`.
  final String? nullOptionLabel;

  @override
  String? get title => _title;

  @override
  double get maxHeightFraction => 0.6;

  @override
  Widget buildContent(BuildContext context) {
    final colors = PilotColorTheme.of(context);
    final texts = PilotTextTheme.of(context);
    final divider = Divider(
      height: 1,
      color: colors.border.secondary,
      indent: 16.w,
      endIndent: 16.w,
    );
    final allOptions = <Widget>[
      if (nullOptionLabel != null)
        _OptionTile<T>(
          label: nullOptionLabel!,
          isSelected: selectedValue == null,
          onTap: () => Navigator.pop(context, null),
          colors: colors,
          texts: texts,
        ),
      ...options.map(
        (opt) => _OptionTile<T>(
          label: opt.label,
          subtitle: opt.subtitle,
          isSelected: opt.value == selectedValue,
          onTap: () => Navigator.pop(context, opt.value),
          colors: colors,
          texts: texts,
        ),
      ),
    ];
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: allOptions
          .expand((tile) => [tile, divider])
          .toList()
        ..removeLast(),
    );
  }
}

class _OptionTile<T> extends StatelessWidget {
  const _OptionTile({
    required this.label,
    required this.isSelected,
    required this.onTap,
    required this.colors,
    required this.texts,
    this.subtitle,
  });

  final String label;
  final String? subtitle;
  final bool isSelected;
  final VoidCallback onTap;
  final PilotColorTheme colors;
  final PilotTextTheme texts;

  @override
  Widget build(BuildContext context) {
    return ListTile(
      title: Text(
        label,
        style: texts.body.copyWith(
          color: isSelected ? colors.primary.main : colors.text.primary,
        ),
      ),
      subtitle: subtitle != null
          ? Text(
              subtitle!,
              style: texts.bodySmall.copyWith(color: colors.text.secondary),
            )
          : null,
      trailing: isSelected
          ? Icon(Icons.check, color: colors.primary.main, size: 20.r)
          : null,
      onTap: onTap,
    );
  }
}
