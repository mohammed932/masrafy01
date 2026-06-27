import 'package:bloc/bloc.dart';
import 'package:freezed_annotation/freezed_annotation.dart';
import 'package:injectable/injectable.dart';

part 'settings_security_state.dart';
part 'settings_security_cubit.freezed.dart';

/// Toggle fields on the Settings & Security screen (Principle XXXI / A28).
enum SettingsSecurityField { biometric, notifications }

/// Screen-scoped cubit for Settings & Security. UI-only mock: there is no
/// biometric/push backend yet, so toggles flip local state only. Language is
/// handled app-wide by `LocaleCubit`, not here.
@injectable
class SettingsSecurityCubit extends Cubit<SettingsSecurityState> {
  SettingsSecurityCubit() : super(const SettingsSecurityState());

  /// Exhaustive over [SettingsSecurityField]; no `default:`.
  void updateField(SettingsSecurityField field, Object value) {
    switch (field) {
      case SettingsSecurityField.biometric:
        emit(state.copyWith(biometricEnabled: value as bool));
      case SettingsSecurityField.notifications:
        emit(state.copyWith(notificationsEnabled: value as bool));
    }
  }
}
