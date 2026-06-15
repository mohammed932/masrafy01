import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:get_it/get_it.dart';

import '../environments/app_env.dart';
import '../environments/base_environment.dart';
import '../environments/dev_environment.dart';
import '../network/app_network.dart';
import '../network/dio_factory.dart';
import '../network/network_interface.dart';
import '../router/router.dart';
import '../storage/customer_session_storage.dart';

final GetIt getIt = GetIt.instance;

/// Manual DI graph. Wires env / network / storage infrastructure only —
/// the feature layer (`auth`, `questionnaire`) is an empty scaffold awaiting
/// a clean rebuild against the finalized backend, so no feature bindings are
/// registered here yet. Re-add data/domain registrations (and switch to
/// `injectable` codegen) as each feature is rebuilt.
///
/// [environment] is selected at the flavor entrypoint (`main_dev.dart` /
/// `main_prod.dart`). When called from the default `main.dart` (no flavor),
/// falls back to [DevEnvironment].
Future<void> configureDependencies({BaseEnvironment? environment}) async {
  // -- Env + router + storage --------------------------------------------
  final env = environment ?? DevEnvironment();
  getIt.registerSingleton<AppEnv>(AppEnv(env));
  getIt.registerLazySingleton<AppRouter>(AppRouter.new);
  getIt.registerLazySingleton<FlutterSecureStorage>(
    () => const FlutterSecureStorage(
      aOptions: AndroidOptions(encryptedSharedPreferences: true),
    ),
  );
  getIt.registerLazySingleton<CustomerSessionStorage>(
    () => CustomerSessionStorage(getIt<FlutterSecureStorage>()),
  );

  // -- Network -----------------------------------------------------------
  getIt.registerLazySingleton(() => DioFactory.create(
        env: getIt<AppEnv>().environment,
        sessionStorage: getIt<CustomerSessionStorage>(),
      ));
  getIt.registerLazySingleton<BaseNetwork>(() => AppNetwork(getIt()));
}
