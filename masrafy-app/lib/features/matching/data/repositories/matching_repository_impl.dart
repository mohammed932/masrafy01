import 'package:dartz/dartz.dart';
import 'package:injectable/injectable.dart';

import 'package:app/core/result/failure.dart';
import 'package:app/core/utils/api_handler.dart';
import 'package:app/features/matching/data/models/request/apply_request.dart';
import 'package:app/features/matching/data/models/request/select_offer_request.dart';
import 'package:app/features/matching/domain/entities/apply_result_entity.dart';
import 'package:app/features/matching/domain/repositories/matching_repository.dart';

/// Thin network-mapping forwarder for [MatchingRepository] (Principles X + XXX).
/// Each call routes through [ApiHandler.callApi]; the apply call maps the wire
/// model → entity. A no-match returns `Right(entity)` with `matched:false`
/// (HTTP 200); only transport / typed error codes fold to `Left(Failure)`.
@Injectable(as: MatchingRepository)
class MatchingRepositoryImpl extends MatchingRepository {
  MatchingRepositoryImpl(super.remoteDataSource);

  @override
  Future<Either<Failure, ApplyResultEntity>> apply(ApplyRequest request) async {
    final result =
        await ApiHandler.callApi(() => remoteDataSource.apply(request));
    return result.map((m) => m.toEntity());
  }

  @override
  Future<Either<Failure, Unit>> selectOffer(
    String applicationId,
    SelectOfferRequest request,
  ) async {
    final result = await ApiHandler.callApi(
      () => remoteDataSource.selectOffer(applicationId, request),
    );
    return result.map((_) => unit);
  }
}
