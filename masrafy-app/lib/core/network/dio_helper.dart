import 'dart:developer';
import 'dart:io';

import 'package:cookie_jar/cookie_jar.dart';
import 'package:dio/dio.dart';
import 'package:dio/io.dart';
import 'package:dio_cookie_manager/dio_cookie_manager.dart';
import 'package:flutter/foundation.dart';
import 'package:injectable/injectable.dart';
import 'package:internet_connection_checker/internet_connection_checker.dart';
import 'package:talker_dio_logger/talker_dio_logger_interceptor.dart';
import 'package:talker_dio_logger/talker_dio_logger_settings.dart';

import '../environments/app_env.dart';
import '../injection/injection.dart';
import '../services/auth/session_expiration_handler.dart';
import 'endpoint.dart';
import 'erros/exceptions.dart';
import 'interceptors/auth_error_interceptor.dart';
import 'interceptors/csrf_refresh_interceptor.dart';
import 'interceptors/decryption_interceptor.dart';
import 'interceptors/http_interceptor.dart';
import 'interceptors/json_normalization_interceptor.dart';
import 'network_interface.dart';

@LazySingleton(as: BaseNetwork)
class DioHelper implements BaseNetwork {
  final Dio dio = Dio();

  DioHelper() {
    dio.options.connectTimeout = const Duration(seconds: 30);
    dio.options.receiveTimeout = const Duration(seconds: 30);

    // Dev TLS bypass — unblocks login while the backend serves a broken
    // cert chain. Double-gated: only fires when the build is `kDebugMode`
    // AND the active env is not production. Release builds and the prod
    // env always validate TLS normally.
    if (kDebugMode && !getIt<AppEnv>().environment.isProduction) {
      (dio.httpClientAdapter as IOHttpClientAdapter).createHttpClient = () {
        final client = HttpClient();
        client.badCertificateCallback = (cert, host, port) {
          log('DEV TLS bypass: accepted cert for $host:$port');
          return true;
        };
        return client;
      };
    }

    // Shared cookie jar (DI singleton) — captures `Set-Cookie` response
    // headers (sessionId, XSRF-TOKEN) and attaches them on subsequent
    // requests. CookieManager must be the FIRST interceptor so cookies
    // are harvested before HttpInterceptor reads them for the
    // `X-XSRF-TOKEN` header. Sharing via DI lets the session-expiration
    // handler wipe the jar on force-logout.
    final cookieJar = getIt<CookieJar>();

    dio.interceptors.addAll([
      CookieManager(cookieJar),
      HttpInterceptor(cookieJar: cookieJar),
      CsrfRefreshInterceptor(dio),
      // Catches session-fatal 401/403 that CsrfRefresh couldn't recover
      // from and bounces the user to Login with a banner. Must run AFTER
      // CsrfRefreshInterceptor so a recoverable CSRF expiry doesn't
      // trigger a force-logout.
      // Lazy resolver — resolving SessionExpirationHandler eagerly here
      // would create a circular DI graph (its UnreadCountService leg
      // ultimately requires BaseNetwork, which is the very thing being
      // constructed). The closure runs on first error, by which point
      // the full container is wired.
      AuthErrorInterceptor(() => getIt<SessionExpirationHandler>()),
      // Decrypts responses flagged with `X-Encrypted: true`. Must run before
      // the logger so Talker prints plaintext bodies, not ciphertext.
      DecryptionInterceptor(),
      // Normalises any JSON-encoded `String` response body into its
      // decoded shape (Map / List / scalar). Runs after decryption so
      // it sees the plaintext. Eliminates per-datasource
      // `response as Map<String, dynamic>` workarounds for endpoints
      // that come back with `Content-Type: text/plain` + a JSON body.
      const JsonNormalizationInterceptor(),
      TalkerDioLogger(
        settings: TalkerDioLoggerSettings(
          printRequestHeaders: true,
          printResponseHeaders: true,
          printResponseMessage: true,
          // Skip logging entirely for endpoints flagged noLogBody: true
          // (password-bearing endpoints) so credentials never appear in logs.
          requestFilter: (options) => options.extra['noLogBody'] != true,
        ),
      ),
    ]);
  }

  @override
  Future<dynamic> get(
    MasrafyEndpoint endpoint, {
    Map<String, dynamic>? queryParameters,
  }) async {
    try {
      final response = await dio.get(
        endpoint.fullUrl,
        queryParameters: queryParameters,
        options: Options(extra: {'noLogBody': endpoint.noLogBody}),
      );
      return response.data;
    } on DioException catch (error) {
      throw await _handleError(error);
    }
  }

