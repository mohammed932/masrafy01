part of 'otp_cubit.dart';

@freezed
class OtpState with _$OtpState {
  const factory OtpState({
    @Default('') String code,
    OtpChallengeEntity? challenge,
    OtpPurpose? purpose,
    SignupDraft? draft,
    @Default(0) int secondsRemaining,
    @Default(3) int attemptsLeft,
    @Default(RequestState.initial) RequestState status,
    Failure? error,
    CustomerSessionEntity? session,
    // Single-use OTP result, retained so a retry after a later-step failure
    // resumes from signup/complete instead of re-verifying the consumed OTP.
    String? verifiedMobileToken,
  }) = _OtpState;

  const OtpState._();

  static const int codeLength = 6;

  String get maskedDestination => challenge?.maskedPhone ?? '';

  bool get isBusy => status.isLoading;
  bool get isSuccess => status.isLoaded && session != null;
  bool get isFailure => status.isError && error != null;

  bool get canVerify => code.length == codeLength && !status.isLoading;
  bool get canResend => secondsRemaining <= 0 && !status.isLoading;
}
