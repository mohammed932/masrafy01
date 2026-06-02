import 'package:dartz/dartz.dart';
import 'package:injectable/injectable.dart';

import '../../../../core/architecture/base_usecase.dart';
import '../../../../core/result/failure.dart';
import '../../data/models/request/matching_preview_request.dart';
import '../entities/matching_preview_entity.dart';
import '../entities/questionnaire_snapshot_entity.dart';
import '../repositories/questionnaire_repository.dart';

/// Constitution Principle XXX — one usecase per feature. Forwards both
/// questionnaire reads and the live matching-preview action.
@injectable
class QuestionnaireUseCase extends BaseUseCase<QuestionnaireRepository> {
  QuestionnaireUseCase(super.repository);

  Future<Either<Failure, QuestionnaireSnapshotEntity>> fetchQuestionnaire(
    String category,
  ) =>
      repository.fetchQuestionnaire(category);

  Future<Either<Failure, MatchingPreviewEntity>> previewMatches(
    MatchingPreviewRequest request,
  ) =>
      repository.previewMatches(request);
}
