import 'package:flutter/material.dart';

import 'package:app/core/router/main_tab_navigator.dart';
import 'package:app/core/widgets/common/masrafy_app_bottom_nav.dart';
import 'package:app/l10n/generated/app_localizations.dart';

/// [MasrafyAppBottomNav] for screens pushed ABOVE the tab shell (Profile,
/// Settings, Previous Applications…). Tapping a tab pops back to the shell and
/// shows that tab with its state intact, instead of building a new root — one
/// switching behaviour everywhere (Principle XXXIII).
class MasrafyShellNavBar extends StatelessWidget {
  const MasrafyShellNavBar({super.key, required this.active});

  /// The tab this screen belongs to, so the nav reads as "still in Menu".
  final MasrafyAppNavTab active;

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    return MasrafyAppBottomNav(
      active: active,
      loansLabel: l.home_nav_loans,
      homeLabel: l.home_nav_home,
      menuLabel: l.home_nav_menu,
      onLoans: () => openMainTab(context, MasrafyAppNavTab.loans),
      onHome: () => openMainTab(context, MasrafyAppNavTab.home),
      onMenu: () => openMainTab(context, MasrafyAppNavTab.menu),
    );
  }
}
