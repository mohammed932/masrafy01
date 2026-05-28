part of 'forgot_password.imports.dart';

class ForgotPasswordMobilePage extends StatefulWidget {
  const ForgotPasswordMobilePage({super.key});
  @override
  State<ForgotPasswordMobilePage> createState() => _ForgotPasswordMobilePageState();
}

class _ForgotPasswordMobilePageState extends State<ForgotPasswordMobilePage> {
  final _ctrl = TextEditingController();

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return BlocConsumer<ForgotPasswordCubit, ForgotPasswordState>(
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
          appBar: AppBar(title: Text(l10n.auth_forgot_password_title_request)),
          body: Padding(
            padding: const EdgeInsetsDirectional.all(24),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                TextField(
                  controller: _ctrl,
                  keyboardType: TextInputType.phone,
                  inputFormatters: [
                    FilteringTextInputFormatter.digitsOnly,
                    LengthLimitingTextInputFormatter(10),
                  ],
                  decoration: InputDecoration(
                    labelText: l10n.auth_forgot_password_field_mobile,
                    prefixText: '${MasrafyCountryCode.egypt} ',
                  ),
                  onChanged: (v) => ctx.read<ForgotPasswordCubit>().updateField(
                        ForgotPasswordField.phone,
                        '${MasrafyCountryCode.egypt}${v.trim()}',
                      ),
                ),
                const SizedBox(height: 24),
                FilledButton(
                  onPressed: busy
                      ? null
                      : () {
                          ctx.read<ForgotPasswordCubit>().updateField(
                                ForgotPasswordField.locale,
                                ctx.masrafyLocaleCode,
                              );
                          ctx.read<ForgotPasswordCubit>().requestOtp();
                        },
                  child: busy
                      ? const SizedBox.square(
                          dimension: 18,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : Text(l10n.auth_forgot_password_action_send),
                ),
              ],
            ),
          ),
        );
      },
    );
  }
}
