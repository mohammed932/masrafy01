import 'package:flutter/material.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import 'package:gap/gap.dart';
import 'package:app/core/theme/colors/masrafy_color_theme.dart';
import 'package:app/core/theme/typography/masrafy_text_theme.dart';
import 'package:app/core/widgets/input_controls/masrafy_single_select_sheet.dart';

export 'package:app/core/widgets/input_controls/masrafy_single_select_sheet.dart'
    show MasrafySelectOption;

/// The single, app-wide value-selection control (Principle XXXIII / A36):
/// a labeled, tappable field that opens the shared **instant tap-to-select**
/// bottom sheet ([showMasrafySingleSelectSheet]) — never an inline / floating
/// / overlay dropdown. The field shows the currently selected option's label
/// (or [hint]) plus a chevron; tapping opens the sheet, and a row tap applies
/// the value via [onSelected] and closes the sheet.
///
/// Two visual densities:
/// - default — the questionnaire chrome (uppercased `caption` label, 44h field,
///   12r border, down chevron).
/// - [dense] — the edit-form chrome, aligned to `MasrafyLabeledField` so selects
///   and text inputs read as one family (uppercase indigo `caption` label, 14r
///   border, `bg.layout` fill, down chevron) used inside edit forms (e.g. profile).
///
/// Long option lists pass [showSearch] `true` (the sheet scrolls natively).
/// Tokens only — no raw hex (Principle VIII / A18); logical insets only (A19).
class MasrafySelectField<T> extends StatelessWidget {
  const MasrafySelectField({
    super.key,
    required this.label,
    required this.options,
    required this.value,
    required this.onSelected,
    this.hint,
    this.sheetTitle,
    this.searchHint,
    this.showSearch = false,
    this.isEnabled = true,
    this.dense = false,
  });

  /// Question / field prompt shown above the field. Uppercased in the default
  /// density; shown as-is in [dense].
  final String label;
  final List<MasrafySelectOption<T>> options;
  final T? value;
  final ValueChanged<T> onSelected;
  final String? hint;

  /// Sheet header title. Defaults to [label] when null.
  final String? sheetTitle;

  /// Search-field placeholder (only used when [showSearch] is true).
  final String? searchHint;
  final bool showSearch;
  final bool isEnabled;
  final bool dense;

  String? get _selectedLabel {
    for (final option in options) {
      if (option.value == value) return option.label;
    }
    return null;
  }

  Future<void> _open(BuildContext context) async {
    final picked = await showMasrafySingleSelectSheet<T>(
      context: context,
      title: sheetTitle ?? label,
      options: options,
      initialValue: value,
      showSearch: showSearch,
      searchHint: searchHint ?? 'Search',
    );
    if (picked != null) onSelected(picked);
  }

  @override
  Widget build(BuildContext context) {
    return dense ? _buildDense(context) : _buildDefault(context);
  }

  Widget _buildDefault(BuildContext context) {
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
        Gap(8.h),
        GestureDetector(
          onTap: isEnabled ? () => _open(context) : null,
          behavior: HitTestBehavior.opaque,
          child: Container(
            height: 44.h,
            padding: EdgeInsetsDirectional.symmetric(horizontal: 14.w),
            decoration: BoxDecoration(
              color:
                  isEnabled ? colors.bg.container : colors.fill.quaternary,
              border: Border.all(color: colors.border.main),
              borderRadius: BorderRadius.circular(12.r),
            ),
            child: Row(
              children: [
                Expanded(
                  child: Text(
                    selectedLabel ?? hint ?? '',
                    maxLines: 1,
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

  Widget _buildDense(BuildContext context) {
    final colors = MasrafyColorTheme.of(context);
    final text = MasrafyTextTheme.of(context);
    final selectedLabel = _selectedLabel;

    return GestureDetector(
      onTap: isEnabled ? () => _open(context) : null,
      behavior: HitTestBehavior.opaque,
      child: Column(
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
          Container(
            padding:
                EdgeInsetsDirectional.symmetric(horizontal: 14.w, vertical: 13.h),
            decoration: BoxDecoration(
              color: isEnabled ? colors.bg.layout : colors.fill.quaternary,
              border: Border.all(color: colors.border.main),
              borderRadius: BorderRadius.circular(14.r),
            ),
            child: Row(
              children: [
                Expanded(
                  child: Text(
                    selectedLabel ?? hint ?? '',
                    maxLines: 1,
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
        ],
      ),
    );
  }
}
