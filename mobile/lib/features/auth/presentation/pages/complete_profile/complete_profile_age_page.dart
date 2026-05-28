part of 'complete_profile.imports.dart';

class CompleteProfileAgePage extends StatefulWidget {
  const CompleteProfileAgePage({super.key, required this.onSubmit});
  final ValueChanged<int> onSubmit;

  @override
  State<CompleteProfileAgePage> createState() => _CompleteProfileAgePageState();
}

class _CompleteProfileAgePageState extends State<CompleteProfileAgePage> {
  final _ctrl = TextEditingController();

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return Scaffold(
      appBar: AppBar(title: Text(l10n.auth_complete_profile_title_age)),
      body: Padding(
        padding: const EdgeInsetsDirectional.all(24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            TextField(
              controller: _ctrl,
              keyboardType: TextInputType.number,
              decoration: InputDecoration(labelText: l10n.auth_complete_profile_field_age),
            ),
            const SizedBox(height: 24),
            FilledButton(
              onPressed: () {
                final n = int.tryParse(_ctrl.text);
                if (n == null || n < 18 || n > 80) return;
                widget.onSubmit(n);
              },
              child: Text(l10n.auth_complete_profile_action_continue),
            ),
          ],
        ),
      ),
    );
  }
}
