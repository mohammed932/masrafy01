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
                          final localeCode =
                              Localizations.localeOf(ctx).languageCode == 'en'
                                  ? 'en'
                                  : 'ar';
                          ctx
                              .read<PhoneSignupCubit>()
                              .updateField(PhoneSignupField.locale, localeCode);
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

/// Step 3 — profile (name + email + password + confirm + age).
class PhoneSignupProfilePage extends StatefulWidget {
  const PhoneSignupProfilePage({super.key});
  @override
  State<PhoneSignupProfilePage> createState() => _PhoneSignupProfilePageState();
}

class _PhoneSignupProfilePageState extends State<PhoneSignupProfilePage> {
  final _formKey = GlobalKey<FormState>();
  final _name = TextEditingController();
  final _email = TextEditingController();
  final _pwd = TextEditingController();
  final _pwdConfirm = TextEditingController();
  final _age = TextEditingController();
  bool _showPwd = false;

  @override
  void dispose() {
    _name.dispose();
    _email.dispose();
    _pwd.dispose();
    _pwdConfirm.dispose();
    _age.dispose();
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
        final busy = state.isSubmittingProfile;
        final l10n = AppLocalizations.of(ctx);
        return Scaffold(
          appBar: AppBar(title: Text(l10n.auth_phone_signup_title_details)),
          body: SingleChildScrollView(
            padding: const EdgeInsetsDirectional.all(24),
            child: Form(
              key: _formKey,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  TextFormField(
                    controller: _name,
                    decoration: InputDecoration(
                      labelText: l10n.auth_phone_signup_field_name,
                    ),
                    onChanged: (v) =>
                        ctx.read<PhoneSignupCubit>().updateField(
                              PhoneSignupField.name,
                              v.trim(),
                            ),
                    validator: (v) => (v == null || v.trim().isEmpty)
                        ? l10n.auth_phone_signup_validation_required
                        : null,
                  ),
                  const SizedBox(height: 12),
                  TextFormField(
                    controller: _email,
                    keyboardType: TextInputType.emailAddress,
                    decoration: InputDecoration(
                      labelText: l10n.auth_phone_signup_field_email,
                    ),
                    onChanged: (v) =>
                        ctx.read<PhoneSignupCubit>().updateField(
                              PhoneSignupField.email,
                              v.trim(),
                            ),
                    validator: (v) {
                      if (v == null || v.trim().isEmpty) {
                        return l10n.auth_phone_signup_validation_required;
                      }
                      if (!v.contains('@')) {
                        return l10n.auth_phone_signup_validation_email_invalid;
                      }
                      return null;
                    },
                  ),
                  const SizedBox(height: 12),
                  TextFormField(
                    controller: _pwd,
                    obscureText: !_showPwd,
                    decoration: InputDecoration(
                      labelText: l10n.auth_phone_signup_field_password,
                      suffixIcon: IconButton(
                        icon: Icon(_showPwd
                            ? Icons.visibility_off
                            : Icons.visibility),
                        onPressed: () => setState(() => _showPwd = !_showPwd),
                      ),
                    ),
                    onChanged: (v) =>
                        ctx.read<PhoneSignupCubit>().updateField(
                              PhoneSignupField.password,
                              v,
                            ),
                    validator: (v) {
                      if (v == null || v.length < 8) {
                        return l10n.auth_phone_signup_validation_password_min;
                      }
                      if (!RegExp(r'[A-Za-z]').hasMatch(v)) {
                        return l10n.auth_phone_signup_validation_password_letter;
                      }
                      if (!RegExp(r'\d').hasMatch(v)) {
                        return l10n.auth_phone_signup_validation_password_digit;
                      }
                      return null;
                    },
                  ),
                  const SizedBox(height: 12),
                  TextFormField(
                    controller: _pwdConfirm,
                    obscureText: !_showPwd,
                    decoration: InputDecoration(
                      labelText: l10n.auth_phone_signup_field_password_confirm,
                    ),
                    validator: (v) => v == _pwd.text
                        ? null
                        : l10n.auth_phone_signup_validation_password_mismatch,
                  ),
                  const SizedBox(height: 12),
                  TextFormField(
                    controller: _age,
                    keyboardType: TextInputType.number,
                    decoration: InputDecoration(
                      labelText: l10n.auth_phone_signup_field_age,
                    ),
                    onChanged: (v) {
                      final n = int.tryParse(v);
                      if (n != null) {
                        ctx
                            .read<PhoneSignupCubit>()
                            .updateField(PhoneSignupField.age, n);
                      }
                    },
                    validator: (v) {
                      final n = int.tryParse(v ?? '');
                      if (n == null || n < 18 || n > 80) {
                        return l10n.auth_phone_signup_validation_age_range;
                      }
                      return null;
                    },
                  ),
                  const SizedBox(height: 24),
                  FilledButton(
                    onPressed: busy
                        ? null
                        : () {
                            if (!_formKey.currentState!.validate()) return;
                            ctx.read<PhoneSignupCubit>().completeProfile();
                          },
                    child: busy
                        ? const SizedBox.square(
                            dimension: 18,
                            child: CircularProgressIndicator(strokeWidth: 2),
                          )
                        : Text(l10n.auth_phone_signup_action_create),
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
