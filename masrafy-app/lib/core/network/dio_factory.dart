import 'package:dio/dio.dart';

import '../environments/base_environment.dart';
import '../storage/customer_session_storage.dart';
import 'correlation_id_interceptor.dart';
import 'customer_jwt_interceptor.dart';
import 'interceptors/customer_jwt_refresh_interceptor.dart';

/// Builds the masrafy Dio client. Interceptor order matters:
///   1. CorrelationIdInterceptor        — stamps `X-Correlation-Id` on every
///      outgoing request (Principle VII).
///   2. CustomerJwtInterceptor          — attaches `Authorization: Bearer
///      \<accessToken\>` for `/api/v1/*` calls (Principle XIII v3.0.0).
///   3. CustomerJwtRefreshInterceptor   — on 401, silently rotates the JWT
///      via `/api/v1/auth/refresh` and retries once (Principle XXVIII).
class DioFactory {
  static Dio create({
    required BaseEnvironment env,
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
    dio.interceptors.add(
      CustomerJwtRefreshInterceptor(
        dio: dio,
        storage: sessionStorage,
        baseUrl: env.baseUrl,
      ),
    );
    return dio;
  }
}
