import 'package:injectable/injectable.dart';

import 'package:app/core/architecture/base_remote_data_source.dart';
import 'package:app/core/network/api_strings.dart';
import 'package:app/core/network/endpoint.dart';
import 'package:app/features/matching/data/models/request/apply_request.dart';
import 'package:app/features/matching/data/models/request/select_offer_request.dart';
import 'package:app/features/matching/data/models/response/apply_result_model.dart';

/// Matching datasource — routes to `/api/v1/apply` and the select-offer surface
/// via `appNetwork` (Principle XXX — no `package:dio` here).
@injectable
class MatchingRemoteDataSource extends BaseRemoteDataSource {
  MatchingRemoteDataSource(super.appNetwork);

  /// Submit an application for matching. Returns the parsed envelope — a
  /// no-match (`success:false`, HTTP 200) is a valid result, not a throw.
  Future<ApplyResultModel> apply(ApplyRequest request) async {
    final json = await appNetwork.post(
      MasrafyEndpoint(endpoint: ApiStrings.apply),
      data: request.toJson(),
    );
    return ApplyResultModel.fromJson(_asMap(json));
  }

  /// Proceed with one returned offer (user-intent gate).
  Future<void> selectOffer(
    String applicationId,
    SelectOfferRequest request,
  ) async {
    await appNetwork.post(
      MasrafyEndpoint(endpoint: ApiStrings.applicationSelectOffer(applicationId)),
      data: request.toJson(),
    );
  }

  Map<String, dynamic> _asMap(dynamic v) =>
      v is Map<String, dynamic> ? v : const {};
}
