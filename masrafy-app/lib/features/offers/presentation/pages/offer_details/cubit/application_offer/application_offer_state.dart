part of 'application_offer_cubit.dart';

/// The fetched application, projected to what the offer-details screen renders.
/// Data shape lives here (Principle XXXI).
@freezed
class ApplicationOfferState with _$ApplicationOfferState {
  const factory ApplicationOfferState({
    @Default(RequestState.initial) RequestState status,
    PastApplication? application,
    Failure? error,
  }) = _ApplicationOfferState;

  const ApplicationOfferState._();

  /// Initial counts as loading: the screen opens with nothing to draw, and the
  /// shimmer is what the customer must see (Principle XXXIV).
  bool get isLoading => status.isInitial || status.isLoading;
  bool get isError => status.isError;

  /// The freshly-fetched offer, or null until it lands.
  MatchOffer? get offer => application?.offer;

  /// Loan summary (type / amount / duration) for the hero + summary card.
  MatchResultsArgs? get summary => application?.toSummary();
}
