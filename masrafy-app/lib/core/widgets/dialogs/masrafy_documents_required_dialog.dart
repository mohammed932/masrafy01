import 'package:flutter/material.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import 'package:gap/gap.dart';

import 'package:app/core/theme/colors/masrafy_color_theme.dart';
import 'package:app/core/theme/typography/masrafy_text_theme.dart';
import 'package:app/core/widgets/buttons/masrafy_gradient_button.dart';
import 'package:app/core/widgets/dialogs/masrafy_dialog_base.dart';

/// One item in a [MasrafyDocumentsRequiredDialog] checklist: what it is, and
/// whether it is already on file.
typedef MasrafyRequiredDocument = ({String label, bool uploaded});

/// Warns that a document requirement blocks the action the user just took, and
/// offers to go collect what's missing.
///
/// Wears the app's own language rather than the generic confirm chrome
/// (Principle XXXIII): an amber badge in the header carrying the same
/// `warning` tone the blocked screen uses for pending documents, a per-item
/// checklist so the user learns WHICH piece is missing before leaving the
/// screen they're on, and the brand gradient CTA (azure → indigo) that every
/// other primary action in the app wears. Cancel stays a quiet ghost pill and
/// is weighted half the confirm — declining is a pause, not a destructive act.
///
/// Copy is caller-supplied: `core/widgets/` stays free of feature strings
/// (same contract as `MasrafyConfirmDialog` and `MasrafyPhotoSourceSheet`).
class MasrafyDocumentsRequiredDialog extends MasrafyDialogBase {
  const MasrafyDocumentsRequiredDialog({
    super.key,
    required String title,
    required this.message,
    required this.documents,
    this.cancelLabel = 'Cancel',
    this.confirmLabel = 'Upload',
  }) : _title = title;

  final String _title;
  final String message;

  /// Rendered as a row of chips under the message. Pass an empty list for a
  /// plain warning with no checklist.
  final List<MasrafyRequiredDocument> documents;

  final String cancelLabel;
  final String confirmLabel;

  @override
  String? get title => _title;

  @override
  Widget? buildHeader(BuildContext context) {
    final colors = MasrafyColorTheme.of(context);
    final texts = MasrafyTextTheme.of(context);
    return Row(
      children: [
        Container(
          width: 44.r,
          height: 44.r,
          alignment: Alignment.center,
          decoration: BoxDecoration(
            color: colors.warning.bg,
            border: Border.all(color: colors.warning.border),
            borderRadius: BorderRadius.circular(14.r),
          ),
          child: Icon(
            Icons.badge_outlined,
            size: 22.r,
            color: colors.warning.main,
          ),
        ),
        Gap(14.w),
        Expanded(
          child: Text(
            _title,
            style: texts.heading5.copyWith(color: colors.text.heading),
          ),
        ),
      ],
    );
  }

  @override
  Widget buildContent(BuildContext context) {
    final colors = MasrafyColorTheme.of(context);
    final texts = MasrafyTextTheme.of(context);
    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Gap(4.h),
        Text(
          message,
          style: texts.body.regular().copyWith(
                color: colors.text.secondary,
                height: 1.5,
              ),
        ),
        if (documents.isNotEmpty) ...[
          Gap(18.h),
          Row(
            children: [
              for (final (index, document) in documents.indexed) ...[
                if (index > 0) Gap(10.w),
                Expanded(child: _DocumentChip(document: document)),
              ],
            ],
          ),
        ],
      ],
    );
  }

  @override
  Widget? buildFooter(BuildContext context) {
    return Row(
      children: [
        Expanded(
          child: _GhostButton(
            label: cancelLabel,
            onTap: () => Navigator.of(context).pop(false),
          ),
        ),
        Gap(12.w),
        // 2:1 in favour of the confirm — uploading is the way forward, and the
        // gradient is the app's own "this is the primary action" signal.
        Expanded(
          flex: 2,
          child: MasrafyGradientButton(
            label: confirmLabel,
            height: 48,
            fontSize: 15,
            onPressed: () => Navigator.of(context).pop(true),
          ),
        ),
      ],
    );
  }

  /// Shows the dialog and returns `true` when the user chooses to upload,
  /// `false` when they cancel or dismiss (back gesture / barrier tap).
  static Future<bool> show(
    BuildContext context, {
    required String title,
    required String message,
    List<MasrafyRequiredDocument> documents = const [],
    String cancelLabel = 'Cancel',
    String confirmLabel = 'Upload',
    bool barrierDismissible = true,
  }) async {
    final result = await MasrafyDialogBase.show<bool>(
      context: context,
      barrierDismissible: barrierDismissible,
      dialog: MasrafyDocumentsRequiredDialog(
        title: title,
        message: message,
        documents: documents,
        cancelLabel: cancelLabel,
        confirmLabel: confirmLabel,
      ),
    );
    return result ?? false;
  }
}

/// One checklist chip. The tick-vs-upload icon carries the state on its own —
/// colour alone would leave a colour-blind user reading two identical chips.
class _DocumentChip extends StatelessWidget {
  const _DocumentChip({required this.document});

  final MasrafyRequiredDocument document;

  @override
  Widget build(BuildContext context) {
    final colors = MasrafyColorTheme.of(context);
    final texts = MasrafyTextTheme.of(context);
    final done = document.uploaded;

    return Container(
      padding: EdgeInsetsDirectional.symmetric(horizontal: 12.w, vertical: 11.h),
      decoration: BoxDecoration(
        color: colors.bg.container,
        border: Border.all(
          color: done ? colors.success.border : colors.border.secondary,
        ),
        borderRadius: BorderRadius.circular(14.r),
      ),
      child: Row(
        children: [
          Icon(
            done ? Icons.check_circle_rounded : Icons.file_upload_outlined,
            size: 18.r,
            color: done ? colors.success.main : colors.warning.main,
          ),
          Gap(8.w),
          Flexible(
            child: Text(
              document.label,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: texts.bodySmall.medium().copyWith(
                    color: done ? colors.text.heading : colors.text.secondary,
                  ),
            ),
          ),
        ],
      ),
    );
  }
}

/// Quiet outline pill sized and rounded to sit level with
/// [MasrafyGradientButton] beside it (48h, 15r) rather than the base dialog's
/// 40h/24r pill, which would read as a different button family.
class _GhostButton extends StatelessWidget {
  const _GhostButton({required this.label, required this.onTap});

  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = MasrafyColorTheme.of(context);
    final texts = MasrafyTextTheme.of(context);

    return Material(
      color: Colors.transparent,
      child: InkWell(
        borderRadius: BorderRadius.circular(15.r),
        onTap: onTap,
        child: Container(
          height: 48.h,
          alignment: Alignment.center,
          padding: EdgeInsetsDirectional.symmetric(horizontal: 12.w),
          decoration: BoxDecoration(
            border: Border.all(color: colors.border.main),
            borderRadius: BorderRadius.circular(15.r),
          ),
          child: FittedBox(
            fit: BoxFit.scaleDown,
            child: Text(
              label,
              maxLines: 1,
              style: texts.bodyLarge.medium().copyWith(
                    color: colors.text.heading,
                    fontSize: 15.sp,
                  ),
            ),
          ),
        ),
      ),
    );
  }
}
