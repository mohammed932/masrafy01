import 'package:bloc/bloc.dart';
import 'package:freezed_annotation/freezed_annotation.dart';
import 'package:injectable/injectable.dart';

import 'package:app/core/enums/request_state.dart';
import 'package:app/core/result/failure.dart';
import 'package:app/features/applications/domain/usecases/applications_usecase.dart';
import 'package:app/features/applications/presentation/models/previous_applications_args.dart';
import 'package:app/features/offers/presentation/models/match_results_args.dart';

part 'application_offer_cubit.freezed.dart';
part 'application_offer_state.dart';

/// Fetches ONE application's offer (`GET /api/v1/applications/:id`) so the
/// offer-details screen renders live data instead of the [MatchOffer] the
/// Applications card was drawn from. That cached copy goes stale the moment the
/// bank files a decision, the customer saves/unsaves the offer on another
/// device, or the offer is erased — all of which this screen displays and acts
/// on. Orchestration only; the display shape lives on the state (Principle
/// XXXI) and the entity → [PastApplication] mapping stays in one place
/// (`PastApplication.fromEntity`), shared with the Applications list.
@injectable
class ApplicationOfferCubit extends Cubit<ApplicationOfferState> {
  ApplicationOfferCubit(this._useCase) : super(const ApplicationOfferState());

  final ApplicationsUseCase _useCase;

  Future<void> load(String applicationId) async {
    emit(state.copyWith(status: RequestState.loading, error: null));
    final res = await _useCase.get(applicationId);
    res.fold(
      (err) => emit(state.copyWith(status: RequestState.error, error: err)),
      (entity) => emit(state.copyWith(
        status: RequestState.loaded,
        application: PastApplication.fromEntity(entity),
        error: null,
      )),
    );
  }
}
