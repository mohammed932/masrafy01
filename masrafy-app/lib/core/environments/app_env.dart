import 'base_environment.dart';

class AppEnv {
  BaseEnvironment _environment;

  AppEnv(this._environment);

  BaseEnvironment get environment => _environment;

  void updateEnv({required BaseEnvironment env}) => _environment = env;
}
