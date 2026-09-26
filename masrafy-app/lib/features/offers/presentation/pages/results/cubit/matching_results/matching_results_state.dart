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
    /// On a no-match, the check each program failed — see
    /// `ApplyResultEntity.noMatchFailedChecks`.
    @Default(<String>[]) List<String> noMatchFailedChecks,
    Failure? error,
  }) = _MatchingResultsState;

  const MatchingResultsState._();

  bool get isLoading => status.isInitial || status.isLoading;
  bool get isError => status.isError;
  bool get isLoaded => status.isLoaded;

  /// No bank made an offer. The refused programs are NOT listed beside priced
  /// offers any more — a customer holding offers has nothing to act on there —
  /// but when there is no offer at all, [noOfferReasons] is what the screen
  /// shows instead, so the applicant knows what to change before trying again.
  bool get isEmpty => status.isLoaded && offers.isEmpty;

  /// Why no bank made an offer, one entry per distinct reason, in the order the
  /// engine first reported each (FR-024), with how many banks gave it.
  ///
  /// Grouped by reason rather than listed per bank: "the amount you've paid is
  /// below the minimum" said four times under four masked letters is one thing
  /// to fix, not four. A bank refusing two programs for one reason counts once.
  List<({String reason, String? gateReasonCode, int bankCount})>
      get noOfferReasons {
    final banksByKey = <String, Set<String>>{};
    final firstByKey = <String, UnavailableProgramEntity>{};
    for (final p in unavailablePrograms) {
      final key = '${p.reason}|${p.gateReasonCode ?? ''}';
      firstByKey.putIfAbsent(key, () => p);
      // An unnamed bank still counts, once per program.
      (banksByKey[key] ??= <String>{})
          .add(p.bankName.isEmpty ? p.programCode : p.bankName);
    }
    return [
      for (final e in firstByKey.entries)
        (
          reason: e.value.reason,
          gateReasonCode: e.value.gateReasonCode,
          bankCount: banksByKey[e.key]!.length,
        ),
    ];
  }

  /// Every program was refused because none has a RATE for these answers —
  /// the applicant's answer (typically the down payment share, or the car's
  /// origin / fuel) falls outside every bank's rate table. Only when it is the
  /// sole reason: a mix of reasons gets the generic message, which is not wrong
  /// for any of them.
  bool get noRateForAnswers =>
      noMatchFailedChecks.isNotEmpty &&
      noMatchFailedChecks.every((c) => c == 'interest_rate');

  /// A gate rather than a transient failure — the profile must be finished.
  /// Documents (photo/National ID) are NOT gated on the matching call anymore
  /// (Constitution v9.0.1); they surface only at select-offer.
  bool get needsProfile => error?.code == 'PROFILE_INCOMPLETE';
}
