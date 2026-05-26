import 'dart:io';
import 'dart:typed_data';

import 'package:app/core/network/endpoint.dart';

abstract class BaseNetwork {
  Future<dynamic> get(
    PilotEndpoint endpoint, {
    Map<String, dynamic>? queryParameters,
  });

  Future<dynamic> post(
    PilotEndpoint endpoint, {
    Map<String, dynamic>? data,
  });

  Future<dynamic> put(
    PilotEndpoint endpoint, {
    Map<String, dynamic>? data,
  });

  Future<dynamic> patch(
    PilotEndpoint endpoint, {
    Map<String, dynamic>? data,
  });

  Future<dynamic> delete(
    PilotEndpoint endpoint, {
    Map<String, dynamic>? data,
  });

  Future<dynamic> upload(
    PilotEndpoint endpoint,
    Map<String, List<File>> files, {
    Map<String, dynamic>? data,
  });

  Future<dynamic> patchMultipart(
    PilotEndpoint endpoint,
    Map<String, String> fields, {
    Map<String, List<File>>? files,
  });

  Future<Uint8List> download(PilotEndpoint endpoint);
}
