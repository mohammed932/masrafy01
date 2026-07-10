import 'package:flutter/widgets.dart';

import '../../../router/router.gr.dart';
import 'biometric_lock_trigger.dart';

/// Fires the biometric lock check exactly once — the first time the router
/// lands on anything other than `SplashRoute`. Splash resolves session state
/// asynchronously then `replaceAll`s to its decision (Login/Onboarding/
/// CompleteProfile/Home), wiping any route pushed before that point; waiting
/// for this event (instead of guessing off the first rendered frame) is what
/// makes cold-start locking race-free.
class BiometricColdStartObserver extends NavigatorObserver {
  bool _handled = false;

  @override
  void didPush(Route<dynamic> route, Route<dynamic>? previousRoute) =>
      _check(route);

  @override
  void didReplace({Route<dynamic>? newRoute, Route<dynamic>? oldRoute}) =>
      _check(newRoute);

  void _check(Route<dynamic>? route) {
    if (_handled) return;
    final name = route?.settings.name;
    if (name == null || name == SplashRoute.name) return;
    _handled = true;
    maybeShowBiometricLock();
  }
}
