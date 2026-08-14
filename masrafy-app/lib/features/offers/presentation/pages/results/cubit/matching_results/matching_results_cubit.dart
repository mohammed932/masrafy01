import 'package:bloc/bloc.dart';
import 'package:freezed_annotation/freezed_annotation.dart';
import 'package:injectable/injectable.dart';

import 'package:app/core/enums/request_state.dart';
import 'package:app/core/result/failure.dart';
import 'package:app/features/matching/data/models/request/apply_request.dart';
import 'package:app/features/matching/domain/entities/apply_result_entity.dart';
import 'package:app/features/matching/domain/usecases/matching_usecase.dart';
import 'package:app/features/offers/presentation/models/match_results_args.dart';

part 'matching_results_cubit.freezed.dart';
part 'matching_results_state.dart';

/// Drives the offers-results screen (Figma `2040:1253`). On [submit] it runs
/// `POST /api/v1/apply` and maps the ranked offers to display [MatchOffer]s.
/// Age is NOT sent: the backend derives it from the customer's `birthday` and
/// returns `PROFILE_INCOMPLETE` itself when the profile is unfinished
/// (Principle XXXVII / A31). Shimmer while loading (Principle XXXIV). A no-match
/// is a loaded-but-empty state, not an error. Orchestration only (Principle XXXI).
@injectable
class MatchingResultsCubit extends Cubit<MatchingResultsState> {
  MatchingResultsCubit(this._matching) : super(const MatchingResultsState());

  final MatchingUseCase _matching;

  Future<void> submit(ApplyRequest request) async {
    emit(state.copyWith(status: RequestState.loading, error: null));

    final result = await _matching.apply(request);
    result.fold(
      (err) => emit(state.copyWith(status: RequestState.error, error: err)),
      (entity) {
        final offers = <MatchOffer>[
          for (var i = 0; i < entity.offers.length; i++)
            MatchOffer.fromEntity(
              entity.offers[i],
              applicationId: entity.applicationId,
              isBestMatch: i == 0,
            ),
        ];
        emit(state.copyWith(
          status: RequestState.loaded,
          offers: offers,
          // Carried straight through, in the order the engine returned them —
          // ordering is not this screen's to invent (FR-024).
          unavailablePrograms: entity.unavailablePrograms,
          applicationId: entity.applicationId,
          matched: entity.matched,
          error: null,
        ));
      },
    );
  }
}
