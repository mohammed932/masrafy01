import 'package:flutter/material.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'package:gap/gap.dart';
import 'package:app/core/theme/colors/pilot_color_theme.dart';
import 'package:app/core/theme/typography/pilot_text_theme.dart';
import 'package:app/core/utils/pilot_assets.dart';
import 'package:app/core/widgets/buttons/pilot_primary_button.dart';

/// Single-select bottom sheet matching Figma `3268:44496` and the shared
/// design system. Returns the chosen value when the user taps **Save**;
/// returns `null` when they tap **Cancel** or dismiss the sheet.
///
/// Visual:
/// - Header (76h): centered 44×4 `#DEDEDE` drag handle → 24h gap →
///   centered title (14sp semibold) → 0.75px `#DEDEDE` bottom divider.
/// - Content (px16/py24): optional bordered search input (40r/r8 with
///   16r magnifier SVG) → radio list with 0.75px `#DEDEDE` hairlines.
/// - Footer (px24/py22, top 0.75px `#DEDEDE`): text [cancelLabel] +
///   primary [applyLabel] (filled r24 from `PilotPrimaryButton`).
///
/// Each row label renders as `"$code - $label"` when [PilotSelectOption.code]
/// is non-empty, otherwise just [PilotSelectOption.label]. Pass
/// [nullOptionLabel] to prepend a "clear" row that returns `null` when
/// committed.
Future<T?> showPilotSingleSelectSheet<T>({
  required BuildContext context,
  required String title,
  required List<PilotSelectOption<T>> options,
  required T? initialValue,
  bool showSearch = false,
  String searchHint = 'Search',
  String cancelLabel = 'Cancel',
  String applyLabel = 'Save',
  String? nullOptionLabel,
  String emptyMessage = 'No items available',
  String noMatchesMessage = 'No matches',
}) {
  final theme = PilotColorTheme.of(context);
  return showModalBottomSheet<_Result<T>>(
    context: context,
    isScrollControlled: true,
    backgroundColor: Colors.transparent,
    barrierColor: const Color(0x80333333),
    builder: (_) => PilotColorThemeProvider(
      theme: theme,
      child: _SingleSelectSheet<T>(
        title: title,
        options: options,
        initialValue: initialValue,
        showSearch: showSearch,
        searchHint: searchHint,
        cancelLabel: cancelLabel,
        applyLabel: applyLabel,
        nullOptionLabel: nullOptionLabel,
        emptyMessage: emptyMessage,
        noMatchesMessage: noMatchesMessage,
      ),
    ),
  ).then((result) => result?.value);
}

class PilotSelectOption<T> {
  const PilotSelectOption({
    required this.value,
    required this.label,
    this.code = '',
  });

  final T value;
  final String label;

  /// Optional prefix code (e.g. subject code "010"). Joined with [label]
  /// as `"$code - $label"` in the rendered row when non-empty.
  final String code;
}

/// Wrapper so the sheet can distinguish a Cancel/dismiss (`null` future)
/// from an explicit Save of `null` (used when [nullOptionLabel] is set).
class _Result<T> {
  const _Result(this.value);
  final T? value;
}

class _SingleSelectSheet<T> extends StatefulWidget {
  const _SingleSelectSheet({
    required this.title,
    required this.options,
    required this.initialValue,
    required this.showSearch,
    required this.searchHint,
    required this.cancelLabel,
    required this.applyLabel,
    required this.nullOptionLabel,
    required this.emptyMessage,
    required this.noMatchesMessage,
  });

  final String title;
  final List<PilotSelectOption<T>> options;
  final T? initialValue;
  final bool showSearch;
  final String searchHint;
  final String cancelLabel;
  final String applyLabel;
  final String? nullOptionLabel;
  final String emptyMessage;
  final String noMatchesMessage;

  @override
  State<_SingleSelectSheet<T>> createState() => _SingleSelectSheetState<T>();
}

class _SingleSelectSheetState<T> extends State<_SingleSelectSheet<T>> {
  late T? _selected;
  final _searchCtrl = TextEditingController();
  String _query = '';

  @override
  void initState() {
    super.initState();
    _selected = widget.initialValue;
    _searchCtrl.addListener(() {
      setState(() => _query = _searchCtrl.text.trim().toLowerCase());
    });
  }

  @override
  void dispose() {
    _searchCtrl.dispose();
    super.dispose();
  }

  List<PilotSelectOption<T>> get _filtered {
    if (_query.isEmpty) return widget.options;
    return widget.options
        .where(
          (o) =>
              o.label.toLowerCase().contains(_query) ||
              o.code.toLowerCase().contains(_query),
        )
        .toList();
  }

