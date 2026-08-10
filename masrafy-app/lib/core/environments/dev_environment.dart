import 'base_environment.dart';

class DevEnvironment extends BaseEnvironment {
  // Android (emulator AND physical device) reaches the host backend over the
  // host's LAN address — the emulator-only `10.0.2.2` alias doesn't resolve on
  // physical hardware, and `adb reverse tcp:3000 tcp:3000` proved unreliable on
  // this device. Update the IP when the dev machine changes network.
  @override
  String get baseUrl => 'http://192.168.100.29:3000';

  @override
  bool get isProduction => false;

  @override
  bool get onboardingEnabled => true;

  // Disabled for now to unblock end-to-end testing (no biometric lock in dev).
  @override
  bool get biometricEnabled => false;
}
