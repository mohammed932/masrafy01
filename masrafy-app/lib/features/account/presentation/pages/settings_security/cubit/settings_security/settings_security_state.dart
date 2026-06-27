part of 'settings_security_cubit.dart';

@freezed
class SettingsSecurityState with _$SettingsSecurityState {
  const factory SettingsSecurityState({
    @Default(true) bool biometricEnabled,
    @Default(true) bool notificationsEnabled,
  }) = _SettingsSecurityState;
}
