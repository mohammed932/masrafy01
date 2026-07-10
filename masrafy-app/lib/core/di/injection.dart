import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:get_it/get_it.dart';
import 'package:local_auth/local_auth.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../cache/shared_prefs_service.dart';
import '../environments/app_env.dart';
import '../environments/base_environment.dart';
import '../environments/dev_environment.dart';
import '../features/biometric/data/biometric_storage.dart';
import '../features/biometric/domain/biometric_service.dart';
import '../features/biometric/presentation/cubit/biometric_gate_cubit.dart';
import '../locale/locale_cubit/locale_cubit.dart';
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
import 'package:app/features/auth/presentation/pages/complete_profile/cubit/complete_profile/complete_profile_cubit.dart';
import 'package:app/features/auth/presentation/pages/login/cubit/login/login_cubit.dart';
import 'package:app/features/auth/presentation/pages/otp/cubit/otp/otp_cubit.dart';
import 'package:app/features/auth/presentation/pages/signup/cubit/signup/signup_cubit.dart';
import 'package:app/features/home/presentation/pages/home/cubit/home/home_cubit.dart';
import 'package:app/features/questionnaire/data/datasources/questionnaire_remote_datasource.dart';
import 'package:app/features/questionnaire/data/repositories/questionnaire_repository_impl.dart';
import 'package:app/features/questionnaire/domain/repositories/questionnaire_repository.dart';
import 'package:app/features/questionnaire/domain/usecases/questionnaire_usecase.dart';
import 'package:app/features/questionnaire/presentation/pages/dynamic/questionnaire_cubit.dart';
import 'package:app/features/questionnaire/presentation/pages/business/cubit/business_questionnaire/business_questionnaire_cubit.dart';
import 'package:app/features/questionnaire/presentation/pages/car/cubit/car_questionnaire/car_questionnaire_cubit.dart';
import 'package:app/features/questionnaire/presentation/pages/mortgage/cubit/mortgage_questionnaire/mortgage_questionnaire_cubit.dart';
import 'package:app/features/onboarding/presentation/pages/onboarding/cubit/onboarding/onboarding_cubit.dart';
import 'package:app/features/profile/presentation/pages/profile/cubit/profile/profile_cubit.dart';
import 'package:app/features/applications/data/datasources/applications_remote_datasource.dart';
import 'package:app/features/applications/data/repositories/applications_repository_impl.dart';
import 'package:app/features/applications/domain/repositories/applications_repository.dart';
import 'package:app/features/applications/domain/usecases/applications_usecase.dart';
import 'package:app/features/applications/presentation/pages/previous_applications/cubit/previous_applications/previous_applications_cubit.dart';
import 'package:app/features/saved_offers/data/datasources/saved_offers_remote_datasource.dart';
import 'package:app/features/saved_offers/data/repositories/saved_offers_repository_impl.dart';
import 'package:app/features/saved_offers/domain/repositories/saved_offers_repository.dart';
import 'package:app/features/saved_offers/domain/usecases/saved_offers_usecase.dart';
import 'package:app/features/saved_offers/presentation/pages/saved_offers/cubit/saved_offers/saved_offers_cubit.dart';
import 'package:app/features/matching/data/datasources/matching_remote_datasource.dart';
import 'package:app/features/matching/data/repositories/matching_repository_impl.dart';
import 'package:app/features/matching/domain/repositories/matching_repository.dart';
import 'package:app/features/matching/domain/usecases/matching_usecase.dart';
import 'package:app/features/offers/presentation/pages/results/cubit/matching_results/matching_results_cubit.dart';
import 'package:app/features/offers/presentation/pages/offer_details/cubit/save_offer/save_offer_cubit.dart';
import 'package:app/features/offers/presentation/pages/offer_details/cubit/select_offer/select_offer_cubit.dart';
import 'package:app/features/profile/presentation/pages/profile/cubit/profile_edit_contact/profile_edit_contact_cubit.dart';
import 'package:app/features/profile/presentation/pages/profile/cubit/profile_edit_personal/profile_edit_personal_cubit.dart';
import 'package:app/features/splash/presentation/pages/splash/cubit/splash/splash_cubit.dart';
import 'package:app/features/account/presentation/pages/settings_security/cubit/settings_security/settings_security_cubit.dart';

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

  // -- Biometric login (Face ID / fingerprint) ----------------------------
  getIt.registerLazySingleton<LocalAuthentication>(() => LocalAuthentication());
  getIt.registerLazySingleton<BiometricStorage>(
    () => BiometricStorage(getIt<FlutterSecureStorage>()),
  );
  getIt.registerLazySingleton<BiometricService>(
    () => BiometricService(getIt<LocalAuthentication>(), getIt<BiometricStorage>()),
  );
  getIt.registerLazySingleton<BiometricGateCubit>(
    () => BiometricGateCubit(
      getIt<BiometricService>(),
      getIt<CustomerSessionStorage>(),
    ),
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

  // -- Locale (app-wide UI language; same instance feeds MaterialApp + settings)
  getIt.registerLazySingleton<LocaleCubit>(
    () => LocaleCubit(getIt<SharedPrefsService>()),
  );

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
  getIt.registerFactory(
    () => CompleteProfileCubit(
      getIt<AuthUseCase>(),
      getIt<CustomerAuthUseCase>(),
    ),
  );

  // splash gate + onboarding
  getIt.registerFactory(
    () => SplashCubit(
      getIt<CustomerSessionStorage>(),
      getIt<SharedPrefsService>(),
      getIt<AppEnv>(),
      getIt<AuthUseCase>(),
    ),
  );
  getIt.registerFactory(() => OnboardingCubit(getIt<SharedPrefsService>()));

  // home
  getIt.registerFactory(() => HomeCubit());

  // questionnaire — personal is backend-driven via the generic dynamic renderer
  // (QuestionnaireCubit fetches the published snapshot); car / mortgage /
  // business still use their bespoke static-lookup cubits until migrated.
  // Screen-scoped cubits (Principle XXXI).
  getIt.registerLazySingleton(
    () => QuestionnaireRemoteDataSource(getIt<BaseNetwork>()),
  );
  getIt.registerLazySingleton<QuestionnaireRepository>(
    () => QuestionnaireRepositoryImpl(getIt<QuestionnaireRemoteDataSource>()),
  );
  getIt.registerLazySingleton(
    () => QuestionnaireUseCase(getIt<QuestionnaireRepository>()),
  );
  getIt.registerFactory(() => QuestionnaireCubit(getIt<QuestionnaireUseCase>()));
  getIt.registerFactory(() => MortgageQuestionnaireCubit());
  getIt.registerFactory(() => CarQuestionnaireCubit());
  getIt.registerFactory(() => BusinessQuestionnaireCubit());

  // profile — view + two edit screens (UI-only mock; no datasource/repo yet,
  // see plan). Screen-scoped (Principle XXXI).
  getIt.registerFactory(() => ProfileCubit());
  getIt.registerFactory(() => ProfileEditPersonalCubit());
  getIt.registerFactory(() => ProfileEditContactCubit());

  // saved offers — list + save + unsave (backend-wired). Screen-scoped cubits.
  getIt.registerLazySingleton(
    () => SavedOffersRemoteDataSource(getIt<BaseNetwork>()),
  );
  getIt.registerLazySingleton<SavedOffersRepository>(
    () => SavedOffersRepositoryImpl(getIt<SavedOffersRemoteDataSource>()),
  );
  getIt.registerLazySingleton(
    () => SavedOffersUseCase(getIt<SavedOffersRepository>()),
  );
  getIt.registerFactory(() => SavedOffersCubit(getIt<SavedOffersUseCase>()));
  getIt.registerFactory(() => SaveOfferCubit(getIt<SavedOffersUseCase>()));

  // applications — "Applications" screen list (backend-wired). Screen-scoped cubit.
  getIt.registerLazySingleton(
    () => ApplicationsRemoteDataSource(getIt<BaseNetwork>()),
  );
  getIt.registerLazySingleton<ApplicationsRepository>(
    () => ApplicationsRepositoryImpl(getIt<ApplicationsRemoteDataSource>()),
  );
  getIt.registerLazySingleton(
    () => ApplicationsUseCase(getIt<ApplicationsRepository>()),
  );
  getIt.registerFactory(
    () => PreviousApplicationsCubit(getIt<ApplicationsUseCase>()),
  );

  // matching — apply (real offers) + select-offer (proceed). Data-layer
  // lazySingletons; screen-scoped cubits (Principle XXXI). MatchingResultsCubit
  // reads the profile age via AuthUseCase before calling /apply.
  getIt.registerLazySingleton(
    () => MatchingRemoteDataSource(getIt<BaseNetwork>()),
  );
  getIt.registerLazySingleton<MatchingRepository>(
    () => MatchingRepositoryImpl(getIt<MatchingRemoteDataSource>()),
  );
  getIt.registerLazySingleton(
    () => MatchingUseCase(getIt<MatchingRepository>()),
  );
  getIt.registerFactory(
    () => MatchingResultsCubit(getIt<MatchingUseCase>(), getIt<AuthUseCase>()),
  );
  getIt.registerFactory(() => SelectOfferCubit(getIt<MatchingUseCase>()));

  // account — settings & security (UI-only mock; toggles flip local state).
  // Screen-scoped (Principle XXXI).
  getIt.registerFactory(() => SettingsSecurityCubit(getIt<BiometricService>()));
}
