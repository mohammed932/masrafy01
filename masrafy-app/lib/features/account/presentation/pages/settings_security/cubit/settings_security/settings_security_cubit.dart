import 'package:bloc/bloc.dart';
import 'package:freezed_annotation/freezed_annotation.dart';
import 'package:injectable/injectable.dart';

import 'package:app/core/features/biometric/domain/biometric_auth_result.dart';
import 'package:app/core/features/biometric/domain/biometric_service.dart';

part 'settings_security_state.dart';
part 'settings_security_cubit.freezed.dart';

/// Toggle fields on the Settings & Security screen (Principle XXXI / A28).
enum SettingsSecurityField { notifications }

/// Screen-scoped cubit for Settings & Security. Notifications flips local
/// state only (UI-only mock, no backend yet). Biometric login is real —
/// wired to [BiometricService] — and has its own method since turning it on
/// requires an async device-authenticate step before persisting. Language is
/// handled app-wide by `LocaleCubit`, not here.
@injectable
class SettingsSecurityCubit extends Cubit<SettingsSecurityState> {
  SettingsSecurityCubit(this._biometric) : super(const SettingsSecurityState());

  final BiometricService _biometric;

  Future<void> load() async {
    emit(state.copyWith(biometricEnabled: await _biometric.isEnabled));
  }

  /// Exhaustive over [SettingsSecurityField]; no `default:`.
  void updateField(SettingsSecurityField field, Object value) {
    switch (field) {
      case SettingsSecurityField.notifications:
        emit(state.copyWith(notificationsEnabled: value as bool));
    }
  }

  Future<void> setBiometricEnabled(bool enable, String confirmReason) async {
    if (!enable) {
      await _biometric.setEnabled(false);
      emit(state.copyWith(biometricEnabled: false));
      return;
    }
    if (!await _biometric.isDeviceCapable()) {
      emit(state.copyWith(biometricEnabled: false, biometricUnavailable: true));
      return;
    }
    final result = await _biometric.authenticate(reason: confirmReason);
    final confirmed = result == BiometricAuthResult.success;
    await _biometric.setEnabled(confirmed);
    emit(state.copyWith(biometricEnabled: confirmed));
  }
}
