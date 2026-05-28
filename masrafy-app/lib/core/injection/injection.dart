import 'package:get_it/get_it.dart';
import 'package:injectable/injectable.dart';
import 'package:app/core/environments/app_env.dart';
import 'package:app/core/environments/base_environment.dart';
import 'package:app/core/injection/injection.config.dart';

final getIt = GetIt.instance;

@InjectableInit(
  initializerName: 'init',
  preferRelativeImports: true,
  asExtension: true,
)
Future<void> configureDependencies(BaseEnvironment? environment) async {
  if (environment != null) {
    getIt.registerSingleton<AppEnv>(AppEnv(environment));
  }
  await getIt.init();
}
