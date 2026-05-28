part of 'complete_profile.imports.dart';

/// Step 1 of the SOCIAL Complete-Profile flow — mobile + OTP request.
class CompleteProfileMobilePage extends StatefulWidget {
  const CompleteProfileMobilePage({super.key});
  @override
  State<CompleteProfileMobilePage> createState() => _CompleteProfileMobilePageState();
}

class _CompleteProfileMobilePageState extends State<CompleteProfileMobilePage> {
  final _ctrl = TextEditingController();

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return BlocConsumer<CompleteProfileCubit, CompleteProfileState>(
      listener: (ctx, state) {
        if (state.isFailure) {
          ScaffoldMessenger.of(ctx).showSnackBar(
            SnackBar(content: Text(state.error!.code)),
          );
        }
      },
      builder: (ctx, state) {
        final l10n = AppLocalizations.of(ctx);
        final busy = state.isRequestingOtp;
        return Scaffold(
          appBar: AppBar(title: Text(l10n.auth_complete_profile_title_mobile)),
          body: Padding(
            padding: const EdgeInsetsDirectional.all(24),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                TextField(
                  controller: _ctrl,
                  keyboardType: TextInputType.phone,
                  decoration: InputDecoration(labelText: l10n.auth_complete_profile_field_mobile),
                  onChanged: (v) =>
                      ctx.read<CompleteProfileCubit>().updateField(
                            CompleteProfileField.phone,
                            v.trim(),
                          ),
                ),
                const SizedBox(height: 24),
                FilledButton(
                  onPressed: busy
                      ? null
                      : () => ctx.read<CompleteProfileCubit>().requestOtp(),
                  child: busy
                      ? const SizedBox.square(
                          dimension: 18,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : Text(l10n.auth_complete_profile_action_send),
                ),
              ],
            ),
          ),
        );
      },
    );
  }
}
