part of 'select_offer_cubit.dart';

/// Select-offer request state. Data shape lives here (Principle XXXI).
@freezed
class SelectOfferState with _$SelectOfferState {
  const factory SelectOfferState({
    @Default(RequestState.initial) RequestState status,
    Failure? error,
  }) = _SelectOfferState;

  const SelectOfferState._();

  bool get isLoading => status.isLoading;
  bool get isSuccess => status.isLoaded;
  bool get isError => status.isError;
}
