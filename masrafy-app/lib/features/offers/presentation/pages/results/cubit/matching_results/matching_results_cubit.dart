import 'package:bloc/bloc.dart';
import 'package:freezed_annotation/freezed_annotation.dart';
import 'package:injectable/injectable.dart';

import 'package:app/core/enums/request_state.dart';
import 'package:app/core/result/failure.dart';
import 'package:app/features/auth/domain/usecases/auth_usecase.dart';
import 'package:app/features/matching/data/models/request/apply_request.dart';
import 'package:app/features/matching/domain/usecases/matching_usecase.dart';
import 'package:app/features/offers/presentation/models/match_results_args.dart';

part 'matching_results_cubit.freezed.dart';
part 'matching_results_state.dart';

/// Drives the offers-results screen (Figma `2040:1253`). On [submit] it fills
/// the missing `age` from `/auth/me` (Principle XXXVII — a complete profile has
/// a derived age), runs `POST /api/v1/apply`, and maps the ranked offers to
/// display [MatchOffer]s. Shimmer while loading (Principle XXXIV). A no-match is
/// a loaded-but-empty state, not an error. Orchestration only (Principle XXXI).
@injectable
class MatchingResultsCubit extends Cubit<MatchingResultsState> {
  MatchingResultsCubit(this._matching, this._auth)
      : super(const MatchingResultsState());

  final MatchingUseCase _matching;
  final AuthUseCase _auth;

  Future<void> submit(ApplyRequest request) async {
    emit(state.copyWith(status: RequestState.loading, error: null));

    final meResult = await _auth.me();
    final meFailure = meResult.fold<Failure?>((f) => f, (_) => null);
    if (meFailure != null) {
      emit(state.copyWith(status: RequestState.error, error: meFailure));
      return;
    }
    final age = meResult.fold<int?>((_) => null, (customer) => customer.age);
    if (age == null) {
      // No derived age means the profile isn't really complete — gate it.
      emit(state.copyWith(
        status: RequestState.error,
        error: const ServerFailure(code: 'PROFILE_INCOMPLETE'),
      ));
      return;
    }

    final result = await _matching.apply(request.withAge(age));
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
          applicationId: entity.applicationId,
          matched: entity.matched,
          error: null,
        ));
      },
    );
  }
}
