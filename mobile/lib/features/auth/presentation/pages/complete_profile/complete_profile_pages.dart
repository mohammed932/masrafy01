import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import 'cubit/complete_profile/complete_profile_cubit.dart';

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
        final busy = state.isRequestingOtp;
        return Scaffold(
          appBar: AppBar(title: const Text('Complete profile — mobile')),
          body: Padding(
            padding: const EdgeInsetsDirectional.all(24),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                TextField(
                  controller: _ctrl,
                  keyboardType: TextInputType.phone,
                  decoration: const InputDecoration(labelText: 'Mobile number'),
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

/// Step 2 — OTP entry. On success, mobile + mobileVerifiedAt are persisted to
/// the customer record IMMEDIATELY (per spec R6) — the flow advances to
/// email/age (held client-side until apply) without further DB writes.
class CompleteProfileOtpPage extends StatefulWidget {
  const CompleteProfileOtpPage({super.key, required this.onMobileBound});
  final VoidCallback onMobileBound;

  @override
  State<CompleteProfileOtpPage> createState() => _CompleteProfileOtpPageState();
}

class _CompleteProfileOtpPageState extends State<CompleteProfileOtpPage> {
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
        if (state.isMobileBound) {
          widget.onMobileBound();
        }
        if (state.isFailure) {
          ScaffoldMessenger.of(ctx).showSnackBar(
            SnackBar(content: Text(state.error!.code)),
          );
        }
      },
      builder: (ctx, state) {
        final busy = state.isVerifyingOtp;
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
                  onChanged: (v) =>
                      ctx.read<CompleteProfileCubit>().updateField(
                            CompleteProfileField.otpCode,
                            v.trim(),
                          ),
                ),
                const SizedBox(height: 24),
                FilledButton(
                  onPressed: busy
                      ? null
                      : () => ctx.read<CompleteProfileCubit>().verifyOtp(),
                  child: busy
                      ? const SizedBox.square(
                          dimension: 18,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
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
    return Scaffold(
      appBar: AppBar(title: const Text('Email')),
      body: Padding(
        padding: const EdgeInsetsDirectional.all(24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            TextField(
              controller: _ctrl,
              keyboardType: TextInputType.emailAddress,
              decoration: const InputDecoration(labelText: 'Email'),
            ),
            const SizedBox(height: 24),
            FilledButton(
              onPressed: () {
                if (!_ctrl.text.contains('@')) return;
                widget.onSubmit(_ctrl.text.trim());
              },
              child: const Text('Continue'),
            ),
          ],
        ),
      ),
    );
  }
}

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
    return Scaffold(
      appBar: AppBar(title: const Text('Age')),
      body: Padding(
        padding: const EdgeInsetsDirectional.all(24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            TextField(
              controller: _ctrl,
              keyboardType: TextInputType.number,
              decoration: const InputDecoration(labelText: 'Age (18–80)'),
            ),
            const SizedBox(height: 24),
            FilledButton(
              onPressed: () {
                final n = int.tryParse(_ctrl.text);
                if (n == null || n < 18 || n > 80) return;
                widget.onSubmit(n);
              },
              child: const Text('Continue'),
            ),
          ],
        ),
      ),
    );
  }
}
