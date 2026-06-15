import 'package:auto_route/auto_route.dart';

/// App router. Routes are intentionally empty — the feature layer is an empty
/// scaffold pending a clean rebuild, so there are no pages to register yet.
/// Re-add `AutoRoute(page: ...Route.page)` entries (and regenerate
/// `router.gr.dart`) as each feature's presentation tier is rebuilt.
@AutoRouterConfig(replaceInRouteName: 'Page|Screen,Route')
class AppRouter extends RootStackRouter {
  AppRouter();

  @override
  List<AutoRoute> get routes => [];
}
