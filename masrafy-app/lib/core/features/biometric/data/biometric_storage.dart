import 'package:flutter_secure_storage/flutter_secure_storage.dart';

/// Persists whether the user opted into biometric login. Kept in
/// `flutter_secure_storage` (not `shared_preferences`) since this flag gates
/// access to an authenticated session — Constitution Principle XXVIII.
class BiometricStorage {
  BiometricStorage(this._storage);

  static const _kEnabled = 'masrafy.biometric.enabled';

  final FlutterSecureStorage _storage;

  Future<bool> readEnabled() async =>
      (await _storage.read(key: _kEnabled)) == 'true';

  Future<void> setEnabled(bool value) =>
      _storage.write(key: _kEnabled, value: value.toString());
}