  @override
  Future<dynamic> post(
    MasrafyEndpoint endpoint, {
    Map<String, dynamic>? data,
  }) async {
    try {
      final response = await dio.post(
        endpoint.fullUrl,
        data: data,
        options: Options(extra: {'noLogBody': endpoint.noLogBody}),
      );
      return response.data;
    } on DioException catch (error) {
      throw await _handleError(error);
    }
  }

  @override
  Future<dynamic> put(
    MasrafyEndpoint endpoint, {
    Map<String, dynamic>? data,
  }) async {
    try {
      final response = await dio.put(
        endpoint.fullUrl,
        data: data,
        options: Options(extra: {'noLogBody': endpoint.noLogBody}),
      );
      return response.data;
    } on DioException catch (error) {
      throw await _handleError(error);
    }
  }

  @override
  Future<dynamic> patch(
    MasrafyEndpoint endpoint, {
    Map<String, dynamic>? data,
  }) async {
    try {
      final response = await dio.patch(
        endpoint.fullUrl,
        data: data,
        options: Options(extra: {'noLogBody': endpoint.noLogBody}),
      );
      return response.data;
    } on DioException catch (error) {
      throw await _handleError(error);
    }
  }

  @override
  Future<dynamic> delete(
    MasrafyEndpoint endpoint, {
    Map<String, dynamic>? data,
  }) async {
    try {
      final response = await dio.delete(
        endpoint.fullUrl,
        data: data,
        options: Options(extra: {'noLogBody': endpoint.noLogBody}),
      );
      return response.data;
    } on DioException catch (error) {
      throw await _handleError(error);
    }
  }

  @override
  Future<dynamic> upload(
    MasrafyEndpoint endpoint,
    Map<String, List<File>> files, {
    Map<String, dynamic>? data,
  }) async {
    try {
      final formData = FormData.fromMap(data ?? {});
      for (final entry in files.entries) {
        for (final file in entry.value) {
          formData.files.add(
            MapEntry(entry.key, await MultipartFile.fromFile(file.path)),
          );
        }
      }
      final response = await dio.post(
        endpoint.fullUrl,
        data: formData,
        options: Options(extra: {'noLogBody': endpoint.noLogBody}),
      );
      return response.data;
    } on DioException catch (error) {
      throw await _handleError(error);
    }
  }

  @override
  Future<dynamic> patchMultipart(
    MasrafyEndpoint endpoint,
    Map<String, String> fields, {
    Map<String, List<File>>? files,
  }) async {
    try {
      final formData = FormData.fromMap(fields);
      if (files != null) {
        for (final entry in files.entries) {
          for (final file in entry.value) {
            formData.files.add(
              MapEntry(entry.key, await MultipartFile.fromFile(file.path)),
            );
          }
        }
      }
      final response = await dio.patch(
        endpoint.fullUrl,
        data: formData,
        options: Options(extra: {'noLogBody': endpoint.noLogBody}),
      );
      return response.data;
    } on DioException catch (error) {
      throw await _handleError(error);
    }
  }

  @override
  Future<Uint8List> download(MasrafyEndpoint endpoint) async {
    try {
      final response = await dio.get<Uint8List>(
        endpoint.fullUrl,
        options: Options(
          responseType: ResponseType.bytes,
          extra: {'noLogBody': endpoint.noLogBody},
        ),
      );
      return response.data!;
    } on DioException catch (error) {
      throw await _handleError(error);
    }
  }

