import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:injectable/injectable.dart';

import '../enums/storage_keys.dart';

@singleton
class SecureStorage {
  final _storage = const FlutterSecureStorage(
    aOptions: AndroidOptions(encryptedSharedPreferences: true),
    iOptions: IOSOptions(
      accessibility: KeychainAccessibility.first_unlock_this_device,
    ),
  );

  Future<void> setValue(StorageKeys key, String? value) =>
      _storage.write(key: key.name, value: value);

  Future<String?> getValue({required StorageKeys key}) =>
      _storage.read(key: key.name);

  Future<void> deleteValue(StorageKeys key) => _storage.delete(key: key.name);

  Future<void> deleteAll() => _storage.deleteAll();
}
