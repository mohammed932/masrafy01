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
  }) = _ProfileEditContactState;

  const ProfileEditContactState._();

  /// Phone is required; email must be valid. Governorate / city / address are
  /// optional address detail.
  bool get canSave =>
      phone.trim().isNotEmpty && Validators.email(email) == null;

  ProfileContactDraft toDraft() => ProfileContactDraft(
        dialCode: dialCode,
        phone: phone.trim(),
        email: email.trim(),
        governorate: governorate,
        city: city.trim(),
        address: address.trim(),
      );
}
