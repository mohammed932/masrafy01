import 'dart:async';
import 'dart:developer';

import 'package:app_links/app_links.dart';
import 'package:injectable/injectable.dart';
import 'package:app/core/router/pilot_route_navigator.dart';

/// Owns the cold-start + warm-stream deep-link pipeline. One instance
/// per app launch, registered as a `lazySingleton`.
///
/// Path → screen routing is delegated to [PilotRouteNavigator] so a
/// universal link (`https://api.masrafy.eg/dashboard`) and a
/// notification tap pointing at `/dashboard` flow through the exact
/// same normalize-then-push pipeline. Avoids drift between the two
/// surfaces.
///
/// Routing contract (matches the Angular web app's deep-link surface
/// so links from email / push / web all land in the same place):
///
/// | URL path                                      | Route                    |
/// |-----------------------------------------------|--------------------------|
/// | `/reset-password?...`                         | `ResetPasswordRoute`     |
/// | `/dashboard`                                  | `DashboardRoute`         |
/// | `/study-planner` / `/study-planner/plans/:id` | planner routes           |
/// | `/reports` / `/reports/:sessionId`            | reports routes           |
/// | `/e-shop/...`                                 | shop routes              |
/// | `/question-preview/:id`                       | `QuestionPreviewRoute`   |
@lazySingleton
class DeepLinkService {
  DeepLinkService(this._navigator);

  final PilotRouteNavigator _navigator;
  final AppLinks _appLinks = AppLinks();

  StreamSubscription<Uri>? _subscription;

  // De-dupe state: on Android cold-start the same URI arrives twice —
  // once via `getInitialLink()`, once via `uriLinkStream` — sometimes
  // hundreds of ms apart, sometimes seconds. Without this guard the
  // route is pushed twice, duplicate guard rejections show up in logs,
  // and any pending-nav slot is set twice.
  //
  // Strategy:
  //   1. Remember the cold-start URI we handled and silently drop the
  //      FIRST stream emission that matches it (whatever the delay).
  //   2. For everything else, apply a 5 s same-URI sliding window so a
  //      rapid double-fire (e.g. plugin re-emits) doesn't double-push.
  Uri? _initialUri;
  bool _initialMatchPending = false;
  Uri? _lastUri;
  DateTime? _lastUriAt;
  static const _dedupeWindow = Duration(seconds: 5);

  /// Call once after `Firebase.initializeApp` and `configureDependencies`.
  /// Safe to call multiple times — second call is a no-op.
  Future<void> init() async {
    if (_subscription != null) return;

    // Warm stream: app already running, OS hands a new URL via the
    // intent-filter / universal-link entitlement. Pushes immediately
    // because by definition the navigator is mounted.
    _subscription = _appLinks.uriLinkStream.listen(
      (uri) => _handle(uri, fromStream: true),
      onError: (Object e, StackTrace st) {
        log('DeepLinkService stream error: $e\n$st');
      },
    );

    // Cold start: capture the URL the OS used to open the process
    // and stash it. We do NOT push it ourselves — `SplashScreen`
    // consumes it after the auth-state resolver finishes, so the
    // deep-link push happens AFTER splash decides whether to land
    // on Login or Home. Pushing here directly raced the splash's
    // own `replaceAll` and the AuthGuard's redirect, leaving the
    // user staring at a blank navy screen.
    try {
      final initial = await _appLinks.getInitialLink();
      if (initial != null) {
        _initialUri = initial;
        _initialMatchPending = true;
      }
    } catch (e, st) {
      log('DeepLinkService initial-link error: $e\n$st');
    }
  }

  /// Returns the cold-start URI exactly once and clears it. Splash
  /// calls this after auth is resolved so it can route to the deep
  /// link target (or stash it for post-login resume).
  Uri? consumeInitialUri() {
    final uri = _initialUri;
    _initialUri = null;
    _initialMatchPending = false;
    return uri;
  }

  Future<void> dispose() async {
    await _subscription?.cancel();
    _subscription = null;
  }

  void _handle(Uri uri, {required bool fromStream}) {
    // Drop the stream's re-emission of the cold-start URI. Only the
    // FIRST stream emission matching the initial URI is suppressed —
    // a subsequent user click on the same link still passes through.
    if (fromStream && _initialMatchPending && uri == _initialUri) {
      _initialMatchPending = false;
      return;
    }
    if (fromStream) _initialMatchPending = false;

    final now = DateTime.now();
    if (_lastUri == uri &&
        _lastUriAt != null &&
        now.difference(_lastUriAt!) < _dedupeWindow) {
      return;
    }
    _lastUri = uri;
    _lastUriAt = now;
    _navigator.pushPath(uri, tag: 'DeepLinkService');
  }
}
