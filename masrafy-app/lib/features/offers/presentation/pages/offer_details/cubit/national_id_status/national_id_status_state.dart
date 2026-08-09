part of 'national_id_status_cubit.dart';

/// National ID document status. Data shape lives here (Principle XXXI).
@freezed
class NationalIdStatusState with _$NationalIdStatusState {
  const factory NationalIdStatusState({
    @Default(RequestState.initial) RequestState status,
    @Default(false) bool frontUploaded,
    @Default(false) bool backUploaded,
    Failure? error,
  }) = _NationalIdStatusState;

  const NationalIdStatusState._();

  /// The server has answered — until then the flags below are defaults, not
  /// facts, and must not be read as "missing".
  bool get isKnown => status.isLoaded;

  /// Both sides on file — the select-offer document gate is satisfied.
  bool get isReady => frontUploaded && backUploaded;

  /// Known-incomplete: the only state that justifies blocking the Apply tap.
  bool get blocksApply => isKnown && !isReady;
}
