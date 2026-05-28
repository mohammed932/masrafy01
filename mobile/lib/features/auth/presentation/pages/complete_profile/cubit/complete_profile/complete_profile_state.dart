part of 'complete_profile_cubit.dart';

enum CompleteProfileField { phone, otpCode }

enum CompleteProfileStep {
  idle,
  requestingOtp,
  otpSent,
  verifyingOtp,
  mobileBound,
}

@freezed
class CompleteProfileState with _$CompleteProfileState {
  const factory CompleteProfileState({
    @Default('') String phone,
    @Default('') String otpCode,
    @Default(CompleteProfileStep.idle) CompleteProfileStep step,
    @Default(RequestState.initial) RequestState status,
    OtpChallengeEntity? challenge,
    Failure? error,
  }) = _CompleteProfileState;

  // ignore: unused_element
  const CompleteProfileState._();

  bool get otpSent => challenge != null;
  bool get isMobileBound => step == CompleteProfileStep.mobileBound;

  bool get isRequestingOtp =>
      status.isLoading && step == CompleteProfileStep.requestingOtp;
  bool get isVerifyingOtp =>
      status.isLoading && step == CompleteProfileStep.verifyingOtp;
  bool get isFailure => status.isError && error != null;
}
