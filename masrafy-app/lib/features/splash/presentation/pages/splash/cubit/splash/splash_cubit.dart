import 'package:bloc/bloc.dart';
import 'package:freezed_annotation/freezed_annotation.dart';
import 'package:injectable/injectable.dart';

import 'package:app/core/cache/shared_prefs_service.dart';
import 'package:app/core/enums/storage_keys.dart';
import 'package:app/core/environments/app_env.dart';
import 'package:app/core/storage/customer_session_storage.dart';
import 'package:app/features/auth/domain/usecases/auth_usecase.dart';

part 'splash_cubit.freezed.dart';
part 'splash_state.dart';

/// Startup gate. Resolves the initial destination from persisted state
/// (Constitution: tokens live only in secure storage, XXVIII):
///   • valid session, profile complete   → Home
///   • valid session, profile incomplete → Login (session dropped)
///   • token present but session dead     → Login
///   • no token, onboarding done/disabled → Login
///   • otherwise                          → Onboarding
///
/// A persisted access token is *validated* (not merely sniffed) via `me()`:
/// a 401 is silently refreshed by the Dio interceptor, and an unrecoverable
/// failure clears the session — so a stale 15-min token can no longer drop a
/// returning user onto a broken Home. A minimum dwell keeps the splash
/// animation legible instead of flashing. The view performs the actual
/// `replaceAll` so the page stays UI-only (XXXVI) and the cubit stays
/// orchestration-only (XXXI).
@injectable
class SplashCubit extends Cubit<SplashState> {
  SplashCubit(this._session, this._prefs, this._env, this._auth)
      : super(const SplashState());

  final CustomerSessionStorage _session;
  final SharedPrefsService _prefs;
  final AppEnv _env;
  final AuthUseCase _auth;

  static const _minDwell = Duration(milliseconds: 900);

  Future<void> decide() async {
    final sw = Stopwatch()..start();
    final destination = await _resolve();
    final remaining = _minDwell - sw.elapsed;
    if (remaining > Duration.zero) {
      await Future<void>.delayed(remaining);
    }
    emit(state.copyWith(destination: destination));
  }

  Future<SplashDestination> _resolve() async {
    final token = await _session.readAccessToken();
    if (token == null || token.isEmpty) {
      final onboarded =
          _prefs.getString(StorageKeys.onboardingCompleted.name) == 'true';
      return (onboarded || !_env.environment.onboardingEnabled)
          ? SplashDestination.login
          : SplashDestination.onboarding;
    }

    final result = await _auth.me();
    return result.fold(
      // me() failed: if the interceptor cleared the session it's gone → Login.
      // If the token survives (e.g. offline / non-auth error) keep the user in
      // — Home will re-validate on its first protected call.
      (_) async {
        final surviving = await _session.readAccessToken();
        return (surviving != null && surviving.isNotEmpty)
            ? SplashDestination.home
            : SplashDestination.login;
      },
      // Only a finished account resumes straight into the app. Onboarding
      // screens — phone entry and Complete-Profile — are reached ONLY through
      // an explicit sign-in, where `login_page.dart` reads the fresh response
      // and picks between them. So an unfinished account drops its session
      // here and starts at Login instead of resuming a step cold.
      (customer) async {
        if (customer.profileComplete) return SplashDestination.home;
        await _auth.logout();
        return SplashDestination.login;
      },
    );
  }
}
