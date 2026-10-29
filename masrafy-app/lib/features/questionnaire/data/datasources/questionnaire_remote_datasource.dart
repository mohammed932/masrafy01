import 'package:injectable/injectable.dart';

import 'package:app/core/architecture/base_remote_data_source.dart';
import 'package:app/core/network/api_strings.dart';
import 'package:app/core/network/endpoint.dart';
import 'package:app/features/questionnaire/data/models/response/questionnaire_snapshot_model.dart';
import 'package:app/features/questionnaire/domain/enums/loan_category.dart';

/// Questionnaire datasource — fetches the active published snapshot via
/// `appNetwork` (Principle XXX — no `package:dio` here). JWT +
/// profile-complete gated on the backend.
///
/// The question POOL is global (one list, one version) and a question carries no
/// loan type. [category] and [programNameKey] — the program the applicant picked on
/// the loan-setup step — go out as query parameters, and the server returns what that
/// program asks: the fixed questions, what a bank program behind it reads and what the
/// admin ticked for it, in the program's own order. One program may need three
/// questions and the next fifteen. [programNameKey] is sent only when it is present,
/// so a call without it produces the same request it always did — which is what makes the server
/// side safe to deploy ahead of an app release.
@injectable
class QuestionnaireRemoteDataSource extends BaseRemoteDataSource {
  QuestionnaireRemoteDataSource(super.appNetwork);

  Future<QuestionnaireSnapshotModel> getActive(
    LoanCategory category, {
    String? programNameKey,
  }) async {
    final json = await appNetwork.get(
      MasrafyEndpoint(endpoint: ApiStrings.questionnaire),
      queryParameters: {
        'category': category.code,
        if (programNameKey != null && programNameKey.isNotEmpty)
          'programNameKey': programNameKey,
      },
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
