import 'package:flutter/material.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import 'package:gap/gap.dart';
import 'package:app/core/theme/colors/masrafy_color_theme.dart';
import 'package:app/core/theme/typography/masrafy_text_theme.dart';
import 'package:app/core/widgets/bottom_sheets/masrafy_bottom_sheet_base.dart';

/// Pixel-perfect mirror of Figma frame 3173:56082 (Rename Test sheet).
///
/// Shows a single text field with a current value. On Save, pops the
/// sheet with the trimmed input via `Navigator.pop(context, name)`. On
/// Cancel / barrier dismiss, pops with `null`. Empty input also pops
/// with `null` (treated as a no-op cancel).
///
/// Use [MasrafyRenameSheet.show] for the typical `Future<String?>` flow:
///
/// ```dart
/// final newName = await MasrafyRenameSheet.show(
///   context: context,
///   currentName: test.name,
/// );
/// if (newName != null) cubit.rename(test.id, newName);
/// ```
class MasrafyRenameSheet extends StatefulWidget {
  const MasrafyRenameSheet({
    super.key,
    required this.currentName,
    this.sheetTitle = 'Rename Test',
    this.helperText =
        'Choose a clear, distinct name so you can find it easily '
        'later, only the name will change.',
    this.confirmLabel = 'Rename',
    this.cancelLabel = 'Cancel',
  });

  final String currentName;
  final String sheetTitle;
  final String helperText;
  final String confirmLabel;
  final String cancelLabel;

  /// Wraps `showModalBottomSheet` with the project's defaults plus
  /// keyboard-aware bottom padding. Resolves to `null` on cancel /
  /// barrier dismiss / empty input, the trimmed name otherwise.
  static Future<String?> show({
    required BuildContext context,
    required String currentName,
    String sheetTitle = 'Rename Test',
    String helperText =
        'Choose a clear, distinct name so you can find it easily '
        'later, only the name will change.',
    String confirmLabel = 'Rename',
    String cancelLabel = 'Cancel',
  }) {
    return MasrafyBottomSheetBase.show<String>(
      context: context,
      sheet: MasrafyRenameSheet(
        currentName: currentName,
        sheetTitle: sheetTitle,
        helperText: helperText,
        confirmLabel: confirmLabel,
        cancelLabel: cancelLabel,
      ),
    );
  }

  @override
  State<MasrafyRenameSheet> createState() => _MasrafyRenameSheetState();
}

class _MasrafyRenameSheetState extends State<MasrafyRenameSheet> {
  late final TextEditingController _controller;
  late final FocusNode _focusNode;
  bool _isFocused = false;

  @override
  void initState() {
    super.initState();
    _controller = TextEditingController(text: widget.currentName);
    _focusNode = FocusNode()
      ..addListener(() {
        if (mounted && _isFocused != _focusNode.hasFocus) {
          setState(() => _isFocused = _focusNode.hasFocus);
        }
      });
  }

  @override
  void dispose() {
    _controller.dispose();
    _focusNode.dispose();
    super.dispose();
  }

  void _handleConfirm() {
    final newName = _controller.text.trim();
    Navigator.pop(context, newName.isEmpty ? null : newName);
  }

  @override
  Widget build(BuildContext context) {
    final colors = MasrafyColorTheme.of(context);
    final texts = MasrafyTextTheme.of(context);
    return Padding(
      padding: EdgeInsets.only(bottom: MediaQuery.viewInsetsOf(context).bottom),
      child: MasrafyBottomSheetShell(
        showDragHandle: false,
        header: _Header(title: widget.sheetTitle, colors: colors, texts: texts),
        content: _Body(
          controller: _controller,
          focusNode: _focusNode,
          isFocused: _isFocused,
          helperText: widget.helperText,
          colors: colors,
          texts: texts,
        ),
        footer: _Footer(
          colors: colors,
          texts: texts,
          cancelLabel: widget.cancelLabel,
          confirmLabel: widget.confirmLabel,
          onCancel: () => Navigator.pop(context, null),
          onConfirm: _handleConfirm,
        ),
      ),
    );
  }
}

