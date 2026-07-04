import 'package:dartz/dartz.dart';

import 'package:app/core/architecture/base_repository.dart';
import 'package:app/core/result/failure.dart';
import 'package:app/features/matching/data/datasources/matching_remote_datasource.dart';
import 'package:app/features/matching/data/models/request/apply_request.dart';
import 'package:app/features/matching/data/models/request/select_offer_request.dart';
import 'package:app/features/matching/domain/entities/apply_result_entity.dart';

/// Matching repository contract (Principle X + XXX). Every method returns
/// `Either<Failure, T>`; a NO-match is a valid [ApplyResultEntity]
/// (`matched == false`), NOT a failure — only transport / typed error codes
/// (e.g. `PROFILE_INCOMPLETE`, `NATIONAL_ID_REQUIRED`) fold to [Failure].
abstract class MatchingRepository
    extends BaseRepository<MatchingRemoteDataSource> {
  MatchingRepository(super.remoteDataSource);

  Future<Either<Failure, ApplyResultEntity>> apply(ApplyRequest request);

  Future<Either<Failure, Unit>> selectOffer(
    String applicationId,
    SelectOfferRequest request,
  );
}
