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
}
