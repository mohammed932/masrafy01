import 'package:auto_route/auto_route.dart';
import 'package:flutter/material.dart';

import 'package:app/features/auth/presentation/pages/login/login_screen.dart';

import 'guards/auth_guard.dart';

part 'router.gr.dart';

/// Masrafy mobile route registry. Starts lean — login + a placeholder
/// dashboard — and grows as each Phase 1 surface (signup, wizard, offers,
/// docs, support) lands. `build_runner` regenerates [router.gr.dart] when
/// new `@RoutePage` classes appear; until then [router.gr.dart] is hand-
/// written below to avoid a codegen prerequisite during initial bootstrap.
@AutoRouterConfig(replaceInRouteName: 'Page|Screen,Route')
class AppRouter extends RootStackRouter {
  AppRouter(this._authGuard);

  final AuthGuard _authGuard;

  @override
  List<AutoRoute> get routes => [
        AutoRoute(page: LoginRoute.page, path: '/auth/login', initial: true),
        AutoRoute(
          page: DashboardRoute.page,
          path: '/dashboard',
          guards: [_authGuard],
        ),
      ];
}

@RoutePage()
class DashboardPage extends StatelessWidget {
  const DashboardPage({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Masrafy'),
        backgroundColor: const Color(0xFF06152D),
        foregroundColor: Colors.white,
      ),
      body: const Center(
        child: Padding(
          padding: EdgeInsets.all(24),
          child: Text(
            'Signed in. Wizard + offers land in the next PR.',
            textAlign: TextAlign.center,
            style: TextStyle(fontSize: 16),
          ),
        ),
      ),
    );
  }
}
