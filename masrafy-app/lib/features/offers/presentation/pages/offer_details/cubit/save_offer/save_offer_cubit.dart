import 'package:bloc/bloc.dart';
import 'package:freezed_annotation/freezed_annotation.dart';
import 'package:injectable/injectable.dart';

import 'package:app/core/enums/request_state.dart';
import 'package:app/core/result/failure.dart';
import 'package:app/features/saved_offers/domain/usecases/saved_offers_usecase.dart';

part 'save_offer_cubit.freezed.dart';
part 'save_offer_state.dart';

/// Bookmarks the current offer via `POST /api/v1/saved-offers`. Orchestration
/// only (Principle XXXI) — the details page reacts to [SaveOfferState] for
/// the loading spinner + success/error toast.
@injectable
class SaveOfferCubit extends Cubit<SaveOfferState> {
  SaveOfferCubit(this._savedOffers) : super(const SaveOfferState());

  final SavedOffersUseCase _savedOffers;

  /// Resolve the CURRENT saved-state on page open by asking the server, not by
  /// trusting the (possibly stale) cached offer object — `GET /saved-offers`
  /// membership by bankOfferId. Touches only `checkStatus` + `isSaved` (never
  /// `status`), so the success/error toast listener never fires on open. A
  /// failed check leaves the heart unsaved (non-blocking — the user can still
  /// tap to save).
  Future<void> check(String bankOfferId) async {
    if (bankOfferId.isEmpty) return;
    emit(state.copyWith(checkStatus: RequestState.loading));
    final res = await _savedOffers.list();
    res.fold(
      (_) => emit(state.copyWith(checkStatus: RequestState.error)),
      (offers) => emit(
        state.copyWith(
          checkStatus: RequestState.loaded,
          isSaved: offers.any((o) => o.bankOfferId == bankOfferId),
        ),
      ),
    );
  }

  Future<void> save(String bankOfferId) async {
    if (state.status.isLoading) return;
    emit(state.copyWith(status: RequestState.loading, error: null));
    final res = await _savedOffers.save(bankOfferId);
    res.fold(
      (err) => emit(state.copyWith(status: RequestState.error, error: err)),
      (_) => emit(
        state.copyWith(status: RequestState.loaded, isSaved: true, error: null),
      ),
    );
  }

  Future<void> remove(String bankOfferId) async {
    if (state.status.isLoading) return;
    emit(state.copyWith(status: RequestState.loading, error: null));
    final res = await _savedOffers.remove(bankOfferId);
    res.fold(
      // Already gone on the server counts as removed (mirrors SavedOffersCubit).
      (err) => err.code == 'SAVED_OFFER_NOT_FOUND'
          ? emit(state.copyWith(
              status: RequestState.loaded, isSaved: false, error: null))
          : emit(state.copyWith(status: RequestState.error, error: err)),
      (_) => emit(
        state.copyWith(
            status: RequestState.loaded, isSaved: false, error: null),
      ),
    );
  }
}
