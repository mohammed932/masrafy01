import 'package:flutter/material.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import 'package:gap/gap.dart';
import 'package:app/core/theme/colors/masrafy_color_theme.dart';
import 'package:app/core/theme/typography/masrafy_text_theme.dart';
import 'package:app/core/utils/validators.dart';
import 'package:app/core/widgets/bottom_sheets/masrafy_bottom_sheet_base.dart';

/// Pixel-perfect mirror of Figma frame 3173:56171 (Share Test sheet).
///
/// Shows an email input with inline validation. On Share with a valid
/// email, pops the sheet with the trimmed email. On Cancel / barrier
/// dismiss / invalid input, pops with `null`.
///
/// Use [MasrafyShareSheet.show] for the typical `Future<String?>` flow:
///
/// ```dart
/// final email = await MasrafyShareSheet.show(
///   context: context,
/// );
/// if (email != null) cubit.shareWith(email);
/// ```
class MasrafyShareSheet extends StatefulWidget {
  const MasrafyShareSheet({
    super.key,
    this.sheetTitle = 'Share Test',
    this.helperText =
        'Share this exam by entering your classmate’s email.',
    this.hintText = 'davidmuller123@gmail.com',
    this.confirmLabel = 'Share',
    this.cancelLabel = 'Cancel',
  });

  final String sheetTitle;
  final String helperText;
  final String hintText;
  final String confirmLabel;
  final String cancelLabel;

  /// Wraps `showModalBottomSheet` with the project's defaults plus
  /// keyboard-aware bottom padding. Resolves to `null` on cancel /
  /// barrier dismiss / invalid input, the trimmed email otherwise.
  static Future<String?> show({
    required BuildContext context,
    String sheetTitle = 'Share Test',
    String helperText =
        'Share this exam by entering your classmate’s email.',
    String hintText = 'davidmuller123@gmail.com',
    String confirmLabel = 'Share',
    String cancelLabel = 'Cancel',
  }) {
    return MasrafyBottomSheetBase.show<String>(
      context: context,
      sheet: MasrafyShareSheet(
        sheetTitle: sheetTitle,
        helperText: helperText,
        hintText: hintText,
        confirmLabel: confirmLabel,
        cancelLabel: cancelLabel,
      ),
    );
  }

  @override
  State<MasrafyShareSheet> createState() => _MasrafyShareSheetState();
}

class _MasrafyShareSheetState extends State<MasrafyShareSheet> {
  late final TextEditingController _controller;
  late final FocusNode _focusNode;
  bool _isFocused = false;
  String? _validationError;

  @override
  void initState() {
    super.initState();
    _controller = TextEditingController();
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

  void _submit() {
    final email = _controller.text.trim();
    final error = Validators.email(email);
    if (error != null) {
      setState(() => _validationError = error);
      return;
    }
    Navigator.pop(context, email);
  }

  void _onChanged() {
    if (_validationError != null) {
      setState(() => _validationError = null);
    }
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
          validationError: _validationError,
          onChanged: _onChanged,
          helperText: widget.helperText,
          hintText: widget.hintText,
          colors: colors,
          texts: texts,
        ),
        footer: _Footer(
          colors: colors,
          texts: texts,
          cancelLabel: widget.cancelLabel,
          confirmLabel: widget.confirmLabel,
          onCancel: () => Navigator.pop(context, null),
          onConfirm: _submit,
        ),
      ),
    );
  }
}

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

class _Body extends StatelessWidget {
  const _Body({
    required this.controller,
    required this.focusNode,
    required this.isFocused,
    required this.validationError,
    required this.onChanged,
    required this.helperText,
    required this.hintText,
    required this.colors,
    required this.texts,
  });

  final TextEditingController controller;
  final FocusNode focusNode;
  final bool isFocused;
  final String? validationError;
  final VoidCallback onChanged;
  final String helperText;
  final String hintText;
  final MasrafyColorTheme colors;
  final MasrafyTextTheme texts;

  @override
  Widget build(BuildContext context) {
    final hasError = validationError != null;
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
                  color: hasError
                      ? colors.error.main
                      : isFocused
                          ? colors.primary.main
                          : colors.border.main,
                ),
                borderRadius: BorderRadius.circular(8.r),
                boxShadow: isFocused && !hasError
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
                keyboardType: TextInputType.emailAddress,
                style: texts.bodyLarge.copyWith(color: colors.text.primary),
                onChanged: (_) => onChanged(),
                decoration: InputDecoration(
                  isCollapsed: true,
                  border: InputBorder.none,
                  enabledBorder: InputBorder.none,
                  focusedBorder: InputBorder.none,
                  hintText: hintText,
                  hintStyle: texts.bodyLarge.copyWith(
                    color: colors.text.disabled,
                  ),
                ),
              ),
            ),
            if (hasError) ...[
              Gap(8.h),
              Text(
                validationError!,
                style: texts.bodySmall.copyWith(color: colors.error.main),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

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
