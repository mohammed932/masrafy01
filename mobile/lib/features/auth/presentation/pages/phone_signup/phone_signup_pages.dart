import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../cubits/phone_signup_cubit.dart';

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
        if (state is PhoneSignupFailure) {
          ScaffoldMessenger.of(ctx).showSnackBar(SnackBar(content: Text(state.error.toString())));
        }
      },
      builder: (ctx, state) {
        final busy = state is PhoneSignupRequestingOtp;
        return Scaffold(
          appBar: AppBar(title: const Text('Sign up — Mobile')),
          body: Padding(
            padding: const EdgeInsetsDirectional.all(24),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                TextField(
                  controller: _ctrl,
                  keyboardType: TextInputType.phone,
                  decoration: const InputDecoration(
                    labelText: 'Mobile number',
                    hintText: '+201001234567',
                  ),
                ),
                const SizedBox(height: 24),
                FilledButton(
                  onPressed: busy ? null : () => ctx.read<PhoneSignupCubit>().requestOtp(
                        phone: _ctrl.text.trim(),
                        locale: Localizations.localeOf(ctx).languageCode == 'en' ? 'en' : 'ar',
                      ),
                  child: busy
                      ? const SizedBox.square(dimension: 18, child: CircularProgressIndicator(strokeWidth: 2))
                      : const Text('Send code'),
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
        if (state is PhoneSignupFailure) {
          ScaffoldMessenger.of(ctx).showSnackBar(SnackBar(content: Text(state.error.toString())));
        }
      },
      builder: (ctx, state) {
        final busy = state is PhoneSignupVerifyingOtp;
        return Scaffold(
          appBar: AppBar(title: const Text('Verify code')),
          body: Padding(
            padding: const EdgeInsetsDirectional.all(24),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                TextField(
                  controller: _ctrl,
                  keyboardType: TextInputType.number,
                  maxLength: 6,
                  decoration: const InputDecoration(labelText: '6-digit code'),
                ),
                const SizedBox(height: 24),
                FilledButton(
                  onPressed: busy ? null : () => ctx.read<PhoneSignupCubit>().verifyOtp(code: _ctrl.text.trim()),
                  child: busy
                      ? const SizedBox.square(dimension: 18, child: CircularProgressIndicator(strokeWidth: 2))
                      : const Text('Verify'),
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
        if (state is PhoneSignupFailure) {
          ScaffoldMessenger.of(ctx).showSnackBar(SnackBar(content: Text(state.error.toString())));
        }
      },
      builder: (ctx, state) {
        final busy = state is PhoneSignupSubmittingProfile;
        return Scaffold(
          appBar: AppBar(title: const Text('Your details')),
          body: SingleChildScrollView(
            padding: const EdgeInsetsDirectional.all(24),
            child: Form(
              key: _formKey,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  TextFormField(
                    controller: _name,
                    decoration: const InputDecoration(labelText: 'Full name'),
                    validator: (v) => (v == null || v.trim().isEmpty) ? 'required' : null,
                  ),
                  const SizedBox(height: 12),
                  TextFormField(
                    controller: _email,
                    keyboardType: TextInputType.emailAddress,
                    decoration: const InputDecoration(labelText: 'Email'),
                    validator: (v) {
                      if (v == null || v.trim().isEmpty) return 'required';
                      if (!v.contains('@')) return 'invalid';
                      return null;
                    },
                  ),
                  const SizedBox(height: 12),
                  TextFormField(
                    controller: _pwd,
                    obscureText: !_showPwd,
                    decoration: InputDecoration(
                      labelText: 'Password',
                      suffixIcon: IconButton(
                        icon: Icon(_showPwd ? Icons.visibility_off : Icons.visibility),
                        onPressed: () => setState(() => _showPwd = !_showPwd),
                      ),
                    ),
                    validator: (v) {
                      if (v == null || v.length < 8) return 'min 8 chars';
                      if (!RegExp(r'[A-Za-z]').hasMatch(v)) return 'need a letter';
                      if (!RegExp(r'\d').hasMatch(v)) return 'need a digit';
                      return null;
                    },
                  ),
                  const SizedBox(height: 12),
                  TextFormField(
                    controller: _pwdConfirm,
                    obscureText: !_showPwd,
                    decoration: const InputDecoration(labelText: 'Confirm password'),
                    validator: (v) => v == _pwd.text ? null : 'does not match',
                  ),
                  const SizedBox(height: 12),
                  TextFormField(
                    controller: _age,
                    keyboardType: TextInputType.number,
                    decoration: const InputDecoration(labelText: 'Age'),
                    validator: (v) {
                      final n = int.tryParse(v ?? '');
                      if (n == null || n < 18 || n > 80) return '18–80';
                      return null;
                    },
                  ),
                  const SizedBox(height: 24),
                  FilledButton(
                    onPressed: busy
                        ? null
                        : () {
                            if (!_formKey.currentState!.validate()) return;
                            ctx.read<PhoneSignupCubit>().completeProfile(
                                  name: _name.text.trim(),
                                  email: _email.text.trim(),
                                  password: _pwd.text,
                                  age: int.parse(_age.text),
                                );
                          },
                    child: busy
                        ? const SizedBox.square(dimension: 18, child: CircularProgressIndicator(strokeWidth: 2))
                        : const Text('Create account'),
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
