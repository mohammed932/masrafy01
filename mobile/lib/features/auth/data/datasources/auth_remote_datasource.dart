import 'package:injectable/injectable.dart';

import '../../../../core/architecture/base_remote_data_source.dart';
import '../../../../core/network/api_strings.dart';
import '../../../../core/network/endpoint.dart';
import '../models/request/login_request.dart';
import '../models/request/logout_request.dart';
import '../models/request/signup_request.dart';
import '../models/response/customer_auth_envelope_model.dart';
import '../models/response/customer_model.dart';

/// Auth datasource (Constitution Principle XXX + XI). Speaks the masrafy
/// `/api/v1/auth/*` dialect; reaches the network via `appNetwork`. Methods
/// accept typed `*Request` DTOs end-to-end and call `.toJson()` exactly
/// once at the wire boundary.
@injectable
class AuthRemoteDataSource extends BaseRemoteDataSource {
  AuthRemoteDataSource(super.appNetwork);

  Future<CustomerAuthEnvelopeModel> login(LoginRequest request) async {
    final json = await appNetwork.post(
      MasrafyEndpoint(endpoint: ApiStrings.authLogin),
      data: request.toJson(),
    );
    return CustomerAuthEnvelopeModel.fromJson(_unwrap(json));
  }

  Future<CustomerAuthEnvelopeModel> signup(SignupRequest request) async {
    final json = await appNetwork.post(
      MasrafyEndpoint(endpoint: ApiStrings.authSignup),
      data: request.toJson(),
    );
    return CustomerAuthEnvelopeModel.fromJson(_unwrap(json));
  }

  Future<CustomerModel> me() async {
    final json = await appNetwork.get(MasrafyEndpoint(endpoint: ApiStrings.authMe));
    return CustomerModel.fromJson(_unwrap(json));
  }

  Future<void> logout(LogoutRequest request) async {
    await appNetwork.post(
      MasrafyEndpoint(endpoint: ApiStrings.authLogout),
      data: request.toJson(),
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
