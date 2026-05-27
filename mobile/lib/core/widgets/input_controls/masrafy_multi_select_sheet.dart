import 'package:flutter/material.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'package:gap/gap.dart';
import 'package:app/core/theme/colors/masrafy_color_theme.dart';
import 'package:app/core/theme/typography/masrafy_text_theme.dart';
import 'package:app/core/utils/masrafy_assets.dart';
import 'package:app/core/widgets/buttons/masrafy_primary_button.dart';

/// Shared multi-select bottom sheet (Figma `3391:127892`). Returns the
/// selected list when the user taps the apply button (Save by default),
/// `null` when they cancel or dismiss the sheet.
///
/// Visual:
/// - Header (76h): centered 44×4 `#DEDEDE` drag handle → 24h gap →
///   centered title (14sp semibold) → 0.75px `#DEDEDE` bottom divider.
/// - Content (px16/py24, gap 24h): optional bordered search input with
///   16r magnifier SVG, then a checkbox list with thin `#DEDEDE`
///   separators between rows.
/// - Footer (px24/py22, top 0.75px `#DEDEDE`): text [cancelLabel] +
///   primary [applyLabel] (filled r24 from `MasrafyPrimaryButton`).
///
/// Each row label renders as `"$code - $label"` when [MasrafyMultiSelectOption.code]
/// is non-empty, otherwise just [MasrafyMultiSelectOption.label]. Locked
/// options render at 25% opacity and ignore taps (mirrors Angular
/// `plan-form.component.ts#isExistingSubject`).
Future<List<T>?> showMasrafyMultiSelectSheet<T>({
  required BuildContext context,
  required String title,
  required List<MasrafyMultiSelectOption<T>> options,
  required List<T> initialValues,
  bool showSearch = false,
  String searchHint = 'Search',
  String cancelLabel = 'Cancel',
  String applyLabel = 'Save',
  String emptyMessage = 'No items available',
  String noMatchesMessage = 'No matches',
}) {
  final theme = MasrafyColorTheme.of(context);
  return showModalBottomSheet<List<T>>(
    context: context,
    isScrollControlled: true,
    backgroundColor: Colors.transparent,
    barrierColor: const Color(0x80333333),
    builder: (_) => MasrafyColorThemeProvider(
      theme: theme,
      child: _MultiSelectSheet<T>(
        title: title,
        options: options,
        initialValues: initialValues,
        showSearch: showSearch,
        searchHint: searchHint,
        cancelLabel: cancelLabel,
        applyLabel: applyLabel,
        emptyMessage: emptyMessage,
        noMatchesMessage: noMatchesMessage,
      ),
    ),
  );
}

class MasrafyMultiSelectOption<T> {
  const MasrafyMultiSelectOption({
    required this.value,
    required this.label,
    this.code = '',
    this.isLocked = false,
    this.leadingIcon,
  });

  final T value;
  final String label;

  /// Optional prefix (e.g. subject code "010"). Joined with [label] as
  /// `"$code - $label"` in the rendered row.
  final String code;

  /// When `true`, the row is rendered at 25% opacity and tapping it is a
  /// no-op. Used for items already saved on a plan that can't be removed.
  final bool isLocked;

  final Widget? leadingIcon;
}

class _MultiSelectSheet<T> extends StatefulWidget {
  const _MultiSelectSheet({
    required this.title,
    required this.options,
    required this.initialValues,
    required this.showSearch,
    required this.searchHint,
    required this.cancelLabel,
    required this.applyLabel,
    required this.emptyMessage,
    required this.noMatchesMessage,
  });

  final String title;
  final List<MasrafyMultiSelectOption<T>> options;
  final List<T> initialValues;
  final bool showSearch;
  final String searchHint;
  final String cancelLabel;
  final String applyLabel;
  final String emptyMessage;
  final String noMatchesMessage;

  @override
  State<_MultiSelectSheet<T>> createState() => _MultiSelectSheetState<T>();
}

class _MultiSelectSheetState<T> extends State<_MultiSelectSheet<T>> {
  late final Set<T> _selected;
  final _searchCtrl = TextEditingController();
  String _query = '';

  @override
  void initState() {
    super.initState();
    _selected = Set<T>.from(widget.initialValues);
    _searchCtrl.addListener(() {
      setState(() => _query = _searchCtrl.text.trim().toLowerCase());
    });
  }

  @override
  void dispose() {
    _searchCtrl.dispose();
    super.dispose();
  }

  List<MasrafyMultiSelectOption<T>> get _filtered {
    if (_query.isEmpty) return widget.options;
    return widget.options
        .where(
          (o) =>
              o.label.toLowerCase().contains(_query) ||
              o.code.toLowerCase().contains(_query),
        )
        .toList();
  }

