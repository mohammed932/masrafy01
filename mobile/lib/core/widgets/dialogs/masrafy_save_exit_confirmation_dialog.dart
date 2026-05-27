import 'package:app/core/widgets/dialogs/masrafy_confirm_dialog.dart';

/// Confirmation dialog for "Save & Exit" — shown from the study session
/// header overflow menu. Returns `true` when the user confirms, `false`
/// (or `null`) on cancel / barrier dismiss.
class MasrafySaveExitConfirmationDialog extends MasrafyConfirmDialog {
  const MasrafySaveExitConfirmationDialog({super.key})
      : super(
          title: 'Save & Exit?',
          message:
              'Your progress will be saved. You can resume this test later.',
          confirmLabel: 'Save & Exit',
        );
}
