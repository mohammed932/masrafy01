import 'package:dartz/dartz.dart';

import 'package:app/core/architecture/base_repository.dart';
import 'package:app/core/features/platform_enumerations/data/datasources/platform_enumerations_remote_datasource.dart';
import 'package:app/core/features/platform_enumerations/domain/entities/platform_enumeration_entity.dart';
import 'package:app/core/result/failure.dart';

/// Registry contract (Principle X + XXX).
abstract class PlatformEnumerationsRepository
    extends BaseRepository<PlatformEnumerationsRemoteDataSource> {
  PlatformEnumerationsRepository(super.remoteDataSource);

  Future<Either<Failure, List<PlatformEnumerationEntity>>> byType(String type);
}
