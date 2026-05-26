import 'dart:convert';
import 'dart:typed_data';

import 'package:convert/convert.dart';
import 'package:crypto/crypto.dart' as crypto;
import 'package:dio/dio.dart';
import 'package:pointycastle/export.dart';

import '../../environments/app_env.dart';
import '../../injection/injection.dart';

/// Mirrors the Angular `EncryptionInterceptor`. Decrypts response bodies
/// marked with `X-Encrypted: true` — AES-256-GCM, SHA-256(sharedSecret) as
/// the 32-byte key, 16-byte IV in the body, 16-byte GCM auth tag appended
/// to the ciphertext. Other responses pass through untouched.
///
/// Body shape (hex-encoded):
/// ```json
/// { "encrypted": { "data": "<ciphertext||authTag>", "iv": "<16-byte iv>" },
///   "timestamp": 1700000000000 }
/// ```
class DecryptionInterceptor extends Interceptor {
  DecryptionInterceptor();

  static const String _encryptedHeader = 'x-encrypted';
  static const int _ivLengthBytes = 16;
  static const int _authTagLengthBytes = 16;

  Uint8List? _cachedKey;

  Uint8List _key() {
    final cached = _cachedKey;
    if (cached != null) return cached;
    final secret = getIt<AppEnv>().environment.clientSecretKey;
    final digest = crypto.sha256.convert(utf8.encode(secret)).bytes;
    final derived = Uint8List.fromList(digest);
    _cachedKey = derived;
    return derived;
  }

  @override
  void onResponse(Response response, ResponseInterceptorHandler handler) {
    final flag = response.headers.value(_encryptedHeader);
    if (flag != 'true') {
      return handler.next(response);
    }
    // Body may come through as a parsed Map OR as a raw JSON string if
    // Dio didn't auto-decode (non-standard content-type, responseType
    // override, etc). Normalize to a Map either way.
    Map<String, dynamic>? bodyMap;
    final body = response.data;
    if (body is Map) {
      bodyMap = body.cast<String, dynamic>();
    } else if (body is String && body.isNotEmpty) {
      try {
        final decoded = jsonDecode(body);
        if (decoded is Map) bodyMap = decoded.cast<String, dynamic>();
      } catch (_) {
        // Leave bodyMap null — falls through to pass-through below.
      }
    }
    if (bodyMap == null) {
      return handler.next(response);
    }
    final envelope = bodyMap['encrypted'];
    if (envelope is! Map) {
      return handler.next(response);
    }
    final dataHex = envelope['data'];
    final ivHex = envelope['iv'];
    if (dataHex is! String || ivHex is! String) {
      return handler.next(response);
    }
    try {
      final plaintext = _decrypt(dataHex, ivHex);
      response.data = _decodeJson(utf8.decode(plaintext));
      return handler.next(response);
    } catch (e) {
      return handler.reject(
        DioException(
          requestOptions: response.requestOptions,
          response: response,
          type: DioExceptionType.badResponse,
          error: 'Failed to decrypt response: $e',
        ),
      );
    }
  }

  /// Decode `text` as JSON, then re-decode if the first pass yielded a
  /// JSON-encoded string that itself starts with `{` or `[` (some
  /// backend endpoints `JSON.stringify` the payload an extra time
  /// before encrypting). Without this, every datasource that casts
  /// `response.data as Map<String, dynamic>` blows up with
  /// `_TypeError (type 'String' is not a subtype of type
  /// 'Map<String, dynamic>' in type cast)` whenever it hits a
  /// double-encoded endpoint. Scalar string responses (e.g. an
  /// explanation rating returned as a plain `"7"`) pass through
  /// untouched.
  static dynamic _decodeJson(String text) {
    final first = jsonDecode(text);
    if (first is! String) return first;
    final trimmed = first.trim();
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
      try {
        return jsonDecode(trimmed);
      } catch (_) {
        // fall through and return the original string
      }
    }
    return first;
  }

  Uint8List _decrypt(String dataHex, String ivHex) {
    final blob = Uint8List.fromList(hex.decode(dataHex));
    final iv = Uint8List.fromList(hex.decode(ivHex));
    if (iv.length != _ivLengthBytes) {
      throw StateError('Invalid IV length: ${iv.length}');
    }
    if (blob.length < _authTagLengthBytes) {
      throw StateError('Ciphertext too short for GCM auth tag');
    }
    final cipher = GCMBlockCipher(AESEngine())
      ..init(
        false,
        AEADParameters(
          KeyParameter(_key()),
          _authTagLengthBytes * 8,
          iv,
          Uint8List(0),
        ),
      );
    return cipher.process(blob);
  }
}
