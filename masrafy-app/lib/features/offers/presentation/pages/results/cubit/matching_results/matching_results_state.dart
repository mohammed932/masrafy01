part of 'matching_results_cubit.dart';

/// Results-screen state. `matched` distinguishes a genuine no-match (backend
/// `NO_MATCHING_PROGRAMS`) from a matched result that happened to yield zero
/// offers; both render the empty state. Data shape lives here (Principle XXXI).
@freezed
class MatchingResultsState with _$MatchingResultsState {
  const factory MatchingResultsState({
    @Default(RequestState.initial) RequestState status,
    @Default(<MatchOffer>[]) List<MatchOffer> offers,
    @Default('') String applicationId,
    @Default(false) bool matched,
    Failure? error,
  }) = _MatchingResultsState;

  const MatchingResultsState._();

  bool get isLoading => status.isInitial || status.isLoading;
  bool get isError => status.isError;
  bool get isLoaded => status.isLoaded;

  /// Nothing to show. Programs the backend could not quote are not surfaced to
  /// the customer, so a load that yields no offers is empty regardless of them.
  bool get isEmpty => status.isLoaded && offers.isEmpty;

  /// A gate rather than a transient failure — the profile must be finished.
  /// Documents (photo/National ID) are NOT gated on the matching call anymore
  /// (Constitution v9.0.1); they surface only at select-offer.
  bool get needsProfile => error?.code == 'PROFILE_INCOMPLETE';
}
