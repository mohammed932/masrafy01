import 'package:injectable/injectable.dart';

import '../../../../core/architecture/base_remote_data_source.dart';
import '../../../../core/network/api_strings.dart';
import '../../../../core/network/endpoint.dart';
import '../models/request/matching_preview_request.dart';
import '../models/response/matching_preview_model.dart';
import '../models/response/questionnaire_snapshot_model.dart';

/// Feature-009 datasource (Constitution Principle XXX). Extends
/// `BaseRemoteDataSource`; reaches the network only through
/// `appNetwork.<verb>(MasrafyEndpoint(...))` and unwraps the masrafy
/// `{ success, data }` envelope exactly like `AuthRemoteDataSource`.
@injectable
class QuestionnaireRemoteDataSource extends BaseRemoteDataSource {
  QuestionnaireRemoteDataSource(super.appNetwork);

  /// `GET /api/v1/questionnaire/{category}` — the published snapshot.
  Future<QuestionnaireSnapshotModel> fetchQuestionnaire(String category) async {
    final json = await appNetwork.get(
      MasrafyEndpoint(endpoint: ApiStrings.questionnaireByCategory(category)),
    );
    return QuestionnaireSnapshotModel.fromJson(_unwrap(json));
  }

  /// `POST /api/v1/matching/preview` — live match preview for the
  /// in-progress answers.
  Future<MatchingPreviewModel> previewMatches(
    MatchingPreviewRequest request,
  ) async {
    final json = await appNetwork.post(
      MasrafyEndpoint(endpoint: ApiStrings.matchingPreview),
      data: request.toJson(),
    );
    return MatchingPreviewModel.fromJson(_unwrap(json));
  }

  Map<String, dynamic> _unwrap(Object? envelope) {
    if (envelope is Map<String, dynamic>) {
      final data = envelope['data'];
      if (data is Map<String, dynamic>) return data;
      return envelope;
    }
    return const {};
  }
}
