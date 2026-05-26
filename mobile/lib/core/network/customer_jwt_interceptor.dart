import 'package:dio/dio.dart';

import '../storage/customer_session_storage.dart';

/// Attaches `Authorization: Bearer <customerAccessToken>` to outgoing mobile
/// requests when a logged-in session exists. HMAC headers are unaffected —
/// the backend `CustomerHmacJwtGuard` requires both layers on authenticated
/// writes (Constitution Principle XIII, v1.7.0 customer-auth paragraph).
class CustomerJwtInterceptor extends Interceptor {
  CustomerJwtInterceptor(this._storage);

  final CustomerSessionStorage _storage;

  @override
  Future<void> onRequest(
    RequestOptions options,
    RequestInterceptorHandler handler,
  ) async {
    final token = await _storage.readAccessToken();
    if (token != null && token.isNotEmpty) {
      options.headers['Authorization'] = 'Bearer $token';
    }
    handler.next(options);
  }
}
