import '../di/injection.dart';
import '../environments/app_env.dart';

/// Typed endpoint descriptor consumed by [BaseNetwork] implementations.
/// Combines a per-request path with an optional override domain.
class MasrafyEndpoint {
  MasrafyEndpoint({
    required this.endpoint,
    this.domain,
  });

  /// Path relative to the base URL — must start with `/`.
  final String endpoint;

  /// Optional absolute host override. Default: `AppEnv.environment.baseUrl`.
  final String? domain;

  /// Full URL combining base host with the per-call path.
  String get fullUrl {
    final baseUrl = domain ?? getIt<AppEnv>().environment.baseUrl;
    final cleanPath = endpoint.startsWith('/') ? endpoint : '/$endpoint';
    return '$baseUrl$cleanPath';
  }

  /// The path portion only — what Dio's `BaseOptions.baseUrl` concatenates
  /// against. Datasources pass this to Dio so the bearer-JWT interceptor
  /// can attach `Authorization` to the final request.
  String get path => endpoint.startsWith('/') ? endpoint : '/$endpoint';
}
