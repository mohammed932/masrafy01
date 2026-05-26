import 'dart:math';

import 'package:injectable/injectable.dart';

import '../cache/secure_storage.dart';
import '../enums/storage_keys.dart';

/// Persistent per-install device identifier.
///
/// On iOS the underlying keychain survives app uninstalls, so reinstalling
/// the app preserves the ID (and therefore doesn't spuriously trigger the
/// active-session-on-another-device modal). On Android, EncryptedSharedPrefs
/// resets on uninstall — reinstalls look like a new device there.
@singleton
class DeviceIdService {
  final SecureStorage _storage;
  String? _cached;

  DeviceIdService(this._storage);

  Future<String> get id async {
    if (_cached != null) return _cached!;
    final existing = await _storage.getValue(key: StorageKeys.deviceId);
    if (existing != null && existing.isNotEmpty) {
      _cached = existing;
      return existing;
    }
    final generated = _generateUuidV4();
    await _storage.setValue(StorageKeys.deviceId, generated);
    _cached = generated;
    return generated;
  }

  /// UUID v4 without pulling in a dedicated package.
  static String _generateUuidV4() {
    final rnd = Random.secure();
    final bytes = List<int>.generate(16, (_) => rnd.nextInt(256));
    // Version 4: set bits as per RFC 4122.
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    String hex(int i) => bytes[i].toRadixString(16).padLeft(2, '0');
    return '${hex(0)}${hex(1)}${hex(2)}${hex(3)}-'
        '${hex(4)}${hex(5)}-'
        '${hex(6)}${hex(7)}-'
        '${hex(8)}${hex(9)}-'
        '${hex(10)}${hex(11)}${hex(12)}${hex(13)}${hex(14)}${hex(15)}';
  }
}