  void _toggle(MasrafyMultiSelectOption<T> option) {
    if (option.isLocked) return;
    setState(() {
      if (_selected.contains(option.value)) {
        _selected.remove(option.value);
      } else {
        _selected.add(option.value);
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    final colors = MasrafyColorTheme.of(context);
    final mediaQuery = MediaQuery.of(context);

    return AnimatedPadding(
      duration: const Duration(milliseconds: 150),
      padding: EdgeInsets.only(bottom: mediaQuery.viewInsets.bottom),
      child: Container(
        constraints: BoxConstraints(maxHeight: mediaQuery.size.height * 0.85),
        decoration: BoxDecoration(
          color: colors.bg.container,
          borderRadius: BorderRadius.vertical(top: Radius.circular(24.r)),
        ),
        child: SafeArea(
          top: false,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              _Header(title: widget.title),
              Flexible(
                child: _Content<T>(
                  showSearch: widget.showSearch,
                  searchCtrl: _searchCtrl,
                  searchHint: widget.searchHint,
                  rows: _filtered,
                  selected: _selected,
                  onToggle: _toggle,
                  emptyMessage: widget.options.isEmpty
                      ? widget.emptyMessage
                      : widget.noMatchesMessage,
                ),
              ),
              _Footer(
                cancelLabel: widget.cancelLabel,
                applyLabel: widget.applyLabel,
                onCancel: () => Navigator.of(context).pop(),
                onSave: () => Navigator.of(context).pop(_selected.toList()),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _Header extends StatelessWidget {
  const _Header({required this.title});

  final String title;

  @override
  Widget build(BuildContext context) {
    final texts = MasrafyTextTheme.of(context);
    final colors = MasrafyColorTheme.of(context);
    return SizedBox(
      height: 76.h,
      child: Stack(
        children: [
          Positioned(
            top: 8.h,
            left: 0,
            right: 0,
            child: Column(
              children: [
                Container(
                  width: 44.w,
                  height: 4.h,
                  decoration: BoxDecoration(
                    color: colors.border.main,
                    borderRadius: BorderRadius.circular(4.r),
                  ),
                ),
                Gap(24.h),
                Text(
                  title,
                  style: texts.body.semiBold().copyWith(
                    color: colors.text.heading,
                    height: 1.0,
                  ),
                ),
              ],
            ),
          ),
          Positioned(
            left: 0,
            right: 0,
            bottom: 0,
            child: SizedBox(
              height: 0.75,
              child: ColoredBox(color: colors.border.main),
            ),
          ),
        ],
      ),
    );
  }
}

class _Content<T> extends StatelessWidget {
  const _Content({
    required this.showSearch,
    required this.searchCtrl,
    required this.searchHint,
    required this.rows,
    required this.selected,
    required this.onToggle,
    required this.emptyMessage,
  });

  final bool showSearch;
  final TextEditingController searchCtrl;
  final String searchHint;
  final List<MasrafyMultiSelectOption<T>> rows;
  final Set<T> selected;
  final void Function(MasrafyMultiSelectOption<T>) onToggle;
  final String emptyMessage;

  @override
  Widget build(BuildContext context) {
    final colors = MasrafyColorTheme.of(context);
    final texts = MasrafyTextTheme.of(context);

    // Outer container px-16 py-24, gap-24 between search and list
    // (Figma `3391:127893`).
    return Padding(
      padding: EdgeInsets.fromLTRB(16.w, 24.h, 16.w, 24.h),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        mainAxisSize: MainAxisSize.min,
        children: [
          if (showSearch) ...[
            _SearchField(controller: searchCtrl, hint: searchHint),
            Gap(24.h),
          ],
          Flexible(
            child: rows.isEmpty
                ? Padding(
                    padding: EdgeInsets.symmetric(vertical: 24.h),
                    child: Center(
                      child: Text(
                        emptyMessage,
                        style: texts.body.regular().copyWith(
                          color: colors.text.secondary,
                        ),
                      ),
                    ),
                  )
                : ListView.separated(
                    // List wrapper: p-10 + gap-16 between flex children.
                    // Separator padding is 16+16 (two gap-16 around the
                    // 0.75px hairline) to match Figma `3391:127895` exactly.
                    shrinkWrap: true,
                    padding: EdgeInsets.all(10.r),
                    itemCount: rows.length,
                    separatorBuilder: (_, __) => Padding(
                      padding: EdgeInsets.symmetric(vertical: 16.h),
                      child: SizedBox(
                        height: 0.75,
                        child: ColoredBox(color: colors.border.main),
                      ),
                    ),
                    itemBuilder: (_, i) {
                      final option = rows[i];
                      return _OptionRow<T>(
                        option: option,
                        isSelected: selected.contains(option.value),
                        onTap: () => onToggle(option),
                      );
                    },
                  ),
          ),
        ],
      ),
    );
  }
}

class _SearchField extends StatelessWidget {
  const _SearchField({required this.controller, required this.hint});

  final TextEditingController controller;
  final String hint;

  @override
  Widget build(BuildContext context) {
    final colors = MasrafyColorTheme.of(context);
    final texts = MasrafyTextTheme.of(context);

    return Container(
      height: 40.r,
      padding: EdgeInsets.symmetric(horizontal: 11.w),
      decoration: BoxDecoration(
        color: colors.bg.container,
        border: Border.all(color: colors.border.main),
        borderRadius: BorderRadius.circular(8.r),
      ),
      child: Row(
        children: [
          SvgPicture.asset(
            MasrafyAssets.kNotifSearch,
            width: 16.r,
            height: 16.r,
            colorFilter: ColorFilter.mode(
              colors.text.secondary,
              BlendMode.srcIn,
            ),
          ),
          Gap(4.w),
          Expanded(
            child: TextField(
              controller: controller,
              style: texts.bodyLarge.regular().copyWith(
                color: colors.text.heading,
              ),
              decoration: InputDecoration(
                isDense: true,
                contentPadding: EdgeInsets.zero,
                border: InputBorder.none,
                hintText: hint,
                hintStyle: texts.bodyLarge.regular().copyWith(
                  color: Colors.white.withValues(alpha: 0.25),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _OptionRow<T> extends StatelessWidget {
  const _OptionRow({
    required this.option,
    required this.isSelected,
    required this.onTap,
  });

  final MasrafyMultiSelectOption<T> option;
  final bool isSelected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = MasrafyColorTheme.of(context);
    final texts = MasrafyTextTheme.of(context);
    final label = option.code.isNotEmpty
        ? '${option.code} - ${option.label}'
        : option.label;
    final textColor = option.isLocked
        ? Colors.white.withValues(alpha: 0.25)
        : colors.text.heading;

    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTap: option.isLocked ? null : onTap,
      // Checkbox wrapper py-3 per Figma `I3391:127896;1810:45573`.
      child: Padding(
        padding: EdgeInsets.symmetric(vertical: 3.h),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.center,
          children: [
            _Checkbox(isSelected: isSelected, isLocked: option.isLocked),
            Gap(8.w),
            if (option.leadingIcon != null) ...[option.leadingIcon!, Gap(8.w)],
            Expanded(
              child: Text(
                label,
                style: texts.body.regular().copyWith(color: textColor),
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _Checkbox extends StatelessWidget {
  const _Checkbox({required this.isSelected, required this.isLocked});

  final bool isSelected;
  final bool isLocked;

  @override
  Widget build(BuildContext context) {
    final colors = MasrafyColorTheme.of(context);
    final fill = isSelected
        ? (isLocked
              ? colors.primary.main.withValues(alpha: 0.4)
              : colors.primary.main)
        : Colors.transparent;
    final borderColor = isSelected ? fill : colors.border.main;

    return Container(
      width: 16.r,
      height: 16.r,
      alignment: Alignment.center,
      decoration: BoxDecoration(
        color: fill,
        border: Border.all(color: borderColor),
        borderRadius: BorderRadius.circular(2.r),
      ),
      child: isSelected
          ? SvgPicture.asset(
              MasrafyAssets.kCheck,
              width: 12.r,
              height: 12.r,
              colorFilter: const ColorFilter.mode(
                Colors.white,
                BlendMode.srcIn,
              ),
            )
          : const SizedBox.shrink(),
    );
  }
}

class _Footer extends StatelessWidget {
  const _Footer({
    required this.cancelLabel,
    required this.applyLabel,
    required this.onCancel,
    required this.onSave,
  });

  final String cancelLabel;
  final String applyLabel;
  final VoidCallback onCancel;
  final VoidCallback onSave;

  @override
  Widget build(BuildContext context) {
    final colors = MasrafyColorTheme.of(context);
    final texts = MasrafyTextTheme.of(context);
    return Container(
      padding: EdgeInsets.symmetric(horizontal: 24.w, vertical: 22.h),
      decoration: BoxDecoration(
        color: colors.bg.container,
        border: Border(top: BorderSide(color: colors.border.main, width: 0.75)),
      ),
      child: Row(
        children: [
          Expanded(
            child: GestureDetector(
              behavior: HitTestBehavior.opaque,
              onTap: onCancel,
              child: SizedBox(
                height: 40.r,
                child: Center(
                  child: Text(
                    cancelLabel,
                    style: texts.bodyLarge.regular().copyWith(
                      color: colors.text.heading,
                    ),
                  ),
                ),
              ),
            ),
          ),
          Gap(16.w),
          Expanded(
            child: MasrafyPrimaryButton(label: applyLabel, onPressed: onSave),
          ),
        ],
      ),
    );
  }
}
