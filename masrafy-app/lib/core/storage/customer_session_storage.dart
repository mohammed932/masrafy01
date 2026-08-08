import 'package:flutter_secure_storage/flutter_secure_storage.dart';

import '../features/customer_photo/customer_photo_store.dart';

/// Persists the customer-JWT access + refresh tokens between launches.
/// Tokens land in `flutter_secure_storage` per Constitution Principle
/// XXVIII (v3.0.0 Network bullet) and Anti-Pattern A23 — never in
/// `shared_preferences`, asset files, or code.
class CustomerSessionStorage {
  CustomerSessionStorage(this._storage, this._photos);

  static const _kAccessToken = 'masrafy.customer.accessToken';
  static const _kRefreshToken = 'masrafy.customer.refreshToken';
  static const _kCustomerId = 'masrafy.customer.id';

  final FlutterSecureStorage _storage;
  final CustomerPhotoStore _photos;

  Future<void> save({
    required String accessToken,
    required String refreshToken,
    required String customerId,
  }) async {
    await Future.wait([
      _storage.write(key: _kAccessToken, value: accessToken),
      _storage.write(key: _kRefreshToken, value: refreshToken),
      _storage.write(key: _kCustomerId, value: customerId),
    ]);
  }

  Future<String?> readAccessToken() => _storage.read(key: _kAccessToken);
  Future<String?> readRefreshToken() => _storage.read(key: _kRefreshToken);
  Future<String?> readCustomerId() => _storage.read(key: _kCustomerId);

  Future<void> clear() async {
    // The session ending is the one event that invalidates the cached avatar —
    // this is every sign-out path (explicit logout, password reset, a refresh
    // that could not be rotated), so the next account never inherits a face.
    _photos.clear();
    await Future.wait([
      _storage.delete(key: _kAccessToken),
      _storage.delete(key: _kRefreshToken),
      _storage.delete(key: _kCustomerId),
    ]);
  }
}
