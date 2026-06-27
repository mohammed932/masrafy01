part of 'saved_offers_cubit.dart';

@freezed
class SavedOffersState with _$SavedOffersState {
  const factory SavedOffersState({
    @Default(RequestState.initial) RequestState status,
    @Default(<SavedOfferEntity>[]) List<SavedOfferEntity> offers,
    Failure? error,
    Failure? removeError,
  }) = _SavedOffersState;

  // ignore: unused_element
  const SavedOffersState._();

  bool get isLoading => status.isLoading || status.isInitial;
  bool get isError => status.isError;
  bool get isLoaded => status.isLoaded;
  bool get isEmpty => status.isLoaded && offers.isEmpty;
}
