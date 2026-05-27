import 'package:flutter/material.dart';
import 'package:app/core/theme/colors/masrafy_color_theme.dart';
import 'package:app/core/theme/typography/masrafy_text_theme.dart';
import 'package:app/core/widgets/dialogs/masrafy_dialog_base.dart';

/// Single-action info / acknowledgement dialog. Use when the message is
/// purely informational (e.g. "Upgrade Required", "Heads up") and the
/// user only needs an OK button to dismiss it.
///
/// For two-button confirmation (Cancel + Confirm) use [MasrafyConfirmDialog]
/// instead.
///
/// ```dart
/// await MasrafyInfoDialog.show(
///   context,
///   title: 'Upgrade Required',
///   message: 'Notes are available on the Pro plan.',
/// );
/// ```
class MasrafyInfoDialog extends MasrafyDialogBase {
  const MasrafyInfoDialog({
    super.key,
    required String title,
    required this.message,
    this.actionLabel = 'OK',
  }) : _title = title;

  final String _title;
  final String message;
  final String actionLabel;

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
    final colors = MasrafyColorTheme.of(context);
    final texts = MasrafyTextTheme.of(context);
    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTap: () => Navigator.of(context).pop(),
      child: Container(
        height: 40,
        alignment: Alignment.center,
        decoration: BoxDecoration(
          color: colors.primary.main,
          border: Border.all(color: colors.primary.main),
          borderRadius: BorderRadius.circular(24),
        ),
        child: Text(
          actionLabel,
          style: texts.bodyLarge.regular().copyWith(color: Colors.white),
        ),
      ),
    );
  }

  /// Shows the dialog. Returns when the user dismisses it.
  static Future<void> show(
    BuildContext context, {
    required String title,
    required String message,
    String actionLabel = 'OK',
    bool barrierDismissible = true,
  }) {
    return MasrafyDialogBase.show<void>(
      context: context,
      barrierDismissible: barrierDismissible,
      dialog: MasrafyInfoDialog(
        title: title,
        message: message,
        actionLabel: actionLabel,
      ),
    );
  }
}
