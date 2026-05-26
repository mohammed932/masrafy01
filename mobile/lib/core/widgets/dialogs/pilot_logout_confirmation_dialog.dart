import 'package:app/core/widgets/dialogs/pilot_confirm_dialog.dart';

/// Destructive confirmation dialog for signing out of the app.
class PilotLogoutConfirmationDialog extends PilotConfirmDialog {
  const PilotLogoutConfirmationDialog({super.key})
      : super(
          title: 'Sign out of Masrafy?',
          message: "You'll be returned to the login screen.",
          confirmLabel: 'Sign out',
          isDestructive: true,
        );
}
