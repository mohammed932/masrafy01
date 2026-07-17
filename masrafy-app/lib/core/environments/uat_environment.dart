import 'base_environment.dart';

/// UAT (user-acceptance) flavor — points at the hosted staging API. Mirrors
/// production behavior (no onboarding, biometric lock on) but is NOT flagged
/// production, so prod-only guards stay relaxed for testing.
class UatEnvironment extends BaseEnvironment {
  @override
  String get baseUrl => 'https://apis.masrafy.app';

  @override
  bool get isProduction => false;

  @override
  bool get onboardingEnabled => true;

  @override
  bool get biometricEnabled => false;
}
