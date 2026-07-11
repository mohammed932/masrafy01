part of 'complete_profile_cubit.dart';

/// Editable scalar fields on the Complete-Profile form (Principle XXXI).
enum CompleteProfileField { firstName, lastName, birthday, password }

@freezed
class CompleteProfileState with _$CompleteProfileState {
  const factory CompleteProfileState({
    @Default('') String firstName,
    @Default('') String lastName,
    DateTime? birthday,
    @Default('') String email,
    @Default('') String password,
    @Default(true) bool obscure,
    @Default(RegistrationPath.phone) RegistrationPath registrationPath,
    @Default(false) bool hasPassword,
    Uint8List? photoBytes,
    @Default(false) bool photoUploaded,
    @Default(false) bool photoUploading,
    @Default(false) bool idFrontUploaded,
    @Default(false) bool idFrontUploading,
    @Default(false) bool idBackUploaded,
    @Default(false) bool idBackUploading,
    @Default(RequestState.initial) RequestState loadStatus,
    @Default(RequestState.initial) RequestState status,
    Failure? error,
    CustomerSessionEntity? session,
  }) = _CompleteProfileState;

  const CompleteProfileState._();

  /// PHONE customers set their password here for the first time; SOCIAL never.
  bool get requiresPassword =>
      registrationPath == RegistrationPath.phone && !hasPassword;

  /// Age derived from birthday (Principle XXXVII / A31 — never stored).
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
  bool get isSuccess => status.isLoaded && session != null;

  bool get _ageOk => (age ?? 0) >= 18 && (age ?? 0) <= 80;
  bool get _passwordOk =>
      !requiresPassword || Validators.strongPassword(password) == null;
  bool get _emailOk => email.trim().isEmpty || Validators.email(email) == null;

  /// Profile photo + National ID are OPTIONAL for profile completion
  /// (Constitution v9.0.0) — both are collected later, at the select-offer
  /// commitment point. They remain uploadable here but never block submit.
  bool get nationalIdComplete => idFrontUploaded && idBackUploaded;

  bool get _anyUploading =>
      photoUploading || idFrontUploading || idBackUploading;

  bool get canSubmit =>
      firstName.trim().isNotEmpty &&
      lastName.trim().isNotEmpty &&
      birthday != null &&
      _ageOk &&
      _emailOk &&
      _passwordOk &&
      !_anyUploading &&
      !status.isLoading;
}
