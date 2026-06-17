import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:get_it/get_it.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../cache/shared_prefs_service.dart';
import '../environments/app_env.dart';
import '../environments/base_environment.dart';
import '../environments/dev_environment.dart';
import '../network/app_network.dart';
import '../network/dio_factory.dart';
import '../network/network_interface.dart';
import '../router/router.dart';
import '../storage/customer_session_storage.dart';
import '../theme/theme_bloc/theme_bloc.dart';

import 'package:app/features/auth/data/datasources/auth_remote_datasource.dart';
import 'package:app/features/auth/data/repositories/auth_repository_impl.dart';
import 'package:app/features/auth/data/repositories/customer_auth_repository_impl.dart';
import 'package:app/features/auth/domain/repositories/auth_repository.dart';
import 'package:app/features/auth/domain/repositories/customer_auth_repository.dart';
import 'package:app/features/auth/domain/usecases/auth_usecase.dart';
import 'package:app/features/auth/domain/usecases/customer_auth_usecase.dart';
import 'package:app/features/auth/presentation/pages/login/cubit/login/login_cubit.dart';
import 'package:app/features/auth/presentation/pages/otp/cubit/otp/otp_cubit.dart';
import 'package:app/features/auth/presentation/pages/signup/cubit/signup/signup_cubit.dart';
import 'package:app/features/home/presentation/pages/home/cubit/home/home_cubit.dart';
import 'package:app/features/questionnaire/presentation/pages/mortgage/cubit/mortgage_questionnaire/mortgage_questionnaire_cubit.dart';
import 'package:app/features/onboarding/presentation/pages/onboarding/cubit/onboarding/onboarding_cubit.dart';
import 'package:app/features/splash/presentation/pages/splash/cubit/splash/splash_cubit.dart';

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

  // -- Theme -------------------------------------------------------------
  final prefs = await SharedPreferences.getInstance();
  getIt.registerSingleton<SharedPrefsService>(SharedPrefsService(prefs));
  getIt.registerFactory<ThemeBloc>(() => ThemeBloc(getIt<SharedPrefsService>()));

  // -- Features (bottom-up: datasource → repo → usecase → cubit) ---------
  // auth
  getIt.registerLazySingleton(
    () => AuthRemoteDataSource(getIt<BaseNetwork>()),
  );
  getIt.registerLazySingleton<AuthRepository>(
    () => AuthRepositoryImpl(getIt<AuthRemoteDataSource>()),
  );
  getIt.registerLazySingleton(
    () => AuthUseCase(getIt<AuthRepository>(), getIt<CustomerSessionStorage>()),
  );
  getIt.registerFactory(() => LoginCubit(getIt<AuthUseCase>()));

  // customer auth (PHONE two-path registration: start → OTP → complete)
  getIt.registerLazySingleton<CustomerAuthRepository>(
    () => CustomerAuthRepositoryImpl(getIt<AuthRemoteDataSource>()),
  );
  getIt.registerLazySingleton(
    () => CustomerAuthUseCase(
      getIt<CustomerAuthRepository>(),
      getIt<CustomerSessionStorage>(),
    ),
  );
  getIt.registerFactory(() => SignupCubit(getIt<CustomerAuthUseCase>()));
  getIt.registerFactory(() => OtpCubit(getIt<CustomerAuthUseCase>()));

  // splash gate + onboarding
  getIt.registerFactory(
    () => SplashCubit(
      getIt<CustomerSessionStorage>(),
      getIt<SharedPrefsService>(),
      getIt<AppEnv>(),
    ),
  );
  getIt.registerFactory(() => OnboardingCubit(getIt<SharedPrefsService>()));

  // home
  getIt.registerFactory(() => HomeCubit());

  // questionnaire — mortgage group (UI-only; local static lookups, no
  // datasource/repo yet — see plan). Screen-scoped factory (Principle XXXI).
  getIt.registerFactory(() => MortgageQuestionnaireCubit());
}
