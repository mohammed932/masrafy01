import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../cubits/forgot_password_cubit.dart';

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
        if (state is ForgotPasswordFailure) {
          ScaffoldMessenger.of(ctx).showSnackBar(SnackBar(content: Text(state.error.toString())));
        }
      },
      builder: (ctx, state) {
        final busy = state is ForgotPasswordRequestingOtp;
        return Scaffold(
          appBar: AppBar(title: const Text('Forgot password')),
          body: Padding(
            padding: const EdgeInsetsDirectional.all(24),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                TextField(
                  controller: _ctrl,
                  keyboardType: TextInputType.phone,
                  decoration: const InputDecoration(labelText: 'Mobile number'),
                ),
                const SizedBox(height: 24),
                FilledButton(
                  onPressed: busy
                      ? null
                      : () => ctx.read<ForgotPasswordCubit>().requestOtp(
                            phone: _ctrl.text.trim(),
                            locale: Localizations.localeOf(ctx).languageCode == 'en' ? 'en' : 'ar',
                          ),
                  child: busy
                      ? const SizedBox.square(
                          dimension: 18, child: CircularProgressIndicator(strokeWidth: 2))
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
        if (state is ForgotPasswordFailure) {
          ScaffoldMessenger.of(ctx).showSnackBar(SnackBar(content: Text(state.error.toString())));
        }
      },
      builder: (ctx, state) {
        final busy = state is ForgotPasswordVerifying;
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
                  onPressed: busy
                      ? null
                      : () => ctx
                          .read<ForgotPasswordCubit>()
                          .verifyOtp(code: _ctrl.text.trim()),
                  child: busy
                      ? const SizedBox.square(
                          dimension: 18, child: CircularProgressIndicator(strokeWidth: 2))
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
        if (state is ForgotPasswordFailure) {
          ScaffoldMessenger.of(ctx).showSnackBar(SnackBar(content: Text(state.error.toString())));
        }
      },
      builder: (ctx, state) {
        final busy = state is ForgotPasswordResetting;
        return Scaffold(
          appBar: AppBar(title: const Text('New password')),
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
                    decoration: const InputDecoration(labelText: 'New password'),
                    validator: (v) {
                      if (v == null || v.length < 8) return 'min 8 chars';
                      if (!RegExp(r'[A-Za-z]').hasMatch(v)) return 'need a letter';
                      if (!RegExp(r'\d').hasMatch(v)) return 'need a digit';
                      return null;
                    },
                  ),
                  const SizedBox(height: 12),
                  TextFormField(
                    controller: _confirm,
                    obscureText: true,
                    decoration: const InputDecoration(labelText: 'Confirm new password'),
                    validator: (v) => v == _pwd.text ? null : 'does not match',
                  ),
                  const SizedBox(height: 24),
                  FilledButton(
                    onPressed: busy
                        ? null
                        : () {
                            if (!_formKey.currentState!.validate()) return;
                            ctx.read<ForgotPasswordCubit>().reset(newPassword: _pwd.text);
                          },
                    child: busy
                        ? const SizedBox.square(
                            dimension: 18, child: CircularProgressIndicator(strokeWidth: 2))
                        : const Text('Reset password'),
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
