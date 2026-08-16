import 'package:injectable/injectable.dart';

import 'package:app/core/architecture/base_remote_data_source.dart';
import 'package:app/core/network/api_strings.dart';
import 'package:app/core/network/endpoint.dart';
import 'package:app/features/loan_setup/data/models/response/program_options_model.dart';
import 'package:app/features/questionnaire/domain/enums/loan_category.dart';

/// Reads what a customer can actually pick for one loan category — which income
/// bases have live programs behind them, and which catalog names sit on each.
///
/// Replaces the Home screen's `program_name` registry read: that returned every
/// name the operator assigned to the category, including ones no bank has
/// instantiated and ones sold only on the basis the customer did not choose.
@injectable
class ProgramOptionsRemoteDataSource extends BaseRemoteDataSource {
  ProgramOptionsRemoteDataSource(super.appNetwork);

  Future<ProgramOptionsModel> forCategory(LoanCategory category) async {
    final json = await appNetwork.get(
      MasrafyEndpoint(endpoint: ApiStrings.programOptions),
      queryParameters: {'category': category.code},
    );
    final data = json is Map<String, dynamic> ? json['data'] : null;
    return ProgramOptionsModel.fromJson(
      data is Map<String, dynamic> ? data : const {},
    );
  }
}
