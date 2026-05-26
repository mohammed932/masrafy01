import 'package:flutter/material.dart';

/// Non-dismissible gate popup shown to a SOCIAL customer on Apply when their
/// profile is incomplete. The popup is mandatory per FR-009a — there is NO
/// "skip" / "later" affordance, outside-tap-to-close is disabled, and the
/// back button is intercepted to ask the user to cancel the apply flow
/// entirely (which returns them to matched offers — customer record stays
/// untouched).
class CompleteProfileGateDialog extends StatelessWidget {
  const CompleteProfileGateDialog({
    super.key,
    required this.onComplete,
    required this.onCancelApply,
  });

  final VoidCallback onComplete;
  final VoidCallback onCancelApply;

  static Future<void> show({
    required BuildContext context,
    required VoidCallback onComplete,
    required VoidCallback onCancelApply,
  }) {
    return showDialog<void>(
      context: context,
      barrierDismissible: false,
      builder: (_) => CompleteProfileGateDialog(
        onComplete: onComplete,
        onCancelApply: onCancelApply,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return PopScope(
      canPop: false,
      child: AlertDialog(
        title: const Text('Complete your profile'),
        content: const Text(
          'We need a few more details before you can apply. This is required by the bank.',
        ),
        actions: [
          TextButton(onPressed: onCancelApply, child: const Text('Cancel')),
          FilledButton(onPressed: onComplete, child: const Text('Complete Profile')),
        ],
      ),
    );
  }
}
