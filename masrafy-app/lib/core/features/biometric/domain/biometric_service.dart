import 'package:local_auth/local_auth.dart';
import 'package:flutter/services.dart';

import '../data/biometric_storage.dart';
import 'biometric_auth_result.dart';

/// Shared biometric (Face ID / fingerprint) concern used by both the
/// Settings & Security toggle and the app-launch/resume lock gate
/// (Principle XXXV — promoted to `core/features/` on second use).
class BiometricService {
  BiometricService(this._auth, this._storage);

  final LocalAuthentication _auth;
  final BiometricStorage _storage;

  Future<bool> isDeviceCapable() async {
    try {
      final supported = await _auth.isDeviceSupported();
      final canCheck = await _auth.canCheckBiometrics;
      return supported && canCheck;
    } on PlatformException {
      return false;
    }
  }

  /// `biometricOnly: true` — a device PIN/pattern fallback would defeat the
  /// biometric-only guarantee the Settings toggle promises the user.
  Future<BiometricAuthResult> authenticate({required String reason}) async {
    try {
      final ok = await _auth.authenticate(
        localizedReason: reason,
        options: const AuthenticationOptions(
          biometricOnly: true,
          stickyAuth: true,
        ),
      );
      return ok ? BiometricAuthResult.success : BiometricAuthResult.cancelled;
    } on PlatformException catch (e) {
      return switch (e.code) {
        'NotAvailable' || 'PasscodeNotSet' => BiometricAuthResult.notAvailable,
        'NotEnrolled' => BiometricAuthResult.notEnrolled,
        'LockedOut' || 'PermanentlyLockedOut' => BiometricAuthResult.lockedOut,
        _ => BiometricAuthResult.error,
      };
    }
  }

  Future<bool> get isEnabled => _storage.readEnabled();

  Future<void> setEnabled(bool value) => _storage.setEnabled(value);
}
