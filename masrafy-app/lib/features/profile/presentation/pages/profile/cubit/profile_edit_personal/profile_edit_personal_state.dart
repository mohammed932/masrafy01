part of 'profile_edit_personal_cubit.dart';

/// Edit Personal Info form state. Derivations (`canSave`, draft mapping) live
/// here, not on the cubit (Principle XXXI).
@freezed
class ProfileEditPersonalState with _$ProfileEditPersonalState {
  const factory ProfileEditPersonalState({
    @Default('') String firstName,
    @Default('') String lastName,
    DateTime? birthday,
    String? photoUrl,
    Uint8List? photoBytes,
    @Default(false) bool photoUploading,
    Failure? photoError,
    @Default(false) bool frontUploaded,
    @Default(false) bool backUploaded,
  }) = _ProfileEditPersonalState;

  const ProfileEditPersonalState._();

  /// Name + birthday are required. National-ID re-upload is optional when
  /// editing. (Password is changed on its own dedicated screen.)
  bool get canSave =>
      firstName.trim().isNotEmpty &&
      lastName.trim().isNotEmpty &&
      birthday != null &&
      !photoUploading;

  ProfilePersonalDraft toDraft() => ProfilePersonalDraft(
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        birthday: birthday!,
        photoUrl: photoUrl,
        photoBytes: photoBytes,
        frontUploaded: frontUploaded,
        backUploaded: backUploaded,
      );
}
