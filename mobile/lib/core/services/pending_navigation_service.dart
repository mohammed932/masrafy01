import 'package:auto_route/auto_route.dart';
import 'package:injectable/injectable.dart';

/// Single-slot holder for the `PageRouteInfo` the user was trying to reach
/// when the auth guard redirected them to Login. Consumed by the sign-in
/// success path so the app lands on the originally-intended destination.
@singleton
class PendingNavigationService {
  PageRouteInfo? _pending;

  void set(PageRouteInfo route) => _pending = route;

  PageRouteInfo? consume() {
    final value = _pending;
    _pending = null;
    return value;
  }

  void clear() => _pending = null;
}
