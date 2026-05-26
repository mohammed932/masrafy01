import 'package:flutter_dotenv/flutter_dotenv.dart';
import 'base_environment.dart';

class DevEnvironment extends BaseEnvironment {
  @override
  String get baseUrl => 'http://10.0.2.2:3000';

  @override
  bool get isProduction => false;

  @override
  bool get onboardingEnabled => true;

  @override
  String get clientSecretKey => dotenv.env['CLIENT_SECRET_KEY']!;
}
