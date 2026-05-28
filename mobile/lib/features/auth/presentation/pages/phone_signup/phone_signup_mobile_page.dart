part of 'phone_signup.imports.dart';

/// Step 1 — mobile entry.
class PhoneSignupMobilePage extends StatefulWidget {
  const PhoneSignupMobilePage({super.key});
  @override
  State<PhoneSignupMobilePage> createState() => _PhoneSignupMobilePageState();
}

class _PhoneSignupMobilePageState extends State<PhoneSignupMobilePage> {
  final _ctrl = TextEditingController();

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return BlocConsumer<PhoneSignupCubit, PhoneSignupState>(
      listener: (ctx, state) {
        if (state.isFailure) {
          ScaffoldMessenger.of(ctx).showSnackBar(
            SnackBar(content: Text(state.error!.code)),
          );
        }
      },
      builder: (ctx, state) {
        final busy = state.isRequestingOtp;
        final l10n = AppLocalizations.of(ctx);
        return Scaffold(
          appBar: AppBar(title: Text(l10n.auth_phone_signup_title_phone)),
          body: Padding(
            padding: const EdgeInsetsDirectional.all(24),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                TextField(
                  controller: _ctrl,
                  keyboardType: TextInputType.phone,
                  decoration: InputDecoration(
                    labelText: l10n.auth_phone_signup_field_mobile,
                    hintText: l10n.auth_phone_signup_field_mobile_hint,
                  ),
                  onChanged: (v) => ctx.read<PhoneSignupCubit>().updateField(
                        PhoneSignupField.phone,
                        v.trim(),
                      ),
                ),
                const SizedBox(height: 24),
                FilledButton(
                  onPressed: busy
                      ? null
                      : () {
                          ctx.read<PhoneSignupCubit>().updateField(
                                PhoneSignupField.locale,
                                ctx.masrafyLocaleCode,
                              );
                          ctx.read<PhoneSignupCubit>().requestOtp();
                        },
                  child: busy
                      ? const SizedBox.square(
                          dimension: 18,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : Text(l10n.auth_phone_signup_action_send),
                ),
              ],
            ),
          ),
        );
      },
    );
  }
}
