import 'package:flutter/material.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import 'package:gap/gap.dart';
import 'package:app/core/theme/colors/masrafy_color_theme.dart';
import 'package:app/core/theme/typography/masrafy_text_theme.dart';
import 'package:app/core/widgets/bottom_sheets/masrafy_bottom_sheet_base.dart';

/// Pixel-perfect mirror of Figma frame 3173:56133 (Delete Test sheet).
/// Abstract base — concrete subclasses supply the sheet title, body
/// text, and labels; this base owns the 76h header, content area
/// (16h/24v outer + 10 inner padding, 8 gap), and footer with two
/// flex-1 buttons (Cancel = text-only, Confirm = error.main fill).
abstract class MasrafyDeleteConfirmationSheet extends MasrafyBottomSheetBase {
  const MasrafyDeleteConfirmationSheet({super.key});

  /// Sheet header title (e.g. "Delete Test").
  String get sheetTitle;

  /// Inline title at the top of the content body
  /// (e.g. "Are you sure you want to delete Exam?").
  @override
  String? get title => null;

  /// Inline title at the top of the content body.
  String get bodyTitle;

  /// Body copy below the inline title. Subclasses can override
  /// [bodyWidget] instead for richer multi-paragraph layouts.
  String get body;

  /// Optional richer body — when supplied, replaces [body] rendering.
  Widget? get bodyWidget => null;

  VoidCallback get onConfirm;
  String get confirmLabel => 'Yes, Delete';
  String get cancelLabel => 'Cancel';

  // Header chrome is custom (Figma-spec 76h stack) — override the base
  // hook entirely instead of expressing it through the standard
  // drag-handle + title + divider slots.
  @override
  bool get showDragHandle => false; // owned by buildHeader

  @override
  Widget? buildHeader(BuildContext context) {
    final colors = MasrafyColorTheme.of(context);
    final texts = MasrafyTextTheme.of(context);
    return _DeleteSheetHeader(title: sheetTitle, colors: colors, texts: texts);
  }

  @override
  Widget buildContent(BuildContext context) {
    final colors = MasrafyColorTheme.of(context);
    final texts = MasrafyTextTheme.of(context);
    return _DeleteSheetContent(
      title: bodyTitle,
      body: body,
      bodyWidget: bodyWidget,
      colors: colors,
      texts: texts,
    );
  }

  @override
  Widget? buildFooter(BuildContext context) {
    final colors = MasrafyColorTheme.of(context);
    final texts = MasrafyTextTheme.of(context);
    return _DeleteSheetFooter(
      colors: colors,
      texts: texts,
      cancelLabel: cancelLabel,
      confirmLabel: confirmLabel,
      onCancel: () => Navigator.pop(context),
      onConfirm: () {
        onConfirm();
        Navigator.pop(context);
      },
    );
  }
}

class _DeleteSheetHeader extends StatelessWidget {
  const _DeleteSheetHeader({
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

class _DeleteSheetContent extends StatelessWidget {
  const _DeleteSheetContent({
    required this.title,
    required this.body,
    required this.bodyWidget,
    required this.colors,
    required this.texts,
  });

  final String title;
  final String body;
  final Widget? bodyWidget;
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
              title,
              style: texts.bodyLarge.semiBold().copyWith(
                color: colors.text.primary,
              ),
            ),
            Gap(8.h),
            bodyWidget ??
                Text(
                  body,
                  style: texts.body.copyWith(color: colors.text.primary),
                ),
          ],
        ),
      ),
    );
  }
}

class _DeleteSheetFooter extends StatelessWidget {
  const _DeleteSheetFooter({
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
                  color: colors.error.main,
                  borderRadius: BorderRadius.circular(24.r),
                ),
                child: Text(
                  confirmLabel,
                  style: texts.bodyLarge.copyWith(
                    color: colors.text.lightSolid,
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

