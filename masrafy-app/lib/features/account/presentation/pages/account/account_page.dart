part of 'account.imports.dart';

/// Account menu (Figma `4028:4363`). A plain back-chip header over a list of
/// navigable menu cards and the navy "Ask Masrafy anything" support card, with
/// the shared bottom nav (the Menu tab is the active one). Reached from the
/// home/profile bottom-nav Menu tab. The single route-level widget for this
/// file (Principle XXXVI); the rows are static UI data, so no cubit is needed.
@RoutePage()
class AccountPage extends StatelessWidget {
  const AccountPage({super.key});

  @override
  Widget build(BuildContext context) {
    final colors = MasrafyColorTheme.of(context);
    final l = AppLocalizations.of(context);
    void soon() => MasrafyToast.info(context, l.common_coming_soon);

    final rows = <_AccountMenuItem>[
      _AccountMenuItem(
        icon: Icons.person,
        color: colors.primary.main,
        title: l.account_row_profile,
        onTap: () => context.router.push(const ProfileRoute()),
      ),
      _AccountMenuItem(
        icon: Icons.verified_user,
        color: colors.info.main,
        title: l.account_row_settings_security,
        onTap: () => context.router.push(const SettingsSecurityRoute()),
      ),
      _AccountMenuItem(
        icon: Icons.favorite,
        color: colors.error.main,
        title: l.account_row_saved_offers,
        onTap: () => context.router.push(SavedOffersRoute()),
      ),
      _AccountMenuItem(
        icon: Icons.description,
        color: colors.success.main,
        title: l.account_row_previous_applications,
        onTap: () => context.router.push(const PreviousApplicationsRoute()),
      ),
    ];

    return Scaffold(
      backgroundColor: colors.bg.layout,
      bottomNavigationBar: MasrafyAppBottomNav(
        active: MasrafyAppNavTab.menu,
        loansLabel: l.home_nav_loans,
        homeLabel: l.home_nav_home,
        menuLabel: l.home_nav_menu,
        onLoans: () =>
            context.router.replace(SavedOffersRoute(fromTab: true)),
        onHome: () => context.router.replaceAll([const HomeRoute()]),
        onMenu: () {},
      ),
      body: SafeArea(
        bottom: false,
        child: SingleChildScrollView(
          physics: const BouncingScrollPhysics(
            parent: AlwaysScrollableScrollPhysics(),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              MasrafyBackTitleHeader(title: l.account_title),
              Gap(17.h),
              Padding(
                padding: EdgeInsetsDirectional.symmetric(horizontal: 24.w),
                child: Column(
                  children: [
                    for (final r in rows) ...[
                      AccountMenuTile(
                        icon: r.icon,
                        iconColor: r.color,
                        title: r.title,
                        onTap: r.onTap,
                      ),
                      Gap(20.h),
                    ],
                    MasrafySupportCard(
                      label: l.home_support_label,
                      title: l.home_support_title,
                      onTap: soon,
                    ),
                    Gap(24.h),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Static description of one [AccountMenuTile] row.
class _AccountMenuItem {
  const _AccountMenuItem({
    required this.icon,
    required this.color,
    required this.title,
    required this.onTap,
  });

  final IconData icon;
  final Color color;
  final String title;
  final VoidCallback onTap;
}
