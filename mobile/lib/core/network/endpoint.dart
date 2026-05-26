import 'package:app/core/environments/app_env.dart';
import 'package:app/core/injection/injection.dart';

class PilotEndpoint {
  final String? domain;
  final String endpoint;

  /// When `true`, request bodies sent to this endpoint MUST NOT be printed by
  /// the talker logger. Used for password-bearing endpoints to satisfy FR-033.
  final bool noLogBody;

  PilotEndpoint({
    this.domain,
    required this.endpoint,
    this.noLogBody = false,
  });

  /// Constructs the full URL by combining the base domain with the endpoint.
  String get fullUrl {
    final baseUrl = domain ?? getIt<AppEnv>().environment.baseUrl;
    return '$baseUrl/$endpoint';
  }
}
