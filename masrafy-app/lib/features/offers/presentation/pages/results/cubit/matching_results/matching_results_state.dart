part of 'matching_results_cubit.dart';

/// Results-screen state. `matched` distinguishes a genuine no-match (backend
/// `NO_MATCHING_PROGRAMS`) from a matched result that happened to yield zero
/// offers; both render the empty state. Data shape lives here (Principle XXXI).
@freezed
class MatchingResultsState with _$MatchingResultsState {
  const factory MatchingResultsState({
    @Default(RequestState.initial) RequestState status,
    @Default(<MatchOffer>[]) List<MatchOffer> offers,
    @Default(<UnavailableProgramEntity>[])
    List<UnavailableProgramEntity> unavailablePrograms,
    @Default('') String applicationId,
    @Default(false) bool matched,
    Failure? error,
  }) = _MatchingResultsState;

  const MatchingResultsState._();

  bool get isLoading => status.isInitial || status.isLoading;
  bool get isError => status.isError;
  bool get isLoaded => status.isLoaded;

  /// Nothing to show at all. An unavailable program is NOT nothing: it is the
  /// most useful thing on the screen for an over-committed applicant, since it
  /// names the obstacle. Treating it as empty would restore the silent drop this
  /// list exists to fix.
  bool get isEmpty =>
      status.isLoaded && offers.isEmpty && unavailablePrograms.isEmpty;

  /// Real offers are absent but at least one bank explained itself.
  bool get hasOnlyUnavailable =>
      status.isLoaded && offers.isEmpty && unavailablePrograms.isNotEmpty;

  /// A gate rather than a transient failure — the profile must be finished.
  /// Documents (photo/National ID) are NOT gated on the matching call anymore
  /// (Constitution v9.0.1); they surface only at select-offer.
  bool get needsProfile => error?.code == 'PROFILE_INCOMPLETE';
}
