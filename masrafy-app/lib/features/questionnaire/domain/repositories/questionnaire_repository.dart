import 'package:dartz/dartz.dart';

import '../../../../core/architecture/base_repository.dart';
import '../../../../core/result/failure.dart';
import '../../data/datasources/questionnaire_remote_datasource.dart';
import '../../data/models/request/matching_preview_request.dart';
import '../entities/matching_preview_entity.dart';
import '../entities/questionnaire_snapshot_entity.dart';

/// Constitution Principle XXX — repository extends `BaseRepository`
/// generic-parameterised by the feature's datasource. Methods return
/// `Future<Either<Failure, T>>` of **entities**, never models.
abstract class QuestionnaireRepository
    extends BaseRepository<QuestionnaireRemoteDataSource> {
  QuestionnaireRepository(super.remoteDataSource);

  Future<Either<Failure, QuestionnaireSnapshotEntity>> fetchQuestionnaire(
    String category,
  );

  Future<Either<Failure, MatchingPreviewEntity>> previewMatches(
    MatchingPreviewRequest request,
  );
}
