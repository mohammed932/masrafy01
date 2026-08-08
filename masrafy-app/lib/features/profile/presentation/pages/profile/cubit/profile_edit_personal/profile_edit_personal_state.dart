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
    @Default(false) bool frontUploading,
    @Default(false) bool backUploading,

    /// Whether the server has actually been asked yet. Without this, a failed
    /// or in-flight status read is indistinguishable from a confirmed "nothing
    /// uploaded", and the tiles state something the app does not know.
    @Default(RequestState.initial) RequestState docsStatus,

    /// Presigned previews from the last status read, and the bytes of a side
    /// captured in THIS session. Bytes win: they are the picture the user just
    /// took, and they render with no round-trip.
    String? frontUrl,
    String? backUrl,
    Uint8List? frontBytes,
    Uint8List? backBytes,
    Failure? docError,
    @Default(false) bool saving,
    Failure? saveError,
    @Default(false) bool saved,
  }) = _ProfileEditPersonalState;

  const ProfileEditPersonalState._();

  /// Thumbnail for each National-ID tile (Principle XXXI — derivation on the
  /// state, not in the page).
  ImageProvider? get frontImage => idThumbnail(frontBytes, frontUrl);
  ImageProvider? get backImage => idThumbnail(backBytes, backUrl);

  /// Subtitle for a side, given what the app actually knows. `initial`/`loading`
  /// deliberately do NOT read as "not uploaded" — that was the old bug in the
  /// other direction.
  bool get docsUnknown =>
      docsStatus == RequestState.initial ||
      docsStatus == RequestState.loading ||
      docsStatus == RequestState.error;

  /// Name + birthday are required. National-ID re-upload is optional when
  /// editing. (Password is changed on its own dedicated screen.) Blocked while
  /// any upload or the save itself is in flight.
  bool get canSave =>
      firstName.trim().isNotEmpty &&
      lastName.trim().isNotEmpty &&
      birthday != null &&
      !photoUploading &&
      !frontUploading &&
      !backUploading &&
      !saving;

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
