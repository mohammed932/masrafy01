part of 'social_signin_cubit.dart';

enum SocialSignInStep {
  idle,
  signingIn,
  existingCustomer,
  exchanging,
  loggedIn,
  cancelled,
}

@freezed
class SocialSignInState with _$SocialSignInState {
  const factory SocialSignInState({
    @Default(SocialSignInStep.idle) SocialSignInStep step,
    @Default(RequestState.initial) RequestState status,
    @Default(false) bool cancelled,
    SocialSessionEntity? socialSession,
    CustomerSessionEntity? customerSession,
    Failure? error,
  }) = _SocialSignInState;

  // ignore: unused_element
  const SocialSignInState._();

  bool get isInProgress => status.isLoading;
  bool get isCancelled => step == SocialSignInStep.cancelled || cancelled;
  bool get hasExistingCustomer =>
      step == SocialSignInStep.existingCustomer && socialSession != null;
  bool get isLoggedIn =>
      step == SocialSignInStep.loggedIn && customerSession != null;
  bool get isFailure => status.isError && error != null;
}
