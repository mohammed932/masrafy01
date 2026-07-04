import 'package:injectable/injectable.dart';

import 'package:app/core/architecture/base_remote_data_source.dart';
import 'package:app/core/network/api_strings.dart';
import 'package:app/core/network/endpoint.dart';
import 'package:app/features/questionnaire/data/models/response/questionnaire_snapshot_model.dart';
import 'package:app/features/questionnaire/domain/enums/loan_category.dart';

/// Questionnaire datasource — fetches the active published snapshot for a
/// category via `appNetwork` (Principle XXX — no `package:dio` here). JWT +
/// profile-complete gated on the backend.
@injectable
class QuestionnaireRemoteDataSource extends BaseRemoteDataSource {
  QuestionnaireRemoteDataSource(super.appNetwork);

  Future<QuestionnaireSnapshotModel> getByCategory(LoanCategory category) async {
    final json = await appNetwork.get(
      MasrafyEndpoint(
        endpoint: ApiStrings.questionnaireByCategory(category.code),
      ),
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
