part of 'forgot_password_cubit.dart';

/// The three internal steps of the single forgot-password screen.
enum ForgotPasswordStep { phone, otp, newPassword }

@freezed
class ForgotPasswordState with _$ForgotPasswordState {
  const factory ForgotPasswordState({
    @Default(ForgotPasswordStep.phone) ForgotPasswordStep step,
    @Default('+20') String dialCode,
    @Default('') String phone,
    OtpChallengeEntity? challenge,
    @Default('') String code,
    String? passwordResetToken,
    @Default('') String newPassword,
    @Default('') String confirmPassword,
    @Default(true) bool obscureNew,
    @Default(true) bool obscureConfirm,
    @Default(0) int secondsRemaining,
    @Default(3) int attemptsLeft,
    @Default(RequestState.initial) RequestState status,
    Failure? error,
  }) = _ForgotPasswordState;

  const ForgotPasswordState._();

  static const int codeLength = 6;

  String get fullPhone => '$dialCode$phone';

  String get maskedDestination => challenge?.maskedPhone ?? fullPhone;

  bool get isBusy => status.isLoading;

  /// Success = the reset call landed (step 3 completed).
  bool get isSuccess =>
      status.isLoaded && step == ForgotPasswordStep.newPassword;

  bool get isFailure => status.isError && error != null;

  bool get _phoneValid => Validators.phoneNumber(phone) == null;

  bool get _newPasswordValid =>
      Validators.strongPassword(newPassword) == null && newPassword.length >= 12;

  bool get canSendCode => _phoneValid && !status.isLoading;

  bool get canVerify => code.length == codeLength && !status.isLoading;

  bool get canResend => secondsRemaining <= 0 && !status.isLoading;

  bool get canSubmit =>
      _newPasswordValid &&
      confirmPassword == newPassword &&
      !status.isLoading;
}
