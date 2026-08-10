import 'package:dartz/dartz.dart';

import 'package:app/core/architecture/base_repository.dart';
import 'package:app/core/result/failure.dart';
import 'package:app/features/applications/data/datasources/applications_remote_datasource.dart';
import 'package:app/features/applications/domain/entities/application_summary_entity.dart';

/// Applications repository contract (Principle X + XXX). Every method returns
/// `Either<Failure, T>`.
abstract class ApplicationsRepository
    extends BaseRepository<ApplicationsRemoteDataSource> {
  ApplicationsRepository(super.remoteDataSource);

  Future<Either<Failure, List<ApplicationSummaryEntity>>> list();

  /// One application + its selected offer, fetched fresh (offer details).
  Future<Either<Failure, ApplicationSummaryEntity>> get(String applicationId);
}
