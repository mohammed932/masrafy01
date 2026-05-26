import 'package:flutter/material.dart';
import 'package:gap/gap.dart';
import 'package:app/core/theme/colors/pilot_color_theme.dart';
import 'package:app/core/theme/typography/pilot_text_theme.dart';
import 'package:app/core/widgets/dialogs/pilot_dialog_base.dart';

/// Active-session detection dialog — shown during login / register when the
/// backend reports an existing session on another device. Confirming kicks
/// the other session and continues sign-in here.
///
/// Takes primitive fields (not a `SessionInfoEntity` entity) so the dialog can
/// live in core/ without inverting layer boundaries — the auth call site
/// projects `SessionInfoEntity` → these primitives.
class PilotActiveSessionDialog extends PilotDialogBase {
  const PilotActiveSessionDialog({
    super.key,
    required this.deviceInfo,
    required this.signedInAt,
    required this.onConfirm,
    required this.onCancel,
    this.lastActivityAt,
    this.ipAddressMasked,
  });

  final String? deviceInfo;
  final DateTime signedInAt;
  final DateTime? lastActivityAt;
  final String? ipAddressMasked;
  final VoidCallback onConfirm;
  final VoidCallback onCancel;

  @override
  String? get title => 'Active session detected';

  @override
  Widget buildContent(BuildContext context) {
    final colors = PilotColorTheme.of(context);
    final texts = PilotTextTheme.of(context);
    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          "You're already signed in on another device. Continuing will sign out that session.",
          style: texts.body.regular().copyWith(color: colors.text.secondary),
        ),
        const Gap(16),
        _Row(label: 'Device', value: deviceInfo ?? 'Unknown'),
        _Row(label: 'Signed in', value: _formatDate(signedInAt)),
        if (lastActivityAt != null)
          _Row(label: 'Last active', value: _formatDate(lastActivityAt!)),
        if (ipAddressMasked != null)
          _Row(label: 'IP', value: ipAddressMasked!),
      ],
    );
  }

  @override
  Widget? buildFooter(BuildContext context) {
    return PilotDialogActions(
      cancelLabel: 'Cancel',
      confirmLabel: 'Sign in here',
      onCancel: onCancel,
      onConfirm: onConfirm,
    );
  }

  static String _formatDate(DateTime d) {
    final local = d.toLocal();
    return '${local.year}-${local.month.toString().padLeft(2, '0')}-${local.day.toString().padLeft(2, '0')} '
        '${local.hour.toString().padLeft(2, '0')}:${local.minute.toString().padLeft(2, '0')}';
  }
}

class _Row extends StatelessWidget {
  const _Row({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    final colors = PilotColorTheme.of(context);
    final texts = PilotTextTheme.of(context);
    return Padding(
      padding: const EdgeInsets.only(bottom: 6),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 96,
            child: Text(
              label,
              style: texts.bodySmall
                  .medium()
                  .copyWith(color: colors.text.tertiary),
            ),
          ),
          Expanded(
            child: Text(
              value,
              style: texts.bodySmall.copyWith(color: colors.text.primary),
            ),
          ),
        ],
      ),
    );
  }
}
