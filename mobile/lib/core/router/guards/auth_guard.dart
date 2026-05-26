import 'dart:developer';

import 'package:auto_route/auto_route.dart';

import '../../di/injection.dart';
import '../../storage/customer_session_storage.dart';
import '../router.dart';

/// Gates protected routes. Allows navigation when a customer access token
/// exists in [CustomerSessionStorage]; otherwise redirects to [LoginRoute].
///
/// Async by design: the secure-storage read can block the first frame.
/// Constitution Principle XIII customer JWT — token presence is the
/// signed-in signal; refresh on 401 lives in the JWT interceptor (next PR).
class AuthGuard extends AutoRouteGuard {
  AuthGuard(this._session);

  final CustomerSessionStorage _session;

  @override
  Future<void> onNavigation(
    NavigationResolver resolver,
    StackRouter router,
  ) async {
    final token = await _session.readAccessToken();
    if (token != null && token.isNotEmpty) {
      resolver.next(true);
      return;
    }
    resolver.next(false);
    Future.microtask(() {
      try {
        router.replaceAll([LoginRoute()]);
      } catch (e, st) {
        log('AuthGuard: replaceAll threw $e\n$st');
      }
    });
  }
}

/// Convenience accessor so route definitions can reference `authGuard`
/// without `getIt<AuthGuard>()` at every site.
AuthGuard get authGuard => getIt<AuthGuard>();
