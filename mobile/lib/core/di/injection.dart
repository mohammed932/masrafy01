import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:get_it/get_it.dart';

import '../../features/auth/data/datasources/auth_remote_datasource.dart';
import '../../features/auth/data/repositories/auth_repository_impl.dart';
import '../../features/auth/domain/repositories/auth_repository.dart';
import '../../features/auth/domain/usecases/login_usecase.dart';
import '../../features/auth/presentation/cubit/login_cubit.dart';
import '../environments/env_config.dart';
import '../network/dio_factory.dart';
import '../router/guards/auth_guard.dart';
import '../router/router.dart';
import '../storage/customer_session_storage.dart';

final GetIt getIt = GetIt.instance;

/// Manual DI registration. Switch to `injectable` once we add code-gen to
/// CI — for now the container is small enough that hand-wiring is clearer
/// than generated annotations.
Future<void> configureDependencies({required bool prod}) async {
  // -- Env + storage -----------------------------------------------------
  final env = prod ? EnvConfig.prod() : EnvConfig.dev();
  getIt.registerSingleton<EnvConfig>(env);
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
        env: getIt<EnvConfig>(),
        sessionStorage: getIt<CustomerSessionStorage>(),
      ));

  // -- Auth feature ------------------------------------------------------
  getIt.registerLazySingleton(() => AuthRemoteDatasource(getIt()));
  getIt.registerLazySingleton<AuthRepository>(
    () => AuthRepositoryImpl(getIt<AuthRemoteDatasource>(), getIt()),
  );
  getIt.registerLazySingleton(() => LoginUsecase(getIt<AuthRepository>()));
  getIt.registerFactory(() => LoginCubit(getIt<LoginUsecase>()));

  // -- Router + guards ---------------------------------------------------
  getIt.registerLazySingleton<AuthGuard>(
    () => AuthGuard(getIt<CustomerSessionStorage>()),
  );
  getIt.registerLazySingleton<AppRouter>(
    () => AppRouter(getIt<AuthGuard>()),
  );
}
