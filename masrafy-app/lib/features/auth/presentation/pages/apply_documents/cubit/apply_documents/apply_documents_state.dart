part of 'apply_documents_cubit.dart';

@freezed
class ApplyDocumentsState with _$ApplyDocumentsState {
  const factory ApplyDocumentsState({
    @Default(RequestState.initial) RequestState loadStatus,
    Uint8List? photoBytes,
    @Default(false) bool photoUploaded,
    @Default(false) bool photoUploading,
    @Default(false) bool idFrontUploaded,
    @Default(false) bool idFrontUploading,
    @Default(false) bool idBackUploaded,
    @Default(false) bool idBackUploading,
    Failure? error,
  }) = _ApplyDocumentsState;

  const ApplyDocumentsState._();

  bool get isLoadingStatus =>
      loadStatus.isInitial || loadStatus.isLoading;
  bool get isStatusError => loadStatus.isError;

  bool get anyUploading =>
      photoUploading || idFrontUploading || idBackUploading;

  /// All three apply-time documents are on file — the CTA unlocks and the
  /// screen can pop `true` to auto-resume select-offer.
  bool get allDone => photoUploaded && idFrontUploaded && idBackUploaded;

  bool get canSubmit => allDone && !anyUploading;
}
