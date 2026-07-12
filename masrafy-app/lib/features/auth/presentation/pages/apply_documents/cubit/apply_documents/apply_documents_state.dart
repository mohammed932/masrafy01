part of 'apply_documents_cubit.dart';

@freezed
class ApplyDocumentsState with _$ApplyDocumentsState {
  const factory ApplyDocumentsState({
    @Default(RequestState.initial) RequestState loadStatus,
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

  bool get anyUploading => idFrontUploading || idBackUploading;

  /// Both National ID sides are on file — the CTA unlocks and the screen can
  /// pop `true` to auto-resume select-offer. Profile photo is optional
  /// (v9.1.0) and never gates apply.
  bool get allDone => idFrontUploaded && idBackUploaded;

  bool get canSubmit => allDone && !anyUploading;
}
