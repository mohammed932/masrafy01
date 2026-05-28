import 'package:flutter/material.dart';
import 'package:app/core/theme/colors/masrafy_color_theme.dart';
import 'package:app/core/theme/typography/masrafy_text_theme.dart';
import 'package:app/core/widgets/dialogs/masrafy_dialog_base.dart';

/// Shared confirmation dialog matching the Masrafy dark design system.
///
/// — Container chrome: inherited from [MasrafyDialogBase] (`bg.elevated` +
///   `border.main`, radius 20r, 24r inner padding, 32w horizontal inset).
/// — Title: heading5 (16sp/24 bold) `text.heading`.
/// — Message: body (14sp/22) `text.secondary`.
/// — Footer: [MasrafyDialogActions] — Cancel (ghost) + Confirm (primary, or
///   error when [isDestructive]).
///
/// Use [MasrafyConfirmDialog.show] for the typical `Future<bool>` flow:
///
/// ```dart
/// final confirmed = await MasrafyConfirmDialog.show(
///   context,
///   title: 'You have unsaved changes',
///   message: 'Leave anyway? Your edits will be lost.',
///   confirmLabel: 'Leave',
///   isDestructive: true,
/// );
/// ```
class MasrafyConfirmDialog extends MasrafyDialogBase {
  const MasrafyConfirmDialog({
    super.key,
    required String title,
    required this.message,
    this.cancelLabel = 'Cancel',
    this.confirmLabel = 'Confirm',
    this.isDestructive = false,
  }) : _title = title;

  final String _title;
  final String message;
  final String cancelLabel;
  final String confirmLabel;

  /// When `true`, the confirm button uses `error.main`. Default: `primary.main`.
  final bool isDestructive;

  @override
  String? get title => _title;

  @override
  Widget buildContent(BuildContext context) {
    final colors = MasrafyColorTheme.of(context);
    final texts = MasrafyTextTheme.of(context);
    return Text(
      message,
      style: texts.body.regular().copyWith(color: colors.text.secondary),
    );
  }

  @override
  Widget? buildFooter(BuildContext context) {
    return MasrafyDialogActions(
      cancelLabel: cancelLabel,
      confirmLabel: confirmLabel,
      isDestructive: isDestructive,
      onCancel: () => Navigator.of(context).pop(false),
      onConfirm: () => Navigator.of(context).pop(true),
    );
  }

  /// Shows the dialog and returns `true` when the user confirms,
  /// `false` when they cancel or dismiss (back gesture / barrier tap).
  static Future<bool> show(
    BuildContext context, {
    required String title,
    required String message,
    String cancelLabel = 'Cancel',
    String confirmLabel = 'Confirm',
    bool isDestructive = false,
    bool barrierDismissible = true,
  }) async {
    final result = await MasrafyDialogBase.show<bool>(
      context: context,
      barrierDismissible: barrierDismissible,
      dialog: MasrafyConfirmDialog(
        title: title,
        message: message,
        cancelLabel: cancelLabel,
        confirmLabel: confirmLabel,
        isDestructive: isDestructive,
      ),
    );
    return result ?? false;
  }
}