/// 76h fixed header — handle (44×4 _kG03) at top:8, gap 24, then
/// the sheet title in Inter SemiBold 14, with a 0.75 _kG03 divider at
/// the bottom edge. Mirrors Figma node I3173:56089.
class _Header extends StatelessWidget {
  const _Header({
    required this.title,
    required this.colors,
    required this.texts,
  });

  final String title;
  final MasrafyColorTheme colors;
  final MasrafyTextTheme texts;

  @override
  Widget build(BuildContext context) {
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
                    color: colors.border.secondary,
                    borderRadius: BorderRadius.circular(4.r),
                  ),
                ),
                Gap(24.h),
                Text(
                  title,
                  style: texts.body.semiBold().copyWith(
                        color: colors.text.primary,
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
              child: ColoredBox(color: colors.border.secondary),
            ),
          ),
        ],
      ),
    );
  }
}

/// Helper copy + Input field. Mirrors Figma 3173:56084 (16h/24v outer
/// padding + 10 inner inset + 16 stack gap).
class _Body extends StatelessWidget {
  const _Body({
    required this.controller,
    required this.focusNode,
    required this.isFocused,
    required this.helperText,
    required this.colors,
    required this.texts,
  });

  final TextEditingController controller;
  final FocusNode focusNode;
  final bool isFocused;
  final String helperText;
  final MasrafyColorTheme colors;
  final MasrafyTextTheme texts;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.fromLTRB(16.w, 24.h, 16.w, 24.h),
      child: Padding(
        padding: EdgeInsets.all(10.r),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              helperText,
              style: texts.body.copyWith(color: colors.text.primary),
            ),
            Gap(16.h),
            Container(
              height: 40.h,
              decoration: BoxDecoration(
                color: colors.bg.container,
                border: Border.all(
                  color: isFocused
                      ? colors.primary.main
                      : colors.border.main,
                ),
                borderRadius: BorderRadius.circular(8.r),
                boxShadow: isFocused
                    ? [
                        const BoxShadow(
                          color: Color(0x1A0591FF),
                          spreadRadius: 2,
                        ),
                      ]
                    : null,
              ),
              padding: EdgeInsets.symmetric(horizontal: 11.w),
              alignment: Alignment.center,
              child: TextField(
                controller: controller,
                focusNode: focusNode,
                autofocus: true,
                maxLength: 100,
                style: texts.bodyLarge.copyWith(color: colors.text.primary),
                decoration: const InputDecoration(
                  isCollapsed: true,
                  border: InputBorder.none,
                  enabledBorder: InputBorder.none,
                  focusedBorder: InputBorder.none,
                  counterText: '',
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// Footer with two flex-1 buttons abutting (no inter-button gap).
/// Cancel = text-only, Confirm = primary.main fill. Mirrors 3173:56091.
class _Footer extends StatelessWidget {
  const _Footer({
    required this.colors,
    required this.texts,
    required this.cancelLabel,
    required this.confirmLabel,
    required this.onCancel,
    required this.onConfirm,
  });

  final MasrafyColorTheme colors;
  final MasrafyTextTheme texts;
  final String cancelLabel;
  final String confirmLabel;
  final VoidCallback onCancel;
  final VoidCallback onConfirm;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        border: Border(top: BorderSide(color: colors.border.secondary, width: 0.75)),
      ),
      padding: EdgeInsets.symmetric(horizontal: 24.w, vertical: 22.h),
      child: Row(
        children: [
          Expanded(
            child: GestureDetector(
              behavior: HitTestBehavior.opaque,
              onTap: onCancel,
              child: Container(
                height: 40.h,
                alignment: Alignment.center,
                padding: EdgeInsets.symmetric(horizontal: 15.w),
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(24.r),
                ),
                child: Text(
                  cancelLabel,
                  style: texts.bodyLarge.copyWith(color: colors.text.primary),
                ),
              ),
            ),
          ),
          Expanded(
            child: GestureDetector(
              behavior: HitTestBehavior.opaque,
              onTap: onConfirm,
              child: Container(
                height: 40.h,
                alignment: Alignment.center,
                padding: EdgeInsets.symmetric(horizontal: 15.w),
                decoration: BoxDecoration(
                  color: colors.primary.main,
                  borderRadius: BorderRadius.circular(24.r),
                ),
                child: Text(
                  confirmLabel,
                  style: texts.bodyLarge
                      .copyWith(color: colors.text.lightSolid),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
