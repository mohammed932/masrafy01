import 'dart:async';
import 'dart:developer';

import 'package:injectable/injectable.dart';
import 'package:app/core/router/masrafy_route_navigator.dart';
import 'package:app/features/notifications/domain/entities/notification_entity.dart';
import 'package:app/features/notifications/domain/usecases/notifications_usecase.dart';

/// Bridges notification surfaces (in-app cards + FCM data payloads) to the
/// shared [MasrafyRouteNavigator].
///
/// The backend ships the destination as `actionUrl` for personal notifications;
/// broadcast notifications (no `notificationId`) ship an empty `actionUrl` and
/// rely on the [type] code to pick a fallback destination — typically the
/// notifications list, where the user can dismiss them.
///
/// Tapping a personal notification (with `notificationId`) ALSO fires a
/// fire-and-forget `markRead` so the badge updates next time the list is
/// fetched.
@lazySingleton
class NotificationRouter {
  NotificationRouter(this._navigator, this._useCase);

  final MasrafyRouteNavigator _navigator;
  final NotificationsUseCase _useCase;

  static const _tag = 'NotificationRouter';

  // ── In-app surface ─────────────────────────────────────────────────────

  /// Called when the user taps a notification card from the in-app list. The
  /// list's own cubit handles `markAsRead` optimistically, so we only route.
  void handleEntityTap(NotificationEntity n) {
    final destination = _resolveDestination(
      actionUrl: n.actionUrl ?? '',
      type: null,
      commentId: n.metadata.commentId,
    );
    if (destination.isEmpty) {
      log('$_tag: nothing actionable for notification ${n.id}');
      return;
    }
    _navigator.pushPath(destination, tag: _tag);
  }

  // ── FCM data-payload surface ───────────────────────────────────────────

  /// Called from [PushNotificationService] when the user taps a system-tray
  /// notification (background, terminated, or local re-display).
  void handleTap(Map<String, dynamic> data) {
    final notificationId = _readString(data, 'notificationId');
    final actionUrl = _readString(data, 'actionUrl') ?? '';
    final type = _readString(data, 'type');
    final commentId = _readString(data, 'commentId');

    // Personal notification → mark as read on the server. Broadcasts have no
    // notificationId; the user dismisses them from the list instead.
    if (notificationId != null && notificationId.isNotEmpty) {
      unawaited(_useCase.markRead(notificationId));
    }

    final destination = _resolveDestination(
      actionUrl: actionUrl,
      type: type,
      commentId: commentId,
    );
    if (destination.isEmpty) {
      log('$_tag: no destination for type=$type id=$notificationId');
      return;
    }
    _navigator.pushPath(destination, tag: _tag);
  }

  // ── Resolution ─────────────────────────────────────────────────────────

  String _resolveDestination({
    required String actionUrl,
    required String? type,
    required String? commentId,
  }) {
    if (actionUrl.isNotEmpty) {
      return _withTabHint(actionUrl, commentId: commentId);
    }
    return _fallbackForType(type);
  }

  /// Broadcast notifications (and personal ones with an empty `actionUrl`)
  /// fall back to the route most closely tied to the [type]. Anything we
  /// don't recognise lands on the notifications list so the user can see and
  /// dismiss the message.
  String _fallbackForType(String? type) {
    switch (type) {
      case 'TRAINING':
        return '/dashboard';
      case 'ACHIEVEMENT':
        return '/achievements';
      case 'BILLING':
        return '/my-license';
      case 'SYSTEM':
      case 'SECURITY':
      default:
        return '/notifications';
    }
  }

  String _withTabHint(String rawUrl, {String? commentId}) {
    if (commentId == null || commentId.isEmpty) return rawUrl;
    final uri = Uri.tryParse(rawUrl);
    if (uri == null) return rawUrl;
    if (uri.queryParameters.containsKey('tab')) return rawUrl;
    return uri.replace(queryParameters: {
      ...uri.queryParameters,
      'tab': 'Comments',
    }).toString();
  }

  String? _readString(Map<String, dynamic> data, String key) {
    final value = data[key];
    if (value == null) return null;
    final str = value.toString();
    return str.isEmpty ? null : str;
  }
}
