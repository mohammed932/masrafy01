part of 'profile_edit_personal_cubit.dart';

/// Edit Personal Info form state. Derivations (`canSave`, draft mapping) live
/// here, not on the cubit (Principle XXXI).
@freezed
class ProfileEditPersonalState with _$ProfileEditPersonalState {
  const factory ProfileEditPersonalState({
    @Default('') String firstName,
    @Default('') String lastName,
    DateTime? birthday,
    @Default('') String password,
    @Default(true) bool obscurePassword,
    @Default(false) bool frontUploaded,
    @Default(false) bool backUploaded,
  }) = _ProfileEditPersonalState;

  const ProfileEditPersonalState._();

  /// Name + birthday are required; a new password is optional (empty keeps the
  /// existing one). National-ID re-upload is optional when editing.
  bool get canSave =>
      firstName.trim().isNotEmpty &&
      lastName.trim().isNotEmpty &&
      birthday != null;

  ProfilePersonalDraft toDraft() => ProfilePersonalDraft(
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        birthday: birthday!,
        newPassword: password,
        frontUploaded: frontUploaded,
        backUploaded: backUploaded,
      );
}
