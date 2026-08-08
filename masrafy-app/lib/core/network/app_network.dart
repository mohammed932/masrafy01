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
        connectTimeout: const Duration(seconds: 15),
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
    await raw.put<void>(
      url,
      data: Stream<List<int>>.fromIterable([bytes]),
      options: Options(
        // S3/Spaces/MinIO answer errors with an application/xml <Error> body;
        // plain keeps it a String so `failureFromDio` can read the S3 code
        // instead of collapsing it into INTERNAL_ERROR.
        responseType: ResponseType.plain,
        headers: <String, dynamic>{
          Headers.contentTypeHeader: contentType,
          Headers.contentLengthHeader: bytes.length,
        },
      ),
    );
  }
}
