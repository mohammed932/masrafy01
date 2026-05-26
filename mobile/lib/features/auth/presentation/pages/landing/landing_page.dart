import 'package:flutter/foundation.dart' show defaultTargetPlatform, TargetPlatform;
import 'package:flutter/material.dart';

/// Landing screen — feature 008 / spec User Story 1 + 2 + 4.
///
/// Three CTAs: Sign up with Phone / Continue with Google / Continue with
/// Apple (iOS only — hidden on Android per research R15) + Log In link.
class LandingPage extends StatelessWidget {
  const LandingPage({
    super.key,
    required this.onSignUpWithPhone,
    required this.onContinueWithGoogle,
    required this.onContinueWithApple,
    required this.onLogIn,
  });

  final VoidCallback onSignUpWithPhone;
  final VoidCallback onContinueWithGoogle;
  final VoidCallback onContinueWithApple;
  final VoidCallback onLogIn;

  bool get _showApple => defaultTargetPlatform == TargetPlatform.iOS;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsetsDirectional.all(24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const SizedBox(height: 48),
              Text(
                'Masrafy',
                style: Theme.of(context).textTheme.headlineMedium,
                textAlign: TextAlign.center,
              ),
              const Spacer(),
              FilledButton(
                onPressed: onSignUpWithPhone,
                child: const Text('Sign Up with Phone'),
              ),
              const SizedBox(height: 12),
              OutlinedButton.icon(
                onPressed: onContinueWithGoogle,
                icon: const Icon(Icons.g_mobiledata),
                label: const Text('Continue with Google'),
              ),
              if (_showApple) ...[
                const SizedBox(height: 12),
                OutlinedButton.icon(
                  onPressed: onContinueWithApple,
                  icon: const Icon(Icons.apple),
                  label: const Text('Continue with Apple'),
                ),
              ],
              const SizedBox(height: 24),
              TextButton(
                onPressed: onLogIn,
                child: const Text('Log In'),
              ),
              const SizedBox(height: 24),
            ],
          ),
        ),
      ),
    );
  }
}
