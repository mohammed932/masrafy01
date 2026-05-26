import 'package:auto_route/auto_route.dart';

/// Empty router — presentation tier is being rebuilt post-Figma per
/// stakeholder request. Re-add routes here as features land their
/// `@RoutePage` screens. The `AppRouter` registration is retained so DI
/// + `MaterialApp.router` integration remain wired.
@AutoRouterConfig(replaceInRouteName: 'Page|Screen,Route')
class AppRouter extends RootStackRouter {
  AppRouter();

  @override
  List<AutoRoute> get routes => const [];
}
