import 'package:injectable/injectable.dart';

import '../../../../core/architecture/base_remote_data_source.dart';
import '../../../../core/network/api_strings.dart';
import '../../../../core/network/endpoint.dart';
import '../models/request/loan_application_request.dart';
import '../models/response/apply_envelope_model.dart';

/// Wizard datasource (Constitution Principle XXX). Extends
/// `BaseRemoteDataSource`; reaches the network only through
/// `appNetwork.<verb>(MasrafyEndpoint(...))`. Annotated `@injectable`
/// per Principle IV — registered by `injectable_generator`.
@injectable
class WizardRemoteDataSource extends BaseRemoteDataSource {
  WizardRemoteDataSource(super.appNetwork);

  /// `POST /api/v1/apply` — masrafy matching engine. HMAC + optional
  /// customer-JWT interceptors are applied by `DioFactory`.
  Future<ApplyEnvelopeModel> submitLoanApplication(LoanApplicationRequest request) async {
    final json = await appNetwork.post(
      MasrafyEndpoint(endpoint: ApiStrings.apply),
      data: request.toJson(),
    );
    return ApplyEnvelopeModel.fromJson((json as Map).cast<String, dynamic>());
  }
}
