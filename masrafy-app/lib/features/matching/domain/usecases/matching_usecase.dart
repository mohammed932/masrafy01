import 'package:dartz/dartz.dart';
import 'package:injectable/injectable.dart';

import 'package:app/core/architecture/base_usecase.dart';
import 'package:app/core/result/failure.dart';
import 'package:app/features/matching/data/models/request/apply_request.dart';
import 'package:app/features/matching/data/models/request/select_offer_request.dart';
import 'package:app/features/matching/domain/entities/apply_result_entity.dart';
import 'package:app/features/matching/domain/repositories/matching_repository.dart';

/// Matching usecase — forwards to the repository (no side effects). One method
/// per action (Principle XXX): submit an application for matching, and select
/// (proceed with) one of the returned offers.
@injectable
class MatchingUseCase extends BaseUseCase<MatchingRepository> {
  MatchingUseCase(super.repository);

  Future<Either<Failure, ApplyResultEntity>> apply(ApplyRequest request) =>
      repository.apply(request);

  Future<Either<Failure, Unit>> selectOffer(
    String applicationId,
    SelectOfferRequest request,
  ) =>
      repository.selectOffer(applicationId, request);
}
