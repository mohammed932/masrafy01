part of 'profile_edit_contact_cubit.dart';

/// Edit Contact Details form state. Derivations (`canSave`, draft mapping) live
/// here, not on the cubit (Principle XXXI).
@freezed
class ProfileEditContactState with _$ProfileEditContactState {
  const factory ProfileEditContactState({
    @Default('+20') String dialCode,
    @Default('') String phone,
    @Default('') String email,
    String? governorate,
    @Default('') String city,
    @Default('') String address,

    /// Governorate list from the operator-managed registry, not a hardcoded copy.
    @Default(<PlatformEnumerationEntity>[])
    List<PlatformEnumerationEntity> governorates,
    @Default(false) bool saving,
    Failure? saveError,
    @Default(false) bool saved,
  }) = _ProfileEditContactState;

  const ProfileEditContactState._();

  /// Email must be valid (empty is allowed — email is optional). Phone is
  /// read-only and not part of the save. Blocked while a save is in flight.
  bool get canSave =>
      (email.trim().isEmpty || Validators.email(email) == null) && !saving;

  ProfileContactDraft toDraft() => ProfileContactDraft(
        dialCode: dialCode,
        phone: phone.trim(),
        email: email.trim(),
        governorate: governorate,
        city: city.trim(),
        address: address.trim(),
      );
}
