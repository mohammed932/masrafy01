part of 'otp_cubit.dart';

@freezed
class OtpState with _$OtpState {
  const factory OtpState({
    @Default('') String code,
    OtpChallengeEntity? challenge,
    OtpPurpose? purpose,
    SignupDraft? draft,
    // Raw mobile number, carried for the SOCIAL PROFILE_MOBILE flow so resend
    // can re-issue via `profile/mobile-request-otp` (no SignupDraft there).
    String? phone,
    @Default(0) int secondsRemaining,
    @Default(3) int attemptsLeft,
    @Default(RequestState.initial) RequestState status,
    Failure? error,
    CustomerSessionEntity? session,
    // Single-use OTP result, retained so a retry after a later-step failure
    // resumes from signup/complete instead of re-verifying the consumed OTP.
    String? verifiedMobileToken,
    // A National-ID side captured at signup that did not survive the upload.
    // Deliberately NOT an error: the account is complete without it (Principle
    // XXXVII), so the page still routes Home — it just says the ID needs
    // re-adding instead of losing the capture quietly.
    @Default(false) bool nationalIdUploadFailed,
  }) = _OtpState;

  const OtpState._();

  static const int codeLength = 6;

  String get maskedDestination => challenge?.maskedPhone ?? '';

  bool get isBusy => status.isLoading;
  bool get isSuccess => status.isLoaded && session != null;
  bool get isFailure => status.isError && error != null;

  /// SOCIAL flow: the PROFILE_MOBILE OTP verified and the mobile is now bound.
  /// No session is issued on this path, so [isSuccess] stays false — the page
  /// routes to the Complete-Profile birthday step instead of Home.
  bool get mobileBound =>
      purpose == OtpPurpose.profileMobile && status.isLoaded && error == null;

  bool get canVerify => code.length == codeLength && !status.isLoading;
  bool get canResend => secondsRemaining <= 0 && !status.isLoading;
}
