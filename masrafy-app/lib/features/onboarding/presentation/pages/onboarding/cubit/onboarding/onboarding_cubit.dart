import 'package:bloc/bloc.dart';
import 'package:freezed_annotation/freezed_annotation.dart';
import 'package:injectable/injectable.dart';

import 'package:app/core/cache/shared_prefs_service.dart';
import 'package:app/core/enums/storage_keys.dart';

part 'onboarding_cubit.freezed.dart';
part 'onboarding_state.dart';

/// First-launch intro carousel (Figma `71:256` / `71:188` / `71:221`).
/// Tracks the active slide for the stepper + button mode, and persists the
/// `onboardingCompleted` flag (Skip or Sign-in) so the splash gate skips
/// onboarding on subsequent launches. Orchestration only — the actual
/// PageView animation is owned by the view (Principle XXXI).
@injectable
class OnboardingCubit extends Cubit<OnboardingState> {
  OnboardingCubit(this._prefs) : super(const OnboardingState());

  final SharedPrefsService _prefs;

  void pageChanged(int index) => emit(state.copyWith(pageIndex: index));

  /// Marks onboarding done and signals the view to route to Login.
  Future<void> finish() async {
    await _prefs.setString(StorageKeys.onboardingCompleted.name, 'true');
    emit(state.copyWith(completed: true));
  }
}
