import 'dart:io';

import 'base_environment.dart';

class DevEnvironment extends BaseEnvironment {
  @override
  String get baseUrl =>
      Platform.isAndroid ? 'http://10.0.2.2:3000' : 'http://localhost:3000';

  @override
  bool get isProduction => false;

  @override
  bool get onboardingEnabled => true;
}
