part of 'save_offer_cubit.dart';

/// Save-offer request state. Data shape lives here (Principle XXXI).
@freezed
class SaveOfferState with _$SaveOfferState {
  const factory SaveOfferState({
    @Default(RequestState.initial) RequestState status,
    @Default(RequestState.initial) RequestState checkStatus,
    @Default(false) bool isSaved,
    Failure? error,
  }) = _SaveOfferState;

  const SaveOfferState._();

  bool get isLoading => status.isLoading;
  bool get isSuccess => status.isLoaded;
  bool get isError => status.isError;

  /// True while the initial saved-state check OR a save/remove call is running —
  /// drives the heart spinner + disables the toggle.
  bool get isBusy => checkStatus.isLoading || status.isLoading;
}