  @override
  Widget build(BuildContext context) {
    final colors = PilotColorTheme.of(context);
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
                  nullOptionLabel: widget.nullOptionLabel,
                  onSelect: (value) => setState(() => _selected = value),
                  emptyMessage: widget.options.isEmpty
                      ? widget.emptyMessage
                      : widget.noMatchesMessage,
                ),
              ),
              _Footer(
                cancelLabel: widget.cancelLabel,
                applyLabel: widget.applyLabel,
                onCancel: () => Navigator.of(context).pop(),
                onSave: () => Navigator.of(context).pop(_Result<T>(_selected)),
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
    final texts = PilotTextTheme.of(context);
    final colors = PilotColorTheme.of(context);
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
    required this.nullOptionLabel,
    required this.onSelect,
    required this.emptyMessage,
  });

  final bool showSearch;
  final TextEditingController searchCtrl;
  final String searchHint;
  final List<PilotSelectOption<T>> rows;
  final T? selected;
  final String? nullOptionLabel;
  final void Function(T? value) onSelect;
  final String emptyMessage;

  @override
  Widget build(BuildContext context) {
    final colors = PilotColorTheme.of(context);
    final texts = PilotTextTheme.of(context);
    final hasNullRow = nullOptionLabel != null;
    final showEmpty = !hasNullRow && rows.isEmpty;
    final totalCount = rows.length + (hasNullRow ? 1 : 0);

    return Padding(
      padding: EdgeInsets.symmetric(horizontal: 16.w, vertical: 24.h),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        mainAxisSize: MainAxisSize.min,
        children: [
          if (showSearch) ...[
            _SearchField(controller: searchCtrl, hint: searchHint),
            Gap(24.h),
          ],
          Flexible(
            child: showEmpty
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
                    shrinkWrap: true,
                    padding: EdgeInsets.all(10.r),
                    itemCount: totalCount,
                    separatorBuilder: (_, __) => Padding(
                      padding: EdgeInsets.symmetric(vertical: 16.h),
                      child: SizedBox(
                        height: 0.75,
                        child: ColoredBox(color: colors.border.main),
                      ),
                    ),
                    itemBuilder: (_, i) {
                      if (hasNullRow && i == 0) {
                        return _OptionRow<T>.nullValue(
                          label: nullOptionLabel!,
                          isSelected: selected == null,
                          onTap: () => onSelect(null),
                        );
                      }
                      final option = rows[hasNullRow ? i - 1 : i];
                      return _OptionRow<T>(
                        option: option,
                        isSelected:
                            selected != null && option.value == selected,
                        onTap: () => onSelect(option.value),
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
    final colors = PilotColorTheme.of(context);
    final texts = PilotTextTheme.of(context);

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
            PilotAssets.kNotifSearch,
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
    required PilotSelectOption<T> this.option,
    required this.isSelected,
    required this.onTap,
  }) : nullLabel = null;

  const _OptionRow.nullValue({
    required String label,
    required this.isSelected,
    required this.onTap,
  }) : option = null,
       nullLabel = label;

  final PilotSelectOption<T>? option;
  final String? nullLabel;
  final bool isSelected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = PilotColorTheme.of(context);
    final texts = PilotTextTheme.of(context);

    final String label;
    if (option != null) {
      label = option!.code.isNotEmpty
          ? '${option!.code} - ${option!.label}'
          : option!.label;
    } else {
      label = nullLabel!;
    }

    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTap: onTap,
      child: Padding(
        padding: EdgeInsets.symmetric(vertical: 3.h),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.center,
          children: [
            _RadioDot(isSelected: isSelected),
            Gap(8.w),
            Expanded(
              child: Text(
                label,
                style: texts.body.regular().copyWith(
                  color: colors.text.heading,
                ),
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

class _RadioDot extends StatelessWidget {
  const _RadioDot({required this.isSelected});

  final bool isSelected;

  @override
  Widget build(BuildContext context) {
    final colors = PilotColorTheme.of(context);
    return Container(
      width: 16.r,
      height: 16.r,
      alignment: Alignment.center,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        border: Border.all(
          color: isSelected ? colors.primary.main : colors.border.main,
          width: isSelected ? 1.5 : 1,
        ),
      ),
      child: isSelected
          ? Container(
              width: 8.r,
              height: 8.r,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: colors.primary.main,
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
    final colors = PilotColorTheme.of(context);
    final texts = PilotTextTheme.of(context);
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
            child: PilotPrimaryButton(label: applyLabel, onPressed: onSave),
          ),
        ],
      ),
    );
  }
}
