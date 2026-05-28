import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:get_it/get_it.dart';
import 'package:google_sign_in/google_sign_in.dart';

import '../../features/auth/data/datasources/auth_remote_datasource.dart';
import '../../features/auth/data/repositories/auth_repository_impl.dart';
import '../../features/auth/data/services/social_signin_service.dart';
import '../../features/auth/domain/repositories/auth_repository.dart';
import '../../features/auth/domain/repositories/customer_auth_repository.dart';
import '../../features/auth/domain/usecases/auth_usecase.dart';
import '../../features/auth/presentation/pages/complete_profile/cubit/complete_profile/complete_profile_cubit.dart';
import '../../features/auth/presentation/pages/forgot_password/cubit/forgot_password/forgot_password_cubit.dart';
import '../../features/auth/presentation/pages/login/cubit/login/login_cubit.dart';
import '../../features/auth/presentation/pages/phone_signup/cubit/phone_signup/phone_signup_cubit.dart';
import '../../features/auth/presentation/pages/social_signin/cubit/social_signin/social_signin_cubit.dart';
import '../../features/wizard/data/datasources/wizard_remote_datasource.dart';
import '../../features/wizard/data/repositories/wizard_repository_impl.dart';
import '../../features/wizard/domain/repositories/wizard_repository.dart';
import '../../features/wizard/domain/usecases/wizard_usecase.dart';
import '../environments/app_env.dart';
import '../environments/dev_environment.dart';
import '../environments/env_config.dart';
import '../environments/prod_environment.dart';
import '../network/app_network.dart';
import '../network/dio_factory.dart';
import '../network/network_interface.dart';
import '../storage/customer_session_storage.dart';

final GetIt getIt = GetIt.instance;

/// Manual DI graph. Wires env / network / storage / data / domain only —
/// presentation layer is intentionally absent (feature UIs are rebuilt
/// post-Figma). Switch to `injectable` codegen once the presentation
/// tier returns.
Future<void> configureDependencies({required bool prod}) async {
  // -- Env + storage -----------------------------------------------------
  final envConfig = prod ? EnvConfig.prod() : EnvConfig.dev();
  getIt.registerSingleton<EnvConfig>(envConfig);
  getIt.registerSingleton<AppEnv>(
    AppEnv(prod ? ProdEnvironment() : DevEnvironment()),
  );
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
  getIt.registerLazySingleton<BaseNetwork>(() => AppNetwork(getIt()));

  // -- Auth feature (legacy v1.7.0 + feature 008 — Constitution v1.8.0). --
  //    Single datasource + single repository impl wired to BOTH the
  //    AuthRepository and CustomerAuthRepository interfaces.
  getIt.registerLazySingleton(() => AuthRemoteDataSource(getIt<BaseNetwork>()));
  getIt.registerLazySingleton(
    () => AuthRepositoryImpl(getIt<AuthRemoteDataSource>()),
  );
  getIt.registerLazySingleton<AuthRepository>(() => getIt<AuthRepositoryImpl>());
  getIt.registerLazySingleton<CustomerAuthRepository>(
    () => getIt<AuthRepositoryImpl>(),
  );
  getIt.registerLazySingleton(
    () => AuthUseCase(getIt<AuthRepository>(), getIt<CustomerSessionStorage>()),
  );

  // -- Wizard feature (data + domain only) -------------------------------
  getIt.registerLazySingleton(() => WizardRemoteDataSource(getIt<BaseNetwork>()));
  getIt.registerLazySingleton<WizardRepository>(
    () => WizardRepositoryImpl(getIt<WizardRemoteDataSource>()),
  );
  getIt.registerLazySingleton(() => WizardUseCase(getIt<WizardRepository>()));

  // -- Feature 008 — native social SDK service + cubit factories ---------
  // Principle XXVIII: third-party SDK handles routed through `get_it`,
  // never instantiated inside services.
  getIt.registerLazySingleton<GoogleSignIn>(() => GoogleSignIn());
  getIt.registerLazySingleton(
    () => SocialSignInService(getIt<GoogleSignIn>()),
  );
  getIt.registerFactory(() => PhoneSignupCubit(getIt<CustomerAuthRepository>()));
  getIt.registerFactory(() => LoginCubit(getIt<AuthRepository>()));
  getIt.registerFactory(
    () => SocialSignInCubit(
      getIt<CustomerAuthRepository>(),
      getIt<SocialSignInService>(),
    ),
  );
  getIt.registerFactory(() => ForgotPasswordCubit(getIt<CustomerAuthRepository>()));
  getIt.registerFactory(() => CompleteProfileCubit(getIt<CustomerAuthRepository>()));
}
