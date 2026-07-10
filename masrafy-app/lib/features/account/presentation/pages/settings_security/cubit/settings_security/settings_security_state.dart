part of 'settings_security_cubit.dart';

@freezed
class SettingsSecurityState with _$SettingsSecurityState {
  const factory SettingsSecurityState({
    @Default(false) bool biometricEnabled,
    @Default(true) bool notificationsEnabled,
    @Default(false) bool biometricUnavailable,
  }) = _SettingsSecurityState;
}
