import 'package:auto_route/auto_route.dart';
import 'package:flutter/widgets.dart';

import 'package:app/core/router/router.gr.dart';
import 'package:app/core/widgets/common/masrafy_app_bottom_nav.dart';

/// Which tab the shell is showing. The shell (`MainShellPage`) owns the three
/// tab bodies and listens here, so this is the single writable handle screens
/// pushed ABOVE the shell can use to jump tabs without rebuilding it.
final ValueNotifier<MasrafyAppNavTab> mainShellTab =
    ValueNotifier(MasrafyAppNavTab.home);

/// Shows [tab] in the shell, popping anything stacked on top of it. The shell
/// itself is never rebuilt, so the tab comes back exactly as it was left —
/// the standard tab-bar contract. Falls back to a fresh shell if it somehow
/// is not on the stack (e.g. a screen reached before login).
void openMainTab(BuildContext context, MasrafyAppNavTab tab) {
  mainShellTab.value = tab;
  final router = AutoRouter.of(context);
  if (router.isRouteActive(MainShellRoute.name)) {
    router.popUntilRouteWithName(MainShellRoute.name);
  } else {
    router.replaceAll([MainShellRoute(initialTab: tab)]);
  }
}
