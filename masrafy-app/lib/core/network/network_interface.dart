import 'dart:typed_data';

import 'endpoint.dart';

/// Network abstraction every feature's `BaseRemoteDataSource` consumes
/// (Constitution Principle XXX). Hides Dio specifics behind a typed
/// CRUD surface so datasources never import `package:dio/dio.dart`.
///
/// Concrete implementation: [AppNetwork] in `app_network.dart`, wrapping
/// the singleton Dio built by [DioFactory] (correlation-id + customer-JWT
/// interceptors already wired).
abstract class BaseNetwork {
  Future<dynamic> get(
    MasrafyEndpoint endpoint, {
    Map<String, dynamic>? queryParameters,
  });

  Future<dynamic> post(
    MasrafyEndpoint endpoint, {
    Map<String, dynamic>? data,
  });

  Future<dynamic> put(
    MasrafyEndpoint endpoint, {
    Map<String, dynamic>? data,
  });

  Future<dynamic> patch(
    MasrafyEndpoint endpoint, {
    Map<String, dynamic>? data,
  });

  Future<dynamic> delete(
    MasrafyEndpoint endpoint, {
    Map<String, dynamic>? data,
  });

  Future<Uint8List> download(MasrafyEndpoint endpoint);

  /// Raw binary `PUT` to an ABSOLUTE url (e.g. an S3/MinIO presigned upload
  /// URL). Runs on a bare client with NO base url and NO interceptors, so the
  /// customer-JWT bearer is never leaked to object storage and a 401 here can
  /// never recurse into the refresh interceptor.
  Future<void> uploadBytes(
    String url,
    Uint8List bytes, {
    required String contentType,
  });
}
