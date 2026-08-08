import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:get_it/get_it.dart';
import 'package:local_auth/local_auth.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../cache/shared_prefs_service.dart';
import '../enums/storage_keys.dart';
import '../environments/app_env.dart';
import '../environments/base_environment.dart';
import '../environments/dev_environment.dart';
import '../features/biometric/data/biometric_storage.dart';
import '../features/platform_enumerations/data/datasources/platform_enumerations_remote_datasource.dart';
import '../features/platform_enumerations/data/repositories/platform_enumerations_repository_impl.dart';
import '../features/platform_enumerations/domain/repositories/platform_enumerations_repository.dart';
import '../features/platform_enumerations/domain/usecases/platform_enumerations_usecase.dart';
import '../features/biometric/domain/biometric_service.dart';
import '../features/biometric/presentation/cubit/biometric_gate_cubit.dart';
import '../locale/locale_cubit/locale_cubit.dart';
import '../network/app_network.dart';
import '../network/dio_factory.dart';
import '../network/network_interface.dart';
import '../router/router.dart';
import '../services/google_signin_service.dart';
import '../storage/customer_session_storage.dart';
import '../theme/theme_bloc/theme_bloc.dart';

import 'package:app/features/auth/data/datasources/auth_remote_datasource.dart';
import 'package:app/features/auth/data/repositories/auth_repository_impl.dart';
import 'package:app/features/auth/data/repositories/customer_auth_repository_impl.dart';
import 'package:app/features/auth/domain/repositories/auth_repository.dart';
import 'package:app/features/auth/domain/repositories/customer_auth_repository.dart';
import 'package:app/features/auth/domain/usecases/auth_usecase.dart';
import 'package:app/features/auth/domain/usecases/customer_auth_usecase.dart';
import 'package:app/features/auth/presentation/pages/apply_documents/cubit/apply_documents/apply_documents_cubit.dart';
import 'package:app/features/auth/presentation/pages/change_password/cubit/change_password/change_password_cubit.dart';
import 'package:app/features/auth/presentation/pages/complete_profile/cubit/complete_profile/complete_profile_cubit.dart';
import 'package:app/features/auth/presentation/pages/forgot_password/cubit/forgot_password/forgot_password_cubit.dart';
import 'package:app/features/auth/presentation/pages/login/cubit/login/login_cubit.dart';
import 'package:app/features/auth/presentation/pages/otp/cubit/otp/otp_cubit.dart';
import 'package:app/features/auth/presentation/pages/signup/cubit/signup/signup_cubit.dart';
import 'package:app/features/auth/presentation/pages/social_phone/cubit/social_phone/social_phone_cubit.dart';
import 'package:app/features/home/presentation/pages/home/cubit/home/home_cubit.dart';
import 'package:app/features/questionnaire/data/datasources/questionnaire_remote_datasource.dart';
import 'package:app/features/questionnaire/data/repositories/questionnaire_repository_impl.dart';
import 'package:app/features/questionnaire/domain/repositories/questionnaire_repository.dart';
import 'package:app/features/questionnaire/domain/usecases/questionnaire_usecase.dart';
import 'package:app/features/questionnaire/presentation/pages/dynamic/questionnaire_cubit.dart';
import 'package:app/features/onboarding/presentation/pages/onboarding/cubit/onboarding/onboarding_cubit.dart';
import 'package:app/features/profile/data/datasources/profile_remote_datasource.dart';
import 'package:app/features/profile/data/repositories/profile_repository_impl.dart';
import 'package:app/features/profile/domain/repositories/profile_repository.dart';
import 'package:app/features/profile/domain/usecases/profile_usecase.dart';
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
      // Device-bound so customer JWTs are excluded from iCloud sync and
      // encrypted backups — a restored / new device won't inherit a prior
      // user's session. Matches SecureStorage (device-id) accessibility.
      iOptions: IOSOptions(
        accessibility: KeychainAccessibility.first_unlock_this_device,
      ),
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

  // Fresh-install guard: the iOS keychain survives app uninstall, so a
  // reinstall (or a backup-restored device) can still hold a previous user's
  // customer JWTs and silently drop them onto Home. SharedPreferences IS
  // cleared on uninstall, so its emptiness marks a genuine first run — wipe
  // the stale session + biometric opt-in once so a first launch starts clean
  // at the Splash → Login gate.
  final prefsService = getIt<SharedPrefsService>();
  if (prefsService.getString(StorageKeys.installInitialized.name) != 'true') {
    await getIt<CustomerSessionStorage>().clear();
    await getIt<BiometricStorage>().setEnabled(false);
    await prefsService.setString(StorageKeys.installInitialized.name, 'true');
  }

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
  getIt.registerLazySingleton<GoogleSignInService>(
    () => GoogleSignInService(
      serverClientId: getIt<AppEnv>().environment.googleServerClientId,
    ),
  );
  getIt.registerFactory(
    () => LoginCubit(
      getIt<AuthUseCase>(),
      getIt<CustomerAuthUseCase>(),
      getIt<GoogleSignInService>(),
    ),
  );

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
  getIt.registerFactory(() => SocialPhoneCubit(getIt<CustomerAuthUseCase>()));
  getIt.registerFactory(() => OtpCubit(getIt<CustomerAuthUseCase>()));
  getIt.registerFactory(() => ChangePasswordCubit(getIt<CustomerAuthUseCase>()));
  getIt.registerFactory(
      () => ForgotPasswordCubit(getIt<CustomerAuthUseCase>()));
  getIt.registerFactory(
    () => CompleteProfileCubit(
      getIt<AuthUseCase>(),
      getIt<CustomerAuthUseCase>(),
    ),
  );
  getIt.registerFactory(
    () => ApplyDocumentsCubit(getIt<CustomerAuthUseCase>()),
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

  // home — reads the `program_name` catalog for the picker that sits beside the
  // loan-category cards (registered lazily further down; resolved on call).
  getIt.registerFactory(() => HomeCubit(getIt<PlatformEnumerationsUseCase>()));

  // questionnaire — personal + mortgage + car are backend-driven via the generic
  // dynamic renderer (QuestionnaireCubit fetches the published snapshot); only
  // business still uses its bespoke static-lookup cubit until migrated.
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

  // platform enumerations — operator-managed lookup lists (governorates,
  // required documents). Singleton so the per-type cache is shared app-wide.
  getIt.registerLazySingleton(
    () => PlatformEnumerationsRemoteDataSource(getIt<BaseNetwork>()),
  );
  getIt.registerLazySingleton<PlatformEnumerationsRepository>(
    () => PlatformEnumerationsRepositoryImpl(
      getIt<PlatformEnumerationsRemoteDataSource>(),
    ),
  );
  getIt.registerLazySingleton(
    () => PlatformEnumerationsUseCase(getIt<PlatformEnumerationsRepository>()),
  );

  // profile — view (backend-wired via GET /api/v1/auth/me) + two edit screens.
  // Screen-scoped (Principle XXXI).
  getIt.registerLazySingleton(
    () => ProfileRemoteDataSource(getIt<BaseNetwork>()),
  );
  getIt.registerLazySingleton<ProfileRepository>(
    () => ProfileRepositoryImpl(getIt<ProfileRemoteDataSource>()),
  );
  getIt.registerLazySingleton(
    () => ProfileUseCase(getIt<ProfileRepository>()),
  );
  getIt.registerFactory(() => ProfileCubit(getIt<ProfileUseCase>()));
  getIt.registerFactory(() => ProfileEditPersonalCubit(
        getIt<CustomerAuthUseCase>(),
        getIt<ProfileUseCase>(),
      ));
  getIt.registerFactory(() => ProfileEditContactCubit(
        getIt<ProfileUseCase>(),
        getIt<PlatformEnumerationsUseCase>(),
      ));

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
  // lazySingletons; screen-scoped cubits (Principle XXXI). The applicant age is
  // derived server-side from the customer's birthday (Principle XXXVII / A31),
  // so the results cubit calls /apply directly — no profile read first.
  getIt.registerLazySingleton(
    () => MatchingRemoteDataSource(getIt<BaseNetwork>()),
  );
  getIt.registerLazySingleton<MatchingRepository>(
    () => MatchingRepositoryImpl(getIt<MatchingRemoteDataSource>()),
  );
  getIt.registerLazySingleton(
    () => MatchingUseCase(getIt<MatchingRepository>()),
  );
  getIt.registerFactory(() => MatchingResultsCubit(getIt<MatchingUseCase>()));
  getIt.registerFactory(() => SelectOfferCubit(getIt<MatchingUseCase>()));

  // account — settings & security (UI-only mock; toggles flip local state).
  // Screen-scoped (Principle XXXI).
  getIt.registerFactory(() => SettingsSecurityCubit(getIt<BiometricService>()));
}
