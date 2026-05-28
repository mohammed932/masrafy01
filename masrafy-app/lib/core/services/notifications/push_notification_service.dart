import 'dart:convert';
import 'dart:developer';

import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/rendering.dart';
import 'package:injectable/injectable.dart';

import 'local_notification_service.dart';
import 'notification_router.dart';

/// Owns the Firebase Cloud Messaging (FCM) pipeline: permission prompt,
/// foreground re-display via [LocalNotificationService], and tap-to-route
/// for background / terminated / local-redisplay surfaces. Tap delivery
/// converges on [NotificationRouter] so every entry point (FCM
/// `onMessageOpenedApp`, FCM `getInitialMessage`, local-notification tap)
/// flows through the same router.
@lazySingleton
class PushNotificationService {
  final FirebaseMessaging _messaging;
  final LocalNotificationService _localNotifications;
  final NotificationRouter _notificationRouter;

  PushNotificationService(
    this._messaging,
    this._localNotifications,
    this._notificationRouter,
  );

  Future<void> init() async {
    await requestPermission();

    await _localNotifications.init(onTap: _onLocalNotificationTap);

    FirebaseMessaging.onMessage.listen(_onForegroundMessage);

    FirebaseMessaging.onMessageOpenedApp.listen((message) {
      _notificationRouter.handleTap(Map<String, dynamic>.from(message.data));
    });

    final initialMessage = await _messaging.getInitialMessage();
    if (initialMessage != null) {
      _notificationRouter.handleTap(
        Map<String, dynamic>.from(initialMessage.data),
      );
    }
  }

  void _onForegroundMessage(RemoteMessage message) {
    final notification = message.notification;
    if (notification == null) return;

    _localNotifications.show(
      id: message.messageId.hashCode,
      title: notification.title ?? '',
      body: notification.body ?? '',
      payload: message.data.isEmpty ? null : jsonEncode(message.data),
    );
  }

  void _onLocalNotificationTap(String? payload) {
    if (payload == null || payload.isEmpty) return;
    try {
      final data = jsonDecode(payload);
      if (data is Map<String, dynamic>) {
        _notificationRouter.handleTap(data);
      }
    } catch (e) {
      log('Invalid notification payload: $payload — $e');
    }
  }

  Future<String?> getToken() async {
    String fcmToken = await _messaging.getToken() ?? '';
    debugPrint('FCM token: $fcmToken');
    return fcmToken;
  }

  Future<bool> requestPermission() async {
    final settings = await _messaging.requestPermission(
      alert: true,
      badge: true,
      sound: true,
    );
    return settings.authorizationStatus == AuthorizationStatus.authorized ||
        settings.authorizationStatus == AuthorizationStatus.provisional;
  }
}
