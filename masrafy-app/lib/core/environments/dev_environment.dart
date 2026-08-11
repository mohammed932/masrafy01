import 'base_environment.dart';

class DevEnvironment extends BaseEnvironment {
  // Android (emulator AND physical device) reaches the host backend over the
  // host's LAN address: the emulator-only `10.0.2.2` alias doesn't resolve on
  // physical hardware, and `adb reverse tcp:3000 tcp:3000` never delivers on
  // this device (the tunnel registers, requests never arrive).
  //
  // The default holds the current dev machine's address, but a LAN address dies
  // the moment either side joins another network ("Network is unreachable"), so
  // it is overridable without touching this file:
  //
  //   flutter run -t lib/main_dev.dart \
  //     --dart-define=MASRAFY_API_BASE_URL=http://<host-ip>:3000
  //
  // `ipconfig getifaddr en0` prints the host IP to use.
  @override
  String get baseUrl => const String.fromEnvironment(
        'MASRAFY_API_BASE_URL',
        defaultValue: 'http://172.20.10.2:3000',
      );

  @override
  bool get isProduction => false;

  @override
  bool get onboardingEnabled => true;

  // Disabled for now to unblock end-to-end testing (no biometric lock in dev).
  @override
  bool get biometricEnabled => false;
}
