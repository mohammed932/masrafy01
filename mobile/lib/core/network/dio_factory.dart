import 'package:dio/dio.dart';

import '../environments/env_config.dart';
import '../storage/customer_session_storage.dart';
import 'correlation_id_interceptor.dart';
import 'customer_jwt_interceptor.dart';

/// Builds the masrafy Dio client. Interceptor order matters:
///   1. CorrelationIdInterceptor — stamps `X-Correlation-Id` on every
///      outgoing request (Principle VII).
///   2. CustomerJwtInterceptor   — attaches `Authorization: Bearer
///      \<accessToken\>` for `/api/v1/*` calls (Principle XIII v3.0.0).
///
/// Constitution v3.0.0 removed HMAC-SHA256 request signing platform-wide;
/// mobile API auth is now JWT-only (15-min access + 30-day refresh, with
/// server-side rotation + reuse detection).
class DioFactory {
  static Dio create({
    required EnvConfig env,
    required CustomerSessionStorage sessionStorage,
  }) {
    final dio = Dio(
      BaseOptions(
        baseUrl: env.baseUrl,
        connectTimeout: const Duration(seconds: 15),
        receiveTimeout: const Duration(seconds: 30),
        headers: const {'Content-Type': 'application/json'},
        responseType: ResponseType.json,
      ),
    );
    dio.interceptors.add(CorrelationIdInterceptor());
    dio.interceptors.add(CustomerJwtInterceptor(sessionStorage));
    return dio;
  }
}
