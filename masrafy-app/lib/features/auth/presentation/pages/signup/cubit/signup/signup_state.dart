part of 'signup_cubit.dart';

/// Editable fields on the Create-Account form (Principle XXXI `updateField`).
enum SignupField {
  firstName,
  lastName,
  dialCode,
  phone,
  email,
  birthday,
  password,
  confirmPassword,
  terms,
}

@freezed
class SignupState with _$SignupState {
  const factory SignupState({
    @Default('') String firstName,
    @Default('') String lastName,
    @Default('+20') String dialCode,
    @Default('') String phone,
    @Default('') String email,
    DateTime? birthday,
    @Default('') String password,
    @Default('') String confirmPassword,
    @Default(false) bool agreedToTerms,
    @Default(true) bool obscure,
    @Default(true) bool obscureConfirm,
    @Default(RequestState.initial) RequestState status,
    Failure? error,
    OtpChallengeEntity? challenge,
  }) = _SignupState;

  const SignupState._();

  /// Full number sent to the backend (dial code + national digits).
  String get fullPhone => '$dialCode$phone';

  /// Age derived from the birthday (Principle XXXVII / A31 — never stored).
  int? get age {
    final b = birthday;
    if (b == null) return null;
    final now = DateTime.now();
    var years = now.year - b.year;
    if (now.month < b.month || (now.month == b.month && now.day < b.day)) {
      years--;
    }
    return years;
  }

  bool get isBusy => status.isLoading;
  bool get isFailure => status.isError && error != null;

  /// Emitted once `signupPhoneStart` succeeds — the page navigates to OTP.
  bool get challengeReady => status.isLoaded && challenge != null;

  bool get _passwordStrong => Validators.strongPassword(password) == null;
  bool get _confirmMatches =>
      confirmPassword.isNotEmpty && confirmPassword == password;
  bool get _phoneValid => Validators.phoneNumber(phone) == null;
  bool get _emailOk => email.isEmpty || Validators.email(email) == null;
  bool get _ageOk => (age ?? 0) >= 18 && (age ?? 0) <= 80;

  bool get canSubmit =>
      firstName.trim().isNotEmpty &&
      lastName.trim().isNotEmpty &&
      _phoneValid &&
      _emailOk &&
      birthday != null &&
      _ageOk &&
      _passwordStrong &&
      _confirmMatches &&
      agreedToTerms &&
      !status.isLoading;

  /// Snapshot carried to the OTP screen so it can complete the signup once the
  /// mobile is verified.
  SignupDraft toDraft() => SignupDraft(
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        phone: fullPhone,
        password: password,
        birthday: birthday!,
        email: email.trim().isEmpty ? null : email.trim(),
      );
}
