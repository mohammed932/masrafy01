import 'package:dio/dio.dart';
import 'package:uuid/uuid.dart';

/// Attaches `X-Correlation-Id` to every outgoing request so backend logs
/// and downstream services can stitch one user action across services.
///
/// Constitution Principle VII (Observability): every backend request
/// carries a correlation ID. Honor a caller-supplied value when present;
/// otherwise mint a fresh UUID v4. Backend echoes it back and binds it
/// to log lines.
class CorrelationIdInterceptor extends Interceptor {
  CorrelationIdInterceptor();

  static const String _correlationIdHeader = 'X-Correlation-Id';
  static const Uuid _uuid = Uuid();

  @override
  void onRequest(RequestOptions options, RequestInterceptorHandler handler) {
    final existing = options.headers[_correlationIdHeader];
    if (existing == null || (existing is String && existing.isEmpty)) {
      options.headers[_correlationIdHeader] = _uuid.v4();
    }
    handler.next(options);
  }
}
