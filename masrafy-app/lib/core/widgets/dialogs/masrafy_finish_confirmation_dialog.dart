import 'package:app/core/widgets/dialogs/masrafy_confirm_dialog.dart';

/// Destructive confirmation dialog for "Finish session" — used by both the
/// Study and Exam flows. Caller supplies the body copy (which differs by
/// completion state) and an optional primary-button label.
class MasrafyFinishConfirmationDialog extends MasrafyConfirmDialog {
  const MasrafyFinishConfirmationDialog({
    super.key,
    required String bodyText,
    String primaryLabel = 'Finish',
  }) : super(
          title: 'Finish session?',
          message: bodyText,
          confirmLabel: primaryLabel,
          isDestructive: true,
        );
}
