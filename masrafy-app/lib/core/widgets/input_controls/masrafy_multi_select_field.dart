import 'package:flutter/material.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import 'package:gap/gap.dart';
import 'package:app/core/theme/colors/masrafy_color_theme.dart';
import 'package:app/core/theme/typography/masrafy_text_theme.dart';
import 'package:app/core/widgets/input_controls/masrafy_field_metrics.dart';
import 'package:app/core/widgets/input_controls/masrafy_multi_select_sheet.dart';

export 'package:app/core/widgets/input_controls/masrafy_multi_select_sheet.dart'
    show MasrafyMultiSelectOption;

/// The multi-value sibling of [MasrafySelectField] (Principle XXXIII / A36):
/// a labeled, tappable field that opens the shared multi-select bottom sheet
/// ([showMasrafyMultiSelectSheet]) — never an inline / floating / overlay
/// dropdown. The field shows the selected options' labels joined by `, `
/// (or [hint] when none are selected) plus a chevron; tapping opens the sheet,
/// where the user toggles rows and taps Save to apply the new list via
/// [onChanged] (cancel / dismiss leaves the selection unchanged).
///
/// Uses the same default questionnaire chrome as [MasrafySelectField]:
/// uppercased `caption` label, 44h field, borderless 12r plate, down chevron.
/// Tokens only — no raw hex (Principle VIII / A18); logical insets only (A19).
class MasrafyMultiSelectField<T> extends StatelessWidget {
  const MasrafyMultiSelectField({
    super.key,
    required this.label,
    required this.options,
    required this.values,
    required this.onChanged,
    this.hint,
    this.sheetTitle,
    this.searchHint,
    this.applyLabel,
    this.cancelLabel,
    this.emptyMessage,
    this.noMatchesMessage,
    this.showSearch = false,
    this.isEnabled = true,
  });

  /// Question / field prompt shown above the field (uppercased).
  final String label;
  final List<MasrafyMultiSelectOption<T>> options;
  final List<T> values;
  final ValueChanged<List<T>> onChanged;
  final String? hint;

  /// Sheet header title. Defaults to [label] when null.
  final String? sheetTitle;

  /// Localized sheet labels (default to the sheet's English fallbacks). Pass
  /// these for Arabic-first correctness (Principle IV).
  final String? searchHint;
  final String? applyLabel;
  final String? cancelLabel;
  final String? emptyMessage;
  final String? noMatchesMessage;

  final bool showSearch;
  final bool isEnabled;

  /// Comma-joined labels of the currently selected options (in [options] order).
  String? get _selectedLabel {
    final picked = <String>[
      for (final option in options)
        if (values.contains(option.value)) option.label,
    ];
    return picked.isEmpty ? null : picked.join(', ');
  }

  Future<void> _open(BuildContext context) async {
    // Drop any text field's keyboard BEFORE the sheet builds — see the note in
    // MasrafySelectField._open (stale viewInsets pad = double-motion on entry).
    FocusManager.instance.primaryFocus?.unfocus();
    final picked = await showMasrafyMultiSelectSheet<T>(
      context: context,
      title: sheetTitle ?? label,
      options: options,
      initialValues: values,
      showSearch: showSearch,
      searchHint: searchHint ?? 'Search',
      cancelLabel: cancelLabel ?? 'Cancel',
      applyLabel: applyLabel ?? 'Save',
      emptyMessage: emptyMessage ?? 'No items available',
      noMatchesMessage: noMatchesMessage ?? 'No matches',
    );
    if (picked != null) onChanged(picked);
  }

  @override
  Widget build(BuildContext context) {
    final colors = MasrafyColorTheme.of(context);
    final text = MasrafyTextTheme.of(context);
    final selectedLabel = _selectedLabel;

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
        Gap(MasrafyFieldMetrics.labelGap),
        GestureDetector(
          onTap: isEnabled ? () => _open(context) : null,
          behavior: HitTestBehavior.opaque,
          child: Container(
            // Starts at the shared single-line height so an empty multi-select
            // sits level with the selects and inputs around it, and grows only
            // when the selection wraps to a second line.
            constraints: BoxConstraints(minHeight: MasrafyFieldMetrics.height),
            padding: EdgeInsetsDirectional.symmetric(
              horizontal: MasrafyFieldMetrics.horizontalPadding,
              vertical: 8.h,
            ),
            // Same expression as the single-select sibling — the two sit in
            // the same forms and must not read as different controls.
            decoration:
                MasrafyFieldMetrics.decorationFor(colors, enabled: isEnabled),
            child: Row(
              children: [
                Expanded(
                  child: Text(
                    selectedLabel ?? hint ?? '',
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: text.body.copyWith(
                      color: selectedLabel != null
                          ? colors.text.heading
                          : colors.text.placeholder,
                    ),
                  ),
                ),
                Gap(8.w),
                Icon(
                  Icons.keyboard_arrow_down_rounded,
                  size: 22.r,
                  color: colors.icon.main,
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }
}
