import 'package:injectable/injectable.dart';

import 'package:app/core/architecture/base_remote_data_source.dart';
import 'package:app/core/network/api_strings.dart';
import 'package:app/core/network/endpoint.dart';
import '../models/response/applications_list_model.dart';

/// Applications datasource. Routes to the masrafy `/api/v1/applications`
/// surface via `appNetwork` (Principle XXX — no `package:dio` here).
@injectable
class ApplicationsRemoteDataSource extends BaseRemoteDataSource {
  ApplicationsRemoteDataSource(super.appNetwork);

  Future<ApplicationsListModel> getApplications() async {
    final json = await appNetwork.get(
      MasrafyEndpoint(endpoint: ApiStrings.applications),
    );
    return ApplicationsListModel.fromJson(_unwrap(json));
  }

  /// One application + its selected offer — the read behind opening an
  /// application's offer details.
  Future<ApplicationSummaryModel> getApplication(String applicationId) async {
    final json = await appNetwork.get(
      MasrafyEndpoint(endpoint: ApiStrings.applicationById(applicationId)),
    );
    final data = _unwrap(json);
    final application = data['application'];
    return ApplicationSummaryModel.fromJson(
      application is Map<String, dynamic> ? application : data,
    );
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
