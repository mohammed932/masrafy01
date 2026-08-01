import 'package:injectable/injectable.dart';

import 'package:app/core/architecture/base_remote_data_source.dart';
import 'package:app/core/network/api_strings.dart';
import 'package:app/core/network/endpoint.dart';
import 'package:app/features/questionnaire/data/models/response/questionnaire_snapshot_model.dart';

/// Questionnaire datasource — fetches the single active published snapshot via
/// `appNetwork` (Principle XXX — no `package:dio` here). JWT +
/// profile-complete gated on the backend. No category parameter: the pool is
/// global (feature 010).
@injectable
class QuestionnaireRemoteDataSource extends BaseRemoteDataSource {
  QuestionnaireRemoteDataSource(super.appNetwork);

  Future<QuestionnaireSnapshotModel> getActive() async {
    final json = await appNetwork.get(
      MasrafyEndpoint(endpoint: ApiStrings.questionnaire),
    );
    return QuestionnaireSnapshotModel.fromJson(_unwrap(json));
  }

  Map<String, dynamic> _unwrap(dynamic envelope) {
    if (envelope is Map<String, dynamic>) {
      final data = envelope['data'];
      if (data is Map<String, dynamic>) return data;
      return envelope;
    }
    return const {};
  }
}
