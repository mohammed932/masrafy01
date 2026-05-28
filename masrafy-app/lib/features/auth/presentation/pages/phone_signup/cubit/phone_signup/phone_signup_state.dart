part of 'phone_signup_cubit.dart';

enum PhoneSignupField {
  phone,
  otpCode,
  locale,
  name,
  email,
  password,
  age,
}

enum PhoneSignupStep {
  idle,
  requestingOtp,
  otpSent,
  verifyingOtp,
  mobileVerified,
  submittingProfile,
  success,
}

@freezed
class PhoneSignupState with _$PhoneSignupState {
  const factory PhoneSignupState({
    // Form fields
    @Default('') String phone,
    @Default('') String otpCode,
    @Default('en') String locale,
    @Default('') String name,
    @Default('') String email,
    @Default('') String password,
    int? age,

    // Flow tracking
    @Default(PhoneSignupStep.idle) PhoneSignupStep step,
    @Default(RequestState.initial) RequestState status,
    OtpChallengeEntity? challenge,
    String? verifiedMobileToken,
    String? verifiedPhone,
    CustomerSessionEntity? session,
    Failure? error,
  }) = _PhoneSignupState;

  // ignore: unused_element
  const PhoneSignupState._();

  bool get otpSent => challenge != null;
  bool get mobileVerified => verifiedMobileToken != null;
  bool get isSignedIn => session != null;

  bool get isRequestingOtp =>
      status.isLoading && step == PhoneSignupStep.requestingOtp;
  bool get isVerifyingOtp =>
      status.isLoading && step == PhoneSignupStep.verifyingOtp;
  bool get isSubmittingProfile =>
      status.isLoading && step == PhoneSignupStep.submittingProfile;
  bool get isFailure => status.isError && error != null;
}
