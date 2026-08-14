part of 'matching_results_cubit.dart';

/// Results-screen state. `matched` distinguishes a genuine no-match (backend
/// `NO_MATCHING_PROGRAMS`) from a matched result that happened to yield zero
/// offers; both render the empty state. Data shape lives here (Principle XXXI).
@freezed
class MatchingResultsState with _$MatchingResultsState {
  const factory MatchingResultsState({
    @Default(RequestState.initial) RequestState status,
    @Default(<MatchOffer>[]) List<MatchOffer> offers,
    /// Feature 011 — programs the engine checked but could not price, WITH the
    /// reason. Surfaced rather than dropped: FR-022 requires the program to stay
    /// listed and FR-023 requires the reason in plain language, because "we haven't
    /// asked you this yet" and "your answer isn't in this bank's table" are things
    /// the applicant (or an admin reading over their shoulder) can act on, while a
    /// bank that silently vanishes reads as "this bank doesn't exist for me".
    @Default(<UnavailableProgramEntity>[]) List<UnavailableProgramEntity> unavailablePrograms,
    @Default('') String applicationId,
    @Default(false) bool matched,
    Failure? error,
  }) = _MatchingResultsState;

  const MatchingResultsState._();

  bool get isLoading => status.isInitial || status.isLoading;
  bool get isError => status.isError;
  bool get isLoaded => status.isLoaded;

  /// Nothing to show at all.
  ///
  /// Deliberately counts the unavailable programs: a shortlist of banks that each
  /// explain why they cannot price yet is NOT an empty screen, and rendering the
  /// generic "no matches" state over it would throw away the only actionable thing
  /// the applicant was told (FR-022).
  bool get isEmpty =>
      status.isLoaded && offers.isEmpty && unavailablePrograms.isEmpty;

  /// A gate rather than a transient failure — the profile must be finished.
  /// Documents (photo/National ID) are NOT gated on the matching call anymore
  /// (Constitution v9.0.1); they surface only at select-offer.
  bool get needsProfile => error?.code == 'PROFILE_INCOMPLETE';
}
