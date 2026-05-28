part of 'forgot_password_cubit.dart';

enum ForgotPasswordField { phone, otpCode, newPassword, locale }

/// Tracks which sub-step of the forgot-password flow is current. Decoupled
/// from [RequestState] (which is the in-flight indicator) so the UI can know
/// where it is in the funnel regardless of whether a request is loading.
enum ForgotPasswordStep {
  idle,
  requestingOtp,
  otpSent,
  verifying,
  tokenIssued,
  resetting,
  success,
}

@freezed
class ForgotPasswordState with _$ForgotPasswordState {
  const factory ForgotPasswordState({
    @Default('') String phone,
    @Default('') String otpCode,
    @Default('') String newPassword,
    @Default('en') String locale,
    @Default(ForgotPasswordStep.idle) ForgotPasswordStep step,
    @Default(RequestState.initial) RequestState status,
    OtpChallengeEntity? challenge,
    String? passwordResetToken,
    CustomerSessionEntity? session,
    Failure? error,
  }) = _ForgotPasswordState;

  // ignore: unused_element
  const ForgotPasswordState._();

  bool get otpSent => challenge != null;
  bool get tokenIssued => passwordResetToken != null;
  bool get isSignedIn => session != null;

  bool get isRequestingOtp =>
      status.isLoading && step == ForgotPasswordStep.requestingOtp;
  bool get isVerifying =>
      status.isLoading && step == ForgotPasswordStep.verifying;
  bool get isResetting =>
      status.isLoading && step == ForgotPasswordStep.resetting;
  bool get isFailure => status.isError && error != null;
}
