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
                  decoration: InputDecoration(
                    labelText: l10n.auth_forgot_password_field_mobile,
                  ),
                  onChanged: (v) => ctx.read<ForgotPasswordCubit>().updateField(
                        ForgotPasswordField.phone,
                        v.trim(),
                      ),
                ),
                const SizedBox(height: 24),
                FilledButton(
                  onPressed: busy
                      ? null
                      : () {
                          final localeCode =
                              Localizations.localeOf(ctx).languageCode == 'en'
                                  ? 'en'
                                  : 'ar';
                          ctx
                              .read<ForgotPasswordCubit>()
                              .updateField(ForgotPasswordField.locale, localeCode);
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

class ForgotPasswordOtpPage extends StatefulWidget {
  const ForgotPasswordOtpPage({super.key});
  @override
  State<ForgotPasswordOtpPage> createState() => _ForgotPasswordOtpPageState();
}

class _ForgotPasswordOtpPageState extends State<ForgotPasswordOtpPage> {
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
        final busy = state.isVerifying;
        final l10n = AppLocalizations.of(ctx);
        return Scaffold(
          appBar: AppBar(title: Text(l10n.auth_forgot_password_title_verify)),
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
                    labelText: l10n.auth_forgot_password_field_otp,
                  ),
                  onChanged: (v) => ctx.read<ForgotPasswordCubit>().updateField(
                        ForgotPasswordField.otpCode,
                        v.trim(),
                      ),
                ),
                const SizedBox(height: 24),
                FilledButton(
                  onPressed: busy
                      ? null
                      : () => ctx.read<ForgotPasswordCubit>().verifyOtp(),
                  child: busy
                      ? const SizedBox.square(
                          dimension: 18,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : Text(l10n.auth_forgot_password_action_verify),
                ),
              ],
            ),
          ),
        );
      },
    );
  }
}

class ForgotPasswordResetPage extends StatefulWidget {
  const ForgotPasswordResetPage({super.key});
  @override
  State<ForgotPasswordResetPage> createState() => _ForgotPasswordResetPageState();
}

class _ForgotPasswordResetPageState extends State<ForgotPasswordResetPage> {
  final _pwd = TextEditingController();
  final _confirm = TextEditingController();
  final _formKey = GlobalKey<FormState>();

  @override
  void dispose() {
    _pwd.dispose();
    _confirm.dispose();
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
        final busy = state.isResetting;
        final l10n = AppLocalizations.of(ctx);
        return Scaffold(
          appBar: AppBar(title: Text(l10n.auth_forgot_password_title_reset)),
          body: Padding(
            padding: const EdgeInsetsDirectional.all(24),
            child: Form(
              key: _formKey,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  TextFormField(
                    controller: _pwd,
                    obscureText: true,
                    decoration: InputDecoration(
                      labelText: l10n.auth_forgot_password_field_new_password,
                    ),
                    onChanged: (v) =>
                        ctx.read<ForgotPasswordCubit>().updateField(
                              ForgotPasswordField.newPassword,
                              v,
                            ),
                    validator: (v) {
                      if (v == null || v.length < 8) {
                        return l10n.auth_forgot_password_validation_password_min;
                      }
                      if (!RegExp(r'[A-Za-z]').hasMatch(v)) {
                        return l10n.auth_forgot_password_validation_password_letter;
                      }
                      if (!RegExp(r'\d').hasMatch(v)) {
                        return l10n.auth_forgot_password_validation_password_digit;
                      }
                      return null;
                    },
                  ),
                  const SizedBox(height: 12),
                  TextFormField(
                    controller: _confirm,
                    obscureText: true,
                    decoration: InputDecoration(
                      labelText: l10n.auth_forgot_password_field_confirm_password,
                    ),
                    validator: (v) => v == _pwd.text
                        ? null
                        : l10n.auth_forgot_password_validation_password_mismatch,
                  ),
                  const SizedBox(height: 24),
                  FilledButton(
                    onPressed: busy
                        ? null
                        : () {
                            if (!_formKey.currentState!.validate()) return;
                            ctx.read<ForgotPasswordCubit>().reset();
                          },
                    child: busy
                        ? const SizedBox.square(
                            dimension: 18,
                            child: CircularProgressIndicator(strokeWidth: 2),
                          )
                        : Text(l10n.auth_forgot_password_action_reset),
                  ),
                ],
              ),
            ),
          ),
        );
      },
    );
  }
}
