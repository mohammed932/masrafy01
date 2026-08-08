import 'package:dio/dio.dart';
import 'package:equatable/equatable.dart';

/// Typed error surface (Constitution Principle III). Mobile UI maps `code`
/// to a localized message — NEVER displays raw English strings.
sealed class Failure extends Equatable {
  const Failure({required this.code, this.meta, this.httpStatus});

  final String code;
  final Map<String, dynamic>? meta;
  final int? httpStatus;

  @override
  List<Object?> get props => [code, meta, httpStatus];
}

class NetworkFailure extends Failure {
  const NetworkFailure() : super(code: 'NETWORK_UNREACHABLE');
}

class ServerFailure extends Failure {
  const ServerFailure({
    required super.code,
    super.meta,
    super.httpStatus,
  });
}

class UnknownFailure extends Failure {
  const UnknownFailure() : super(code: 'INTERNAL_ERROR');
}

/// Rejected on-device, before any request goes out (e.g. a picked image over
/// the upload budget). Carries the same typed `code` contract as a server
/// failure so the UI maps it through the existing switch (Principle III).
class LocalFailure extends Failure {
  const LocalFailure({required super.code, super.meta});
}

/// Translate a Dio error into a typed `Failure`. Maps the backend envelope
/// `{ success: false, code: "...", meta?: {...} }` directly.
Failure failureFromDio(DioException error) {
  if (error.type == DioExceptionType.connectionError ||
      error.type == DioExceptionType.connectionTimeout ||
      error.type == DioExceptionType.sendTimeout ||
      error.type == DioExceptionType.receiveTimeout) {
    return const NetworkFailure();
  }
  final response = error.response;
  if (response == null) return const UnknownFailure();
  final data = response.data;
  if (data is Map<String, dynamic> && data['code'] is String) {
    return ServerFailure(
      code: data['code'] as String,
      meta: data['meta'] is Map<String, dynamic>
          ? data['meta'] as Map<String, dynamic>
          : null,
      httpStatus: response.statusCode,
    );
  }
  // S3-compatible storage (presigned PUT) answers with an application/xml
  // <Error><Code>…</Code></Error> body, not the backend envelope. Keep the
  // localized code generic (Principle III) but carry the storage code in meta
  // so the failure is diagnosable instead of anonymous.
  final storageCode = _s3ErrorCode(data);
  return ServerFailure(
    code: 'INTERNAL_ERROR',
    meta: storageCode == null
        ? null
        : <String, dynamic>{'storageCode': storageCode},
    httpStatus: response.statusCode,
  );
}

/// Pull `<Code>X</Code>` out of an S3/MinIO/Spaces XML error body.
String? _s3ErrorCode(dynamic data) {
  if (data is! String) return null;
  final match = RegExp(r'<Code>([^<]+)</Code>').firstMatch(data);
  return match?.group(1);
}
