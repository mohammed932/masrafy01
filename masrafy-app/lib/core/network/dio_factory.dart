import 'package:curl_logger_dio_interceptor/curl_logger_dio_interceptor.dart';
import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import 'package:talker_dio_logger/talker_dio_logger.dart';

import '../environments/base_environment.dart';
import '../storage/customer_session_storage.dart';
import 'customer_jwt_interceptor.dart';
import 'interceptors/customer_jwt_refresh_interceptor.dart';

/// Builds the masrafy Dio client. Interceptor order matters:
///   1. CustomerJwtInterceptor          — attaches `Authorization: Bearer
///      \<accessToken\>` for `/api/v1/*` calls (Principle XIII v3.0.0).
///   2. CustomerJwtRefreshInterceptor   — on 401, silently rotates the JWT
///      via `/api/v1/auth/refresh` and retries once (Principle XXVIII).
///   3. CurlLoggerDioInterceptor        — debug-only, prints each request as
///      a copy-pasteable curl command (+ response).
///   4. TalkerDioLogger                 — debug-only, structured req/res
///      log; last so both loggers see final headers + retried requests.
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
    dio.interceptors.add(CustomerJwtInterceptor(sessionStorage));
    dio.interceptors.add(
      CustomerJwtRefreshInterceptor(
        dio: dio,
        storage: sessionStorage,
        baseUrl: env.baseUrl,
      ),
    );
    if (kDebugMode) {
      dio.interceptors.add(CurlLoggerDioInterceptor(printOnSuccess: true));
      dio.interceptors.add(
        TalkerDioLogger(
          settings: const TalkerDioLoggerSettings(
            printRequestHeaders: true,
            printResponseHeaders: false,
          ),
        ),
      );
    }
    return dio;
  }
}
