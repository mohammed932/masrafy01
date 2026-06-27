import 'package:bloc/bloc.dart';
import 'package:freezed_annotation/freezed_annotation.dart';
import 'package:injectable/injectable.dart';

import 'package:app/core/enums/request_state.dart';
import 'package:app/core/result/failure.dart';
import 'package:app/features/saved_offers/domain/entities/saved_offer_entity.dart';
import 'package:app/features/saved_offers/domain/usecases/saved_offers_usecase.dart';

part 'saved_offers_cubit.freezed.dart';
part 'saved_offers_state.dart';

/// Saved Offers screen state (Figma `4088:153`). Loads the customer's saved
/// offers from the backend (shimmer while loading, Principle XXXIV) and removes
/// (unsaves) one optimistically — the row disappears immediately, restoring +
/// surfacing a toast only if the server rejects. A `SAVED_OFFER_NOT_FOUND`
/// rejection means it was already gone, so the optimistic removal stands.
/// Orchestration only; data shape lives on the state (Principle XXXI).
@injectable
class SavedOffersCubit extends Cubit<SavedOffersState> {
  SavedOffersCubit(this._useCase) : super(const SavedOffersState());

  final SavedOffersUseCase _useCase;

  Future<void> load() async {
    emit(state.copyWith(status: RequestState.loading, error: null));
    final res = await _useCase.list();
    res.fold(
      (err) => emit(state.copyWith(status: RequestState.error, error: err)),
      (offers) => emit(state.copyWith(
        status: RequestState.loaded,
        offers: offers,
        error: null,
      )),
    );
  }

  Future<void> remove(String bankOfferId) async {
    final previous = state.offers;
    final optimistic =
        previous.where((o) => o.bankOfferId != bankOfferId).toList();
    emit(state.copyWith(offers: optimistic, removeError: null));

    final res = await _useCase.remove(bankOfferId);
    res.fold(
      (err) {
        if (err.code == 'SAVED_OFFER_NOT_FOUND') return; // already gone — keep removed
        emit(state.copyWith(offers: previous, removeError: err));
      },
      (_) {},
    );
  }
}
