part of 'complete_profile.imports.dart';

/// Step 3 — email (only if customer.email is currently null).
/// Step 4 — age. Both are held client-side and submitted atomically with the
/// loan-application /applications/apply request (FR-009d hybrid).
class CompleteProfileEmailPage extends StatefulWidget {
  const CompleteProfileEmailPage({super.key, required this.onSubmit, this.initialEmail});
  final ValueChanged<String> onSubmit;
  final String? initialEmail;

  @override
  State<CompleteProfileEmailPage> createState() => _CompleteProfileEmailPageState();
}

class _CompleteProfileEmailPageState extends State<CompleteProfileEmailPage> {
  late final TextEditingController _ctrl =
      TextEditingController(text: widget.initialEmail ?? '');

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return Scaffold(
      appBar: AppBar(title: Text(l10n.auth_complete_profile_title_email)),
      body: Padding(
        padding: const EdgeInsetsDirectional.all(24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            TextField(
              controller: _ctrl,
              keyboardType: TextInputType.emailAddress,
              decoration: InputDecoration(labelText: l10n.auth_complete_profile_field_email),
            ),
            const SizedBox(height: 24),
            FilledButton(
              onPressed: () {
                if (!_ctrl.text.contains('@')) return;
                widget.onSubmit(_ctrl.text.trim());
              },
              child: Text(l10n.auth_complete_profile_action_continue),
            ),
          ],
        ),
      ),
    );
  }
}
