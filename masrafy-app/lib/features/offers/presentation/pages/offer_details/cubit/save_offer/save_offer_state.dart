part of 'save_offer_cubit.dart';

/// Save-offer request state. Data shape lives here (Principle XXXI).
@freezed
class SaveOfferState with _$SaveOfferState {
  const factory SaveOfferState({
    @Default(RequestState.initial) RequestState status,
    Failure? error,
  }) = _SaveOfferState;

  const SaveOfferState._();

  bool get isLoading => status.isLoading;
  bool get isSuccess => status.isLoaded;
  bool get isError => status.isError;
}
