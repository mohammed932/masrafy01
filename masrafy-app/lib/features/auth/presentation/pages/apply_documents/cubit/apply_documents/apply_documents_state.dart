part of 'apply_documents_cubit.dart';

@freezed
class ApplyDocumentsState with _$ApplyDocumentsState {
  const factory ApplyDocumentsState({
    @Default(RequestState.initial) RequestState loadStatus,
    @Default(false) bool idFrontUploaded,
    @Default(false) bool idFrontUploading,
    @Default(false) bool idBackUploaded,
    @Default(false) bool idBackUploading,

    /// Presigned previews from the status read, and the bytes of a side shot in
    /// THIS session. Bytes win — see [idThumbnail].
    String? idFrontUrl,
    String? idBackUrl,
    Uint8List? idFrontBytes,
    Uint8List? idBackBytes,
    Failure? error,
  }) = _ApplyDocumentsState;

  const ApplyDocumentsState._();

  /// Thumbnails for the two tiles (Principle XXXI — derivation on the state).
  ImageProvider? get idFrontImage => idThumbnail(idFrontBytes, idFrontUrl);
  ImageProvider? get idBackImage => idThumbnail(idBackBytes, idBackUrl);

  bool get isLoadingStatus =>
      loadStatus.isInitial || loadStatus.isLoading;
  bool get isStatusError => loadStatus.isError;

  bool get anyUploading => idFrontUploading || idBackUploading;

  /// Both National ID sides are on file — the CTA unlocks and the screen can
  /// pop `true` to auto-resume select-offer. Profile photo is optional
  /// (v9.1.0) and never gates apply.
  bool get allDone => idFrontUploaded && idBackUploaded;

  bool get canSubmit => allDone && !anyUploading;
}
