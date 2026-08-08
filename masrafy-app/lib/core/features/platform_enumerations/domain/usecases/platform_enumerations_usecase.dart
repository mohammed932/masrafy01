import 'package:dartz/dartz.dart';
import 'package:injectable/injectable.dart';

import 'package:app/core/architecture/base_usecase.dart';
import 'package:app/core/features/platform_enumerations/domain/entities/platform_enumeration_entity.dart';
import 'package:app/core/features/platform_enumerations/domain/repositories/platform_enumerations_repository.dart';
import 'package:app/core/result/failure.dart';

/// The registry types the app reads. Keeping them here stops a typo'd string
/// literal from silently returning an empty list at a call site.
abstract final class EnumerationTypes {
  static const String governorate = 'governorate';
  static const String requiredDocument = 'required_document';

  /// The program-name catalog — the archetypes ("Doctor Loans", "Pharmacy") a
  /// bank program instantiates. Members carry `categories`, so the picker must
  /// filter to the chosen loan category (see
  /// [PlatformEnumerationEntity.offeredUnder]) — the backend rejects a pair it
  /// is not assigned to.
  static const String programName = 'program_name';
}

/// Lookup-list reads (Principle XXXV — shared by profile + offers).
@injectable
class PlatformEnumerationsUseCase
    extends BaseUseCase<PlatformEnumerationsRepository> {
  PlatformEnumerationsUseCase(super.repository);

  Future<Either<Failure, List<PlatformEnumerationEntity>>> byType(
    String type,
  ) =>
      repository.byType(type);
}
