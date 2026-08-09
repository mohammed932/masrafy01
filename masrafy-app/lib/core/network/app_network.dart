import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import 'package:injectable/injectable.dart';
import 'package:talker_dio_logger/talker_dio_logger.dart';

import 'endpoint.dart';
import 'network_interface.dart';

/// Concrete [BaseNetwork] backed by Dio. Correlation-id + customer-JWT
/// interceptors are attached by `DioFactory` before this instance lands
/// in DI — datasources only see the typed CRUD surface.
@LazySingleton(as: BaseNetwork)
class AppNetwork implements BaseNetwork {
  AppNetwork(this._dio);

  final Dio _dio;

  @override
  Future<dynamic> get(
    MasrafyEndpoint endpoint, {
    Map<String, dynamic>? queryParameters,
  }) async {
    final response = await _dio.get<dynamic>(
      endpoint.path,
      queryParameters: queryParameters,
    );
    return response.data;
  }

  @override
  Future<dynamic> post(
    MasrafyEndpoint endpoint, {
    Map<String, dynamic>? data,
  }) async {
    final response = await _dio.post<dynamic>(
      endpoint.path,
      data: data,
    );
    return response.data;
  }

  @override
  Future<dynamic> put(
    MasrafyEndpoint endpoint, {
    Map<String, dynamic>? data,
  }) async {
    final response = await _dio.put<dynamic>(
      endpoint.path,
      data: data,
    );
    return response.data;
  }

  @override
  Future<dynamic> patch(
    MasrafyEndpoint endpoint, {
    Map<String, dynamic>? data,
  }) async {
    final response = await _dio.patch<dynamic>(
      endpoint.path,
      data: data,
    );
    return response.data;
  }

  @override
  Future<dynamic> delete(
    MasrafyEndpoint endpoint, {
    Map<String, dynamic>? data,
  }) async {
    final response = await _dio.delete<dynamic>(
      endpoint.path,
      data: data,
    );
    return response.data;
  }

  @override
  Future<Uint8List> download(MasrafyEndpoint endpoint) async {
    final response = await _dio.get<List<int>>(
      endpoint.path,
      options: Options(responseType: ResponseType.bytes),
    );
    return Uint8List.fromList(response.data ?? const <int>[]);
  }

  @override
  Future<void> uploadBytes(
    String url,
    Uint8List bytes, {
    required String contentType,
  }) async {
    // Bare client: no base url, no auth interceptor — the presigned URL is
    // fully self-authorising and must not carry the customer bearer header.
    // Timeouts are explicit: object storage is a different host from the API,
    // so an unreachable/stalled bucket must fail as NETWORK_UNREACHABLE rather
    // than hang the upload spinner forever.
    final raw = Dio(
      BaseOptions(
        connectTimeout: _uploadConnectTimeout,
        sendTimeout: const Duration(seconds: 60),
        receiveTimeout: const Duration(seconds: 30),
      ),
    );
    if (kDebugMode) {
      raw.interceptors.add(
        TalkerDioLogger(
          settings: const TalkerDioLoggerSettings(
            printRequestHeaders: true,
            printRequestData: false,
          ),
        ),
      );
    }

    // Object storage sits on a different host + route than the API, and that
    // route drops a measurable slice of TCP connects on mobile networks — a
    // single stalled connect must not burn the whole capture. Retry only the
    // transport-level failures (a rejected signature is deterministic and
    // would just fail again), well inside the ticket's 5-minute expiry.
    for (var attempt = 1; ; attempt++) {
      try {
        await raw.put<void>(
          url,
          data: Stream<List<int>>.fromIterable([bytes]),
          options: Options(
            // S3/Spaces/MinIO answer errors with an application/xml <Error>
            // body; plain keeps it a String so `failureFromDio` can read the
            // S3 code instead of collapsing it into INTERNAL_ERROR.
            responseType: ResponseType.plain,
            headers: <String, dynamic>{
              Headers.contentTypeHeader: contentType,
              Headers.contentLengthHeader: bytes.length,
            },
          ),
        );
        return;
      } on DioException catch (error) {
        if (attempt >= _uploadMaxAttempts || !_isRetryableUpload(error)) {
          rethrow;
        }
        await Future<void>.delayed(_uploadRetryBackoff * attempt);
      }
    }
  }

  /// Transport failures only: the bucket was unreachable / stalled, or it
  /// answered 5xx. A 4xx (expired ticket, bad signature, size cap) is a
  /// deterministic rejection — retrying just spends the user's data.
  static bool _isRetryableUpload(DioException error) {
    switch (error.type) {
      case DioExceptionType.connectionTimeout:
      case DioExceptionType.connectionError:
      case DioExceptionType.sendTimeout:
      case DioExceptionType.receiveTimeout:
        return true;
      case DioExceptionType.badResponse:
        final status = error.response?.statusCode ?? 0;
        return status >= 500;
      case DioExceptionType.badCertificate:
      case DioExceptionType.cancel:
      case DioExceptionType.unknown:
        return false;
    }
  }
}

/// Shorter than the API's 15s: a connect that has not landed in 8s on this
/// route is a dropped one, and a fast fail buys a retry instead of a spinner.
const Duration _uploadConnectTimeout = Duration(seconds: 8);
const int _uploadMaxAttempts = 3;
const Duration _uploadRetryBackoff = Duration(milliseconds: 800);
