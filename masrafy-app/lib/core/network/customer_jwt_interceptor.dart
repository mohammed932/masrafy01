import 'package:dio/dio.dart';

import '../storage/customer_session_storage.dart';

/// Attaches `Authorization: Bearer <customerAccessToken>` to outgoing mobile
/// requests when a logged-in session exists.
///
/// Constitution Principle XIII (v3.0.0): mobile API is JWT-only — HMAC
/// signing was removed platform-wide. The backend's customer-JWT guard
/// is the sole auth layer on `/api/v1/*`.
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