  Future<Exception> _handleError(DioException error) async {
    // TLS handshake / socket failures land here with `response == null` —
    // before the status-code switch can find anything useful. Without this
    // pre-check they fall through to `default: UnCaughtException()` and
    // surface as the unreadable "Instance of 'UnCaughtException'" banner.
    final inner = error.error;
    if (inner is HandshakeException) {
      log(
        'TLS handshake failed for ${error.requestOptions.uri}: ${inner.osError}',
      );
      return const ConnectivityException(
        "Couldn't establish a secure connection. Please try again later.",
      );
    }
    if (inner is SocketException) {
      log('Socket error for ${error.requestOptions.uri}: ${inner.osError}');
      return const ConnectivityException(
        "Couldn't reach the server. Check your connection and try again.",
      );
    }

    final hasConnection = await InternetConnectionChecker().hasConnection;
    if (!hasConnection) return const ConnectivityException();

    final status = error.response?.statusCode;
    final body = error.response?.data;
    final serverMessage = _extractMessage(body);

    // SPA-fallback guard: `JsonNormalizationInterceptor` rejects `/api/*`
    // responses whose body is HTML. Surface as a `ServerException` so the
    // failure carries a real message instead of `UnCaughtException` /
    // `_TypeError` from a downstream cast.
    if (body is String && body.trimLeft().startsWith('<')) {
      return const ServerException(
        'API endpoint returned HTML — try again or contact support.',
      );
    }

    switch (status) {
      case 400:
      case 422:
        if (_matches(serverMessage, AuthErrorCode.invalidActionCode) ||
            _matches(serverMessage, 'invalid-action-code') ||
            _matches(serverMessage, 'expired-action-code') ||
            _matches(serverMessage, 'invalid_action_code') ||
            _matches(serverMessage, 'oob_code') ||
            _matches(serverMessage, 'oobcode')) {
          return InvalidActionCodeException(
            serverMessage ?? 'Invalid or expired reset code',
          );
        }
        return BadRequestException(serverMessage ?? 'Bad request');
      case 401:
        if (_matches(serverMessage, AuthErrorCode.emailNotVerified) ||
            _matches(serverMessage, 'email not verified')) {
          return EmailNotVerifiedException(
            serverMessage ?? 'Email not verified',
          );
        }
        if (_matches(serverMessage, AuthErrorCode.accountDisabled) ||
            _matches(serverMessage, 'account disabled')) {
          return AccountDisabledException(
            serverMessage ?? 'Account disabled',
          );
        }
        if (_matches(serverMessage, AuthErrorCode.accountBanned) ||
            _matches(serverMessage, 'account banned') ||
            _matches(serverMessage, 'banned')) {
          return AccountBannedException(serverMessage ?? 'Account banned');
        }
        if (_matches(serverMessage, AuthErrorCode.invalidCredentials) ||
            _matches(serverMessage, 'invalid credentials')) {
          return InvalidCredentialsException(
            serverMessage ?? 'Invalid credentials',
          );
        }
        return UnauthorizedException(serverMessage ?? 'Unauthorized');
      case 403:
        return ForbiddenException(serverMessage ?? 'Forbidden');
      case 404:
        return const NotFoundException();
      case 429:
        final retryAfter = _parseRetryAfter(error.response?.headers);
        return RateLimitedException(
          retryAfter: retryAfter,
          msg: serverMessage,
        );
      case 409:
        return BadRequestException(serverMessage ?? 'Conflict');
      case 500:
        return const ServerException();
      default:
        return const UnCaughtException();
    }
  }

  /// Walks a NestJS-style error body and pulls out the human-readable
  /// message, regardless of nesting depth or array wrapping.
  ///
  /// NestJS's exception filter ships errors as either:
  ///   `{ message: "..." }`                         (simple String)
  ///   `{ message: ["...", "..."] }`                (validation array)
  ///   `{ message: { message: "...", error: ... } }`(nested envelope)
  ///   `{ message: { message: ["..."],  error: ... } }` (nested + array)
  /// Returning `null` if no usable string is found falls back to the
  /// generic per-status default ("Bad request", "Unauthorized", etc.).
  static String? _extractMessage(dynamic body) {
    if (body is! Map<String, dynamic>) return null;
    final raw = body['message'] ?? body['error'] ?? body['code'];
    return _stringifyMessage(raw);
  }

  static String? _stringifyMessage(dynamic value) {
    if (value is String) return value.isEmpty ? null : value;
    if (value is List) {
      final joined =
          value.whereType<String>().where((s) => s.isNotEmpty).join('\n');
      return joined.isEmpty ? null : joined;
    }
    if (value is Map<String, dynamic>) {
      final inner = value['message'] ?? value['error'] ?? value['code'];
      return _stringifyMessage(inner);
    }
    return null;
  }

  static bool _matches(String? message, String needle) =>
      message != null && message.toLowerCase().contains(needle.toLowerCase());

  static Duration? _parseRetryAfter(Headers? headers) {
    final raw = headers?.value('retry-after');
    if (raw == null) return null;
    final seconds = int.tryParse(raw);
    if (seconds != null) return Duration(seconds: seconds);
    return null;
  }
}
