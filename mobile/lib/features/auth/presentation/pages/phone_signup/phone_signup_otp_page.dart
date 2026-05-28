part of 'phone_signup.imports.dart';

/// Step 2 — OTP entry.
class PhoneSignupOtpPage extends StatefulWidget {
  const PhoneSignupOtpPage({super.key});
  @override
  State<PhoneSignupOtpPage> createState() => _PhoneSignupOtpPageState();
}

class _PhoneSignupOtpPageState extends State<PhoneSignupOtpPage> {
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
        final busy = state.isVerifyingOtp;
        final l10n = AppLocalizations.of(ctx);
        return Scaffold(
          appBar: AppBar(title: Text(l10n.auth_phone_signup_title_verify)),
          body: Padding(
            padding: const EdgeInsetsDirectional.all(24),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                TextField(
                  controller: _ctrl,
                  keyboardType: TextInputType.number,
                  maxLength: 6,
                  decoration: InputDecoration(
                    labelText: l10n.auth_phone_signup_field_otp,
                  ),
                  onChanged: (v) => ctx.read<PhoneSignupCubit>().updateField(
                        PhoneSignupField.otpCode,
                        v.trim(),
                      ),
                ),
                const SizedBox(height: 24),
                FilledButton(
                  onPressed: busy
                      ? null
                      : () => ctx.read<PhoneSignupCubit>().verifyOtp(),
                  child: busy
                      ? const SizedBox.square(
                          dimension: 18,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : Text(l10n.auth_phone_signup_action_verify),
                ),
              ],
            ),
          ),
        );
      },
    );
  }
}
