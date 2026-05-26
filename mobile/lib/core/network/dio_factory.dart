import 'package:dio/dio.dart';

import '../environments/env_config.dart';
import '../storage/customer_session_storage.dart';
import 'customer_jwt_interceptor.dart';
import 'hmac_interceptor.dart';

/// Builds the masrafy Dio client. Interceptor order matters:
///   1. HmacInterceptor   — signs the (still-mutable) request
///   2. CustomerJwt       — adds Bearer header (NOT part of signature)
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
    dio.interceptors.add(HmacInterceptor(env));
    dio.interceptors.add(CustomerJwtInterceptor(sessionStorage));
    return dio;
  }
}
