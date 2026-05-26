import 'dart:convert';
import 'dart:math';

import 'package:crypto/crypto.dart';
import 'package:dio/dio.dart';

import '../environments/env_config.dart';

/// Signs every outgoing request with HMAC-SHA256 per Constitution
/// Principle XIII. The backend `MobileHmacGuard` expects these headers:
///
///   X-Client-Id     — mobile-client identifier (matched server-side)
///   X-Timestamp     — unix seconds (±5min tolerance window)
///   X-Nonce         — base64-url random per request (Redis-deduped)
///   X-Body-SHA256   — hex sha256 of the raw body bytes
///   X-Signature     — hex(HMAC_SHA256(secret,
///                       "METHOD\npath\nts\nnonce\nbodyHash"))
///
/// Body must be the raw bytes Dio sends, NOT the encoded JSON. We capture
/// the JSON string after Dio's transformer runs (in `onRequest` after
/// `await handler.next(...)`-equivalent semantics by encoding inline) and
/// hash that.
class HmacInterceptor extends Interceptor {
  HmacInterceptor(this._env);

  final EnvConfig _env;
  final Random _random = Random.secure();

  @override
  void onRequest(RequestOptions options, RequestInterceptorHandler handler) {
    // Only sign mobile v1 routes; admin endpoints (/api/admin/...) use JWT
    // only and must NOT carry HMAC headers. Probe by path.
    if (!_shouldSign(options)) {
      return handler.next(options);
    }

    final method = options.method.toUpperCase();
    final path = _canonicalPath(options);
    final timestamp = (DateTime.now().millisecondsSinceEpoch ~/ 1000).toString();
    final nonce = _newNonce();
    final bodyBytes = _bodyBytes(options);
    final bodyHash = sha256.convert(bodyBytes).toString();
    final canonical = '$method\n$path\n$timestamp\n$nonce\n$bodyHash';
    final signature = Hmac(sha256, utf8.encode(_env.hmacSecret))
        .convert(utf8.encode(canonical))
        .toString();

    options.headers['X-Client-Id'] = _env.hmacClientId;
    options.headers['X-Timestamp'] = timestamp;
    options.headers['X-Nonce'] = nonce;
    options.headers['X-Body-SHA256'] = bodyHash;
    options.headers['X-Signature'] = signature;

    handler.next(options);
  }

  bool _shouldSign(RequestOptions options) {
    final path = options.path.startsWith('http')
        ? Uri.parse(options.path).path
        : options.path;
    return path.startsWith('/api/v1/') || path.startsWith('/v1/');
  }

  String _canonicalPath(RequestOptions options) {
    // Backend computes `originalUrl.split('?')[0]`. Mirror that.
    final raw = options.path.startsWith('http')
        ? Uri.parse(options.path).path
        : options.path;
    // Ensure /api prefix matches what the server sees — baseUrl carries it.
    if (raw.startsWith('/api/')) return raw;
    final basePath = Uri.parse(_env.baseUrl).path;
    final prefix = basePath.endsWith('/')
        ? basePath.substring(0, basePath.length - 1)
        : basePath;
    return '$prefix$raw';
  }

  List<int> _bodyBytes(RequestOptions options) {
    final data = options.data;
    if (data == null) return const <int>[];
    if (data is String) return utf8.encode(data);
    if (data is List<int>) return data;
    // Dio's default JSON transformer serializes maps/lists to a string; we
    // mirror that here so the signature matches what eventually goes on the
    // wire.
    return utf8.encode(jsonEncode(data));
  }

  String _newNonce() {
    final bytes = List<int>.generate(16, (_) => _random.nextInt(256));
    return base64Url.encode(bytes).replaceAll('=', '');
  }
}
