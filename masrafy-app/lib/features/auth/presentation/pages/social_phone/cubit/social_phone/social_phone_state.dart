part of 'social_phone_cubit.dart';

/// Editable fields on the SOCIAL phone-entry form (Principle XXXI `updateField`).
enum SocialPhoneField { dialCode, phone }

@freezed
class SocialPhoneState with _$SocialPhoneState {
  const factory SocialPhoneState({
    @Default('+20') String dialCode,
    @Default('') String phone,
    @Default(RequestState.initial) RequestState status,
    Failure? error,
    OtpChallengeEntity? challenge,
  }) = _SocialPhoneState;

  const SocialPhoneState._();

  /// Full number sent to the backend (dial code + national digits).
  String get fullPhone => '$dialCode$phone';

  bool get isBusy => status.isLoading;
  bool get isFailure => status.isError && error != null;

  /// Emitted once the OTP is issued — the page navigates to the OTP screen.
  bool get challengeReady => status.isLoaded && challenge != null;

  bool get _phoneValid => Validators.phoneNumber(phone) == null;

  bool get canSubmit => _phoneValid && !status.isLoading;
}
