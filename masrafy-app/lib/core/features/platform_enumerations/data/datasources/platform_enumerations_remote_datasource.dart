import 'package:injectable/injectable.dart';

import 'package:app/core/architecture/base_remote_data_source.dart';
import 'package:app/core/network/api_strings.dart';
import 'package:app/core/network/endpoint.dart';
import '../models/platform_enumeration_model.dart';

/// Reads one lookup list from the operator-managed registry.
/// Customer-JWT gated, same as every other `/api/v1` read.
@injectable
class PlatformEnumerationsRemoteDataSource extends BaseRemoteDataSource {
  PlatformEnumerationsRemoteDataSource(super.appNetwork);

  Future<List<PlatformEnumerationModel>> byType(String type) async {
    final json = await appNetwork.get(
      MasrafyEndpoint(endpoint: ApiStrings.platformEnumerationsByType(type)),
    );
    final data = json is Map<String, dynamic> ? json['data'] : null;
    if (data is! List) return const [];
    return data
        .whereType<Map<String, dynamic>>()
        .map(PlatformEnumerationModel.fromJson)
        .toList(growable: false);
  }
}
