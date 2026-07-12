import 'package:injectable/injectable.dart';

import 'package:app/core/architecture/base_remote_data_source.dart';
import 'package:app/core/network/api_strings.dart';
import 'package:app/core/network/endpoint.dart';
import '../models/customer_profile_model.dart';

/// Profile datasource. Reads the authenticated customer via `GET
/// /api/v1/auth/me` through `appNetwork` (Principle XXX — no `package:dio`).
@injectable
class ProfileRemoteDataSource extends BaseRemoteDataSource {
  ProfileRemoteDataSource(super.appNetwork);

  Future<CustomerProfileModel> getMe() async {
    final json = await appNetwork.get(
      MasrafyEndpoint(endpoint: ApiStrings.authMe),
    );
    return CustomerProfileModel.fromJson(_unwrap(json));
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
