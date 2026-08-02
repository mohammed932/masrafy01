import 'package:dartz/dartz.dart';
import 'package:injectable/injectable.dart';

import 'package:app/core/features/platform_enumerations/domain/entities/platform_enumeration_entity.dart';
import 'package:app/core/features/platform_enumerations/domain/repositories/platform_enumerations_repository.dart';
import 'package:app/core/result/failure.dart';
import 'package:app/core/utils/api_handler.dart';

/// Registry reads with a per-type, process-lifetime cache.
///
/// These lists change on an operator's timescale, not a session's, and several
/// screens ask for the same type — caching keeps a governorate picker from
/// re-fetching 27 rows every time the contact form opens. Registered as a
/// singleton so the cache is actually shared.
@LazySingleton(as: PlatformEnumerationsRepository)
class PlatformEnumerationsRepositoryImpl extends PlatformEnumerationsRepository {
  PlatformEnumerationsRepositoryImpl(super.remoteDataSource);

  final Map<String, List<PlatformEnumerationEntity>> _cache = {};

  @override
  Future<Either<Failure, List<PlatformEnumerationEntity>>> byType(
    String type,
  ) async {
    final cached = _cache[type];
    if (cached != null) return Right(cached);

    final result = await ApiHandler.callApi(
      () => remoteDataSource.byType(type),
    );
    return result.map((models) {
      final entities = models.map((m) => m.toEntity()).toList(growable: false);
      // Only a non-empty answer is worth caching: an empty list usually means the
      // operator has not seeded that type yet, and re-asking later is cheap.
      if (entities.isNotEmpty) _cache[type] = entities;
      return entities;
    });
  }
}
