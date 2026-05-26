import 'package:dio/dio.dart';

import '../models/customer_model.dart';

/// Thin remote datasource — speaks the masrafy backend `/api/v1/auth/*`
/// dialect. The Dio instance carries HMAC + customer-JWT interceptors so
/// callers only pass JSON.
class AuthRemoteDatasource {
  AuthRemoteDatasource(this._dio);

  final Dio _dio;

  Future<CustomerAuthEnvelopeModel> login({
    required String phone,
    required String password,
  }) async {
    final response = await _dio.post<Map<String, dynamic>>(
      '/api/v1/auth/login',
      data: {'phone': phone, 'password': password},
    );
    return CustomerAuthEnvelopeModel.fromJson(
      _unwrap(response.data ?? const {}),
    );
  }

  Future<CustomerAuthEnvelopeModel> signup({
    required String phone,
    required String name,
    required String password,
    String? email,
    String? locale,
  }) async {
    final body = <String, dynamic>{
      'phone': phone,
      'name': name,
      'password': password,
      if (email != null && email.isNotEmpty) 'email': email,
      if (locale != null) 'locale': locale,
    };
    final response = await _dio.post<Map<String, dynamic>>(
      '/api/v1/auth/signup',
      data: body,
    );
    return CustomerAuthEnvelopeModel.fromJson(
      _unwrap(response.data ?? const {}),
    );
  }

  Future<CustomerModel> me() async {
    final response = await _dio.get<Map<String, dynamic>>('/api/v1/auth/me');
    return CustomerModel.fromJson(_unwrap(response.data ?? const {}));
  }

  Future<void> logout({String? refreshToken}) async {
    await _dio.post<void>(
      '/api/v1/auth/logout',
      data: refreshToken == null ? null : {'refreshToken': refreshToken},
    );
  }

  Map<String, dynamic> _unwrap(Map<String, dynamic> envelope) {
    // Backend envelope: `{ success: true, data: {...} }`.
    final data = envelope['data'];
    if (data is Map<String, dynamic>) return data;
    return envelope;
  }
}
