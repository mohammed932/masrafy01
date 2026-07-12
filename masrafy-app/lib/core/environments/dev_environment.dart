import 'base_environment.dart';

class DevEnvironment extends BaseEnvironment {
  // Android (emulator AND physical device) reaches the host backend via
  // `adb reverse tcp:3000 tcp:3000` — run once per device/session. Physical
  // hardware can't resolve the emulator-only `10.0.2.2` alias, so that
  // special-case was dropped in favor of one path that works for both.
  @override
  String get baseUrl => 'http://localhost:3000';

  @override
  bool get isProduction => false;

  @override
  bool get onboardingEnabled => true;

  // Disabled for now to unblock end-to-end testing (no biometric lock in dev).
  @override
  bool get biometricEnabled => false;
}
