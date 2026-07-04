import 'package:bloc/bloc.dart';
import 'package:freezed_annotation/freezed_annotation.dart';
import 'package:injectable/injectable.dart';

import 'package:app/core/enums/request_state.dart';
import 'package:app/core/result/failure.dart';
import 'package:app/features/matching/data/models/request/select_offer_request.dart';
import 'package:app/features/matching/domain/usecases/matching_usecase.dart';

part 'select_offer_cubit.freezed.dart';
part 'select_offer_state.dart';

/// Proceeds with a chosen offer via
/// `POST /api/v1/applications/{applicationId}/select-offer` (Feature 008
/// user-intent gate). Orchestration only (Principle XXXI) — the details page
/// reacts to [SelectOfferState] for the loading spinner + success/error toast.
@injectable
class SelectOfferCubit extends Cubit<SelectOfferState> {
  SelectOfferCubit(this._matching) : super(const SelectOfferState());

  final MatchingUseCase _matching;

  Future<void> select(String applicationId, String bankOfferId) async {
    if (state.status.isLoading) return;
    emit(state.copyWith(status: RequestState.loading, error: null));
    final res = await _matching.selectOffer(
      applicationId,
      SelectOfferRequest(bankOfferId: bankOfferId),
    );
    res.fold(
      (err) => emit(state.copyWith(status: RequestState.error, error: err)),
      (_) => emit(state.copyWith(status: RequestState.loaded, error: null)),
    );
  }
}
