import 'package:bloc/bloc.dart';
import 'package:freezed_annotation/freezed_annotation.dart';
import 'package:injectable/injectable.dart';

import 'package:app/core/cache/shared_prefs_service.dart';
import 'package:app/core/enums/storage_keys.dart';
import 'package:app/core/environments/app_env.dart';
import 'package:app/core/storage/customer_session_storage.dart';

part 'splash_cubit.freezed.dart';
part 'splash_state.dart';

/// Startup gate. Resolves the initial destination from persisted state
/// (Constitution: tokens live only in secure storage, XXVIII):
///   • customer JWT present            → Home
///   • onboarding done / flag disabled → Login
///   • otherwise                       → Onboarding
/// The view performs the actual `replaceAll` so the page stays UI-only
/// (Principle XXXVI) and the cubit stays orchestration-only (XXXI).
@injectable
class SplashCubit extends Cubit<SplashState> {
  SplashCubit(this._session, this._prefs, this._env)
      : super(const SplashState());

  final CustomerSessionStorage _session;
  final SharedPrefsService _prefs;
  final AppEnv _env;

  Future<void> decide() async {
    final token = await _session.readAccessToken();
    if (token != null && token.isNotEmpty) {
      emit(state.copyWith(destination: SplashDestination.home));
      return;
    }
    final onboarded =
        _prefs.getString(StorageKeys.onboardingCompleted.name) == 'true';
    if (onboarded || !_env.environment.onboardingEnabled) {
      emit(state.copyWith(destination: SplashDestination.login));
      return;
    }
    emit(state.copyWith(destination: SplashDestination.onboarding));
  }
}
