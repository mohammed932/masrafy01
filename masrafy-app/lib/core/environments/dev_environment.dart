import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';

import 'base_environment.dart';

class DevEnvironment extends BaseEnvironment {
  // Dev talks to the backend running on the build machine
  // (`npm run start:dev`, port 3000):
  // - iOS simulator / desktop / web: `localhost` is the machine itself.
  // - Android: `MainActivity` answers [resolveHost] — `10.0.2.2` on the
  //   emulator, and on a physical phone the machine's LAN address, which the
  //   debug Gradle build captures on every build (`dev_host_ip`). Nothing to
  //   configure; after switching networks, rebuild.
  //
  // Explicit override, wins over all of the above:
  //
  //   flutter run -t lib/main_dev.dart \
  //     --dart-define=MASRAFY_API_BASE_URL=http://<host>:3000
  static const _override = String.fromEnvironment('MASRAFY_API_BASE_URL');
  static const _channel = MethodChannel('masrafy/dev_host');

  String _host = 'localhost';

  /// Asks the Android side which host reaches the build machine. Call once
  /// before the first request (done in `configureDependencies`).
  Future<void> resolveHost() async {
    if (_override.isNotEmpty || kIsWeb) return;
    if (defaultTargetPlatform != TargetPlatform.android) return;
    try {
      _host = await _channel.invokeMethod<String>('resolve') ?? '10.0.2.2';
    } on PlatformException {
      _host = '10.0.2.2';
    } on MissingPluginException {
      _host = '10.0.2.2';
    }
  }

  @override
  String get baseUrl =>
      _override.isNotEmpty ? _override : 'http://$_host:3000';

  @override
  bool get isProduction => false;

  @override
  bool get onboardingEnabled => true;

  // Disabled for now to unblock end-to-end testing (no biometric lock in dev).
  @override
  bool get biometricEnabled => false;
}
