import 'package:flutter/material.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'package:gap/gap.dart';
import 'package:app/core/theme/colors/masrafy_color_theme.dart';
import 'package:app/core/theme/typography/masrafy_text_theme.dart';
import 'package:app/core/utils/masrafy_assets.dart';

/// One selectable option for the Masrafy selection surfaces. [value] is a
/// stable, language-neutral identifier; [label] is the already-localized
/// display text. [code] is an optional prefix (e.g. subject code "010")
/// joined with [label] as `"$code - $label"` in the rendered row.
///
/// This is the SINGLE option model app-wide (Principle XXXIII) — the trigger
/// [MasrafySelectField] and this sheet share it.
class MasrafySelectOption<T> {
  const MasrafySelectOption({
    required this.value,
    required this.label,
    this.code = '',
  });

  final T value;
  final String label;
  final String code;
}

/// Single-select bottom sheet matching Figma `3268:44496` and the shared
/// design system. **Instant tap-to-select** (Principle XXXIII): tapping a row
/// applies that value and closes the sheet immediately — there is no
/// Save/Cancel footer. Dismissing (drag-down / back / tap-outside) returns
/// `null` (no change). Pass [nullOptionLabel] to prepend a "clear" row that
/// commits `null`.
///
/// Visual:
/// - Header (76h): centered 44×4 drag handle → 24h gap → centered title
///   (14sp semibold) → 0.75px bottom divider.
/// - Content (px16/py24): optional bordered search input (40r/r8 with
///   16r magnifier SVG) → radio list with 0.75px hairlines. The current
///   value reads as selected (filled radio dot) on open.
///
/// Each row label renders as `"$code - $label"` when [MasrafySelectOption.code]
/// is non-empty, otherwise just [MasrafySelectOption.label].
Future<T?> showMasrafySingleSelectSheet<T>({
  required BuildContext context,
  required String title,
  required List<MasrafySelectOption<T>> options,
  required T? initialValue,
  bool showSearch = false,
  String searchHint = 'Search',
  String? nullOptionLabel,
  String emptyMessage = 'No items available',
  String noMatchesMessage = 'No matches',
}) {
  final theme = MasrafyColorTheme.of(context);
  return showModalBottomSheet<_Result<T>>(
    context: context,
    isScrollControlled: true,
    backgroundColor: Colors.transparent,
    barrierColor: const Color(0x80333333),
    builder: (_) => MasrafyColorThemeProvider(
      theme: theme,
      child: _SingleSelectSheet<T>(
        title: title,
        options: options,
        initialValue: initialValue,
        showSearch: showSearch,
        searchHint: searchHint,
        nullOptionLabel: nullOptionLabel,
        emptyMessage: emptyMessage,
        noMatchesMessage: noMatchesMessage,
      ),
    ),
  ).then((result) => result?.value);
}

/// Wrapper so the sheet can distinguish a dismiss (`null` future) from an
/// explicit tap on a row whose value is `null` (the [nullOptionLabel] clear
/// row). The public helper unwraps to `T?` for the common case.
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
    required this.nullOptionLabel,
    required this.emptyMessage,
    required this.noMatchesMessage,
  });

  final String title;
  final List<MasrafySelectOption<T>> options;
  final T? initialValue;
  final bool showSearch;
  final String searchHint;
  final String? nullOptionLabel;
  final String emptyMessage;
  final String noMatchesMessage;

  @override
  State<_SingleSelectSheet<T>> createState() => _SingleSelectSheetState<T>();
}

class _SingleSelectSheetState<T> extends State<_SingleSelectSheet<T>> {
  final _searchCtrl = TextEditingController();
  String _query = '';

  @override
  void initState() {
    super.initState();
    _searchCtrl.addListener(() {
      setState(() => _query = _searchCtrl.text.trim().toLowerCase());
    });
  }

  @override
  void dispose() {
    _searchCtrl.dispose();
    super.dispose();
  }

  List<MasrafySelectOption<T>> get _filtered {
    if (_query.isEmpty) return widget.options;
    return widget.options
        .where(
          (o) =>
              o.label.toLowerCase().contains(_query) ||
              o.code.toLowerCase().contains(_query),
        )
        .toList();
  }

  void _commit(T? value) => Navigator.of(context).pop(_Result<T>(value));

  @override
  Widget build(BuildContext context) {
    final colors = MasrafyColorTheme.of(context);
    final texts = MasrafyTextTheme.of(context);
    final mediaQuery = MediaQuery.of(context);

    final rows = _filtered;
    final hasNullRow = widget.nullOptionLabel != null;
    final showEmpty = !hasNullRow && rows.isEmpty;
    final totalCount = rows.length + (hasNullRow ? 1 : 0);
    final emptyMessage = widget.options.isEmpty
        ? widget.emptyMessage
        : widget.noMatchesMessage;

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
          // mainAxisSize.min + a SINGLE Flexible around the list = hug the
          // content when short, cap + scroll when long. A second nested
          // Flexible defeats the hug and inflates the sheet toward maxHeight.
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              _Header(title: widget.title),
              if (widget.showSearch)
                Padding(
                  padding: EdgeInsets.fromLTRB(16.w, 16.h, 16.w, 0),
                  child: _SearchField(
                    controller: _searchCtrl,
                    hint: widget.searchHint,
                  ),
                ),
              if (showEmpty)
                Padding(
                  padding:
                      EdgeInsets.symmetric(horizontal: 16.w, vertical: 32.h),
                  child: Text(
                    emptyMessage,
                    textAlign: TextAlign.center,
                    style: texts.body.regular().copyWith(
                      color: colors.text.secondary,
                    ),
                  ),
                )
              else
                Flexible(
                  child: ListView.separated(
                    shrinkWrap: true,
                    padding:
                        EdgeInsets.symmetric(horizontal: 16.w, vertical: 16.h),
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
                          label: widget.nullOptionLabel!,
                          isSelected: widget.initialValue == null,
                          onTap: () => _commit(null),
                        );
                      }
                      final option = rows[hasNullRow ? i - 1 : i];
                      return _OptionRow<T>(
                        option: option,
                        isSelected: widget.initialValue != null &&
                            option.value == widget.initialValue,
                        onTap: () => _commit(option.value),
                      );
                    },
                  ),
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
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Gap(8.h),
        Container(
          width: 44.w,
          height: 4.h,
          decoration: BoxDecoration(
            color: colors.border.main,
            borderRadius: BorderRadius.circular(4.r),
          ),
        ),
        Gap(20.h),
        Padding(
          padding: EdgeInsetsDirectional.symmetric(horizontal: 20.w),
          child: Text(
            title,
            textAlign: TextAlign.center,
            style: texts.body.semiBold().copyWith(
              color: colors.text.heading,
              height: 1.25,
            ),
          ),
        ),
        Gap(16.h),
        SizedBox(
          height: 0.75,
          width: double.infinity,
          child: ColoredBox(color: colors.border.main),
        ),
      ],
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
                  color: colors.text.placeholder,
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
    required MasrafySelectOption<T> this.option,
    required this.isSelected,
    required this.onTap,
  }) : nullLabel = null;

  const _OptionRow.nullValue({
    required String label,
    required this.isSelected,
    required this.onTap,
  }) : option = null,
       nullLabel = label;

  final MasrafySelectOption<T>? option;
  final String? nullLabel;
  final bool isSelected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = MasrafyColorTheme.of(context);
    final texts = MasrafyTextTheme.of(context);

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
    final colors = MasrafyColorTheme.of(context);
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
