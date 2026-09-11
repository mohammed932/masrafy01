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
/// The question POOL is global (one list, one version), but each question is
/// assigned in the dashboard to the loan categories that ask it, so [category]
/// is sent as a query parameter and the server returns only that category's
/// questions.
///
/// [programNameKey] narrows once more, to the program the applicant picked on the
/// loan-setup step: of the questions their category asks, the server returns the ones
/// a program behind that name reads, plus the core every quote needs. One program may
/// need three questions and the next fifteen. Sent only when it is present, so a call
/// without it produces the same request it always did — which is what makes the server
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
