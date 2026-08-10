import 'package:dartz/dartz.dart';
import 'package:injectable/injectable.dart';

import 'package:app/core/result/failure.dart';
import 'package:app/core/utils/api_handler.dart';
import 'package:app/features/applications/domain/entities/application_summary_entity.dart';
import 'package:app/features/applications/domain/repositories/applications_repository.dart';

/// Thin network-mapping forwarder for [ApplicationsRepository]
/// (Principles X + XXX). Routes through [ApiHandler.callApi]; maps the wire
/// model to entities.
@Injectable(as: ApplicationsRepository)
class ApplicationsRepositoryImpl extends ApplicationsRepository {
  ApplicationsRepositoryImpl(super.remoteDataSource);

  @override
  Future<Either<Failure, List<ApplicationSummaryEntity>>> list() async {
    final result =
        await ApiHandler.callApi(() => remoteDataSource.getApplications());
    return result.map((m) => m.toEntities());
  }

  @override
  Future<Either<Failure, ApplicationSummaryEntity>> get(
    String applicationId,
  ) async {
    final result = await ApiHandler.callApi(
      () => remoteDataSource.getApplication(applicationId),
    );
    return result.map((m) => m.toEntity());
  }
}
