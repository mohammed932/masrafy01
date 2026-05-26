import 'dart:async';
import 'dart:developer';
import 'dart:io' show Platform;

import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:injectable/injectable.dart';
import 'package:app/core/services/device_id_service.dart';
import 'package:app/features/notifications/data/models/request/register_fcm_token_request/register_fcm_token_request.dart';
import 'package:app/features/notifications/domain/usecases/notifications_usecase.dart';

/// Owns the FCM-token → backend handshake for `POST /api/notifications/fcm-token`.
///
/// Two entry points:
/// * [registerCurrentToken] — called once after every successful sign-in
///   (email + Google). Fetches the current FCM token and POSTs it.
/// * [startTokenRefreshListener] — wired once at app start (from `main.dart`).
///   Re-posts whenever Firebase rotates the token.
///
/// Failure is intentionally silent: a one-off network blip here must not block
/// the login flow. The backend tolerates duplicate registrations, so the next
/// successful call self-heals.
@lazySingleton
class FcmTokenRegistrar {
  FcmTokenRegistrar(this._messaging, this._useCase, this._deviceId);

  final FirebaseMessaging _messaging;
  final NotificationsUseCase _useCase;
  final DeviceIdService _deviceId;

  StreamSubscription<String>? _refreshSub;

  void startTokenRefreshListener() {
    _refreshSub ??= _messaging.onTokenRefresh.listen(
      _postToken,
      onError: (Object e, StackTrace st) {
        log('FcmTokenRegistrar refresh stream error: $e\n$st');
      },
    );
  }

  Future<void> registerCurrentToken() async {
    try {
      final token = await _messaging.getToken();
      if (token == null || token.isEmpty) {
        log('FcmTokenRegistrar: getToken() returned empty');
        return;
      }
      await _postToken(token);
    } catch (e, st) {
      log('FcmTokenRegistrar register error: $e\n$st');
    }
  }

  Future<void> _postToken(String token) async {
    final deviceId = await _deviceId.id;
    final result = await _useCase.registerFcmToken(RegisterFcmTokenRequest(
      token: token,
      platform: Platform.isIOS ? 'ios' : 'android',
      deviceId: deviceId,
    ));
    result.fold(
      (failure) =>
          log('FcmTokenRegistrar: backend rejected token — ${failure.runtimeType}'),
      (_) => log('FcmTokenRegistrar: token registered'),
    );
  }
}
