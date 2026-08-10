import 'base_environment.dart';

class ProdEnvironment extends BaseEnvironment {
  @override
  String get baseUrl => 'https://apis.masrafy.app';

  @override
  bool get isProduction => true;

  @override
  bool get onboardingEnabled => false;

  @override
  bool get biometricEnabled => false;
}
