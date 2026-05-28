import 'package:flutter_dotenv/flutter_dotenv.dart';
import 'base_environment.dart';

class ProdEnvironment extends BaseEnvironment {
  @override
  String get baseUrl => 'https://api.masrafy.eg';

  @override
  bool get isProduction => true;

  @override
  bool get onboardingEnabled => false;

  @override
  String get clientSecretKey => dotenv.env['CLIENT_SECRET_KEY']!;
}
