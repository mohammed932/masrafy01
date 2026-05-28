import 'dart:convert';

import 'package:dio/dio.dart';

/// Normalises any JSON-encoded `String` response body into its decoded
/// shape (`Map`, `List`, scalar — whatever the server sent).
///
/// **Why this exists.** Several Masrafy endpoints come back with a
/// JSON-encoded body wrapped in `Content-Type: text/plain` (or
/// otherwise mis-typed), so dio leaves `response.data` as a Dart
/// `String` instead of decoding it. Every downstream datasource then
/// has to add bespoke `String → Map.cast<String,dynamic>` /
/// `String → List.cast<…>` helpers. Doing it once here gives every
/// feature the contract it expects (`Map`, `List`, etc.) without any
/// per-call-site coercion.
///
/// **Where it sits.** Registered in `DioHelper` AFTER the
/// `DecryptionInterceptor` and BEFORE the logger. The decryption
/// interceptor decrypts encrypted bodies first; this interceptor
/// normalises whatever falls out (decrypted or not).
///
/// **Behaviour.**
/// Up to two decode passes — handles both single- and double-stringified
/// payloads in one shot:
///
/// - Pass 1: `'{"a":1}'` → `{a:1}` (Map). Stops here.
/// - Pass 1: `'"{\"a\":1}"'` → `'{"a":1}'` (still String, looks like JSON).
///   Pass 2: → `{a:1}` (Map). Stops.
/// - Pass 1: `'"hello"'` → `'hello'` (still String, doesn't look like
///   JSON). Stops, leaves as the scalar string the server intended.
/// - Pass 1 throws (not actually JSON) → original string preserved
///   (real text/plain bodies pass through).
///
/// The two-pass cap prevents infinite loops on adversarial input and
/// matches the worst-case observed in the wild (one extra
/// `JSON.stringify` from a misbehaving endpoint, never more).
class JsonNormalizationInterceptor extends Interceptor {
  const JsonNormalizationInterceptor();

  @override
  void onResponse(Response response, ResponseInterceptorHandler handler) {
    final data = response.data;
    if (data is String && data.isNotEmpty) {
      response.data = _decodeUntilNonString(data);
    }

    // Mirror Angular `HttpClient` (`responseType: 'json'`): when an `/api/*`
    // call lands on the SPA fallback (HTML body served by the CDN for an
    // unknown route or a misrouted request), surface it as a hard error
    // rather than letting datasources blind-cast HTML to `Map`/`List` and
    // crash downstream with a `_TypeError`.
    final body = response.data;
    final isHtml = body is String && body.trimLeft().startsWith('<');
    if (isHtml && _isApiPath(response.requestOptions.uri.path)) {
      handler.reject(
        DioException(
          requestOptions: response.requestOptions,
          response: response,
          type: DioExceptionType.badResponse,
          error:
              'API endpoint returned HTML — likely missing or routed to SPA fallback',
        ),
      );
      return;
    }
    handler.next(response);
  }

  static bool _isApiPath(String path) =>
      path.startsWith('/api/') || path.startsWith('api/');

  /// Walks the JSON-decode pipeline up to twice, stopping the moment it
  /// lands on a non-String value (Map / List / num / bool / null) or
  /// the moment a decode pass throws (genuinely non-JSON text body).
  ///
  /// We attempt `jsonDecode` unconditionally — the previous "first-char
  /// heuristic" mis-classified bodies with a leading BOM, whitespace,
  /// or unusual shapes and skipped decoding. `try/catch` already gives
  /// us the same "leave as-is for plain text" behaviour without the
  /// false-negatives.
  static dynamic _decodeUntilNonString(String body) {
    var current = body;
    for (var pass = 0; pass < 2; pass++) {
      final trimmed = current.trim();
      if (trimmed.isEmpty) return current;
      // Fast-path: HTML / XML bodies (typical for 401 redirects, server
      // error pages, or proxy responses) — skip the decode so we don't
      // surface a noisy `FormatException: Unexpected character <!…`
      // first-chance exception. The body stays as the raw String, and
      // downstream parsing handles it as plain text.
      if (trimmed.startsWith('<')) return current;
      final decoded = _tryDecode(trimmed);
      if (decoded == _kDecodeFailed) return current;
      if (decoded is! String) return decoded;
      current = decoded;
    }
    return current;
  }

  /// Sentinel distinct from any valid JSON value (incl. `null`) — lets
  /// the loop tell "decode failed" apart from "decoded to null".
  static const _kDecodeFailed = Object();

  static dynamic _tryDecode(String text) {
    try {
      return jsonDecode(text);
    } catch (_) {
      return _kDecodeFailed;
    }
  }
}
