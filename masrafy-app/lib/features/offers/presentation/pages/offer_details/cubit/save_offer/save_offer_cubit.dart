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

  Future<void> save(String bankOfferId) async {
    if (state.status.isLoading) return;
    emit(state.copyWith(status: RequestState.loading, error: null));
    final res = await _savedOffers.save(bankOfferId);
    res.fold(
      (err) => emit(state.copyWith(status: RequestState.error, error: err)),
      (_) => emit(state.copyWith(status: RequestState.loaded, error: null)),
    );
  }
}
