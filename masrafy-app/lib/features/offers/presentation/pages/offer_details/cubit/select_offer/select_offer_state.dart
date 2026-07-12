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

  /// Core profile (name/birthday/…) still incomplete — route to Complete-Profile.
  bool get needsProfile => error?.code == 'PROFILE_INCOMPLETE';

  /// Apply-time documents missing (Constitution v9.1.0) — route to the
  /// apply-documents screen to collect the National ID, then auto-resume.
  bool get needsDocuments => error?.code == 'NATIONAL_ID_REQUIRED';
}
