import 'package:dartz/dartz.dart';
import 'package:injectable/injectable.dart';

import '../../../../core/result/failure.dart';
import '../../../../core/utils/api_handler.dart';
import '../../domain/entities/matching_preview_entity.dart';
import '../../domain/entities/questionnaire_snapshot_entity.dart';
import '../../domain/repositories/questionnaire_repository.dart';
import '../models/request/matching_preview_request.dart';

/// Thin forwarder. `ApiHandler.callApi(...)` handles the error surface;
/// `.map((model) => model.toEntity())` converts the wire DTO into the
/// domain entity before crossing the layer (mirrors `WizardRepositoryImpl`).
@Injectable(as: QuestionnaireRepository)
class QuestionnaireRepositoryImpl extends QuestionnaireRepository {
  QuestionnaireRepositoryImpl(super.remoteDataSource);

  @override
  Future<Either<Failure, QuestionnaireSnapshotEntity>> fetchQuestionnaire(
    String category,
  ) async {
    final result =
        await ApiHandler.callApi(() => remoteDataSource.fetchQuestionnaire(category));
    return result.map((model) => model.toEntity());
  }

  @override
  Future<Either<Failure, MatchingPreviewEntity>> previewMatches(
    MatchingPreviewRequest request,
  ) async {
    final result =
        await ApiHandler.callApi(() => remoteDataSource.previewMatches(request));
    return result.map((model) => model.toEntity());
  }
}
