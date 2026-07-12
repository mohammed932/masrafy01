part of 'change_password_cubit.dart';

/// Editable fields on the Change-Password form (Principle XXXI).
enum ChangePasswordField { currentPassword, newPassword, confirmPassword }

@freezed
class ChangePasswordState with _$ChangePasswordState {
  const factory ChangePasswordState({
    @Default('') String currentPassword,
    @Default('') String newPassword,
    @Default('') String confirmPassword,
    @Default(true) bool obscureCurrent,
    @Default(true) bool obscureNew,
    @Default(true) bool obscureConfirm,
    @Default(RequestState.initial) RequestState status,
    Failure? error,
  }) = _ChangePasswordState;

  const ChangePasswordState._();

  bool get isBusy => status.isLoading;
  bool get isSuccess => status.isLoaded;

  /// Backend policy requires ≥ 12 chars plus complexity (upper/lower/digit/
  /// special) — [Validators.strongPassword] enforces complexity, we add the
  /// 12-char floor so the client matches the server.
  bool get _newPasswordOk =>
      newPassword.length >= 12 && Validators.strongPassword(newPassword) == null;

  bool get _confirmOk => confirmPassword == newPassword;

  /// The new password must differ from the current one (server: PASSWORD_SAME_AS_OLD).
  bool get _differsFromCurrent => newPassword != currentPassword;

  bool get canSubmit =>
      currentPassword.isNotEmpty &&
      _newPasswordOk &&
      _confirmOk &&
      _differsFromCurrent &&
      !status.isLoading;
}
