part of 'previous_applications.imports.dart';

/// "Applications" — the user's previous loan applications (Figma `4088:296`),
/// reached from the Account screen's "Previous Applications" row. A plain
/// back-chip header (so A35 does not apply) over a scrolling list of
/// [PastApplicationCard]s, with the shared bottom nav (Menu tab active). The
/// single route-level widget for this file (Principle XXXVI); the list is a
/// static mock for this iteration (no customer applications API yet), so no
/// cubit is needed and the synchronous data needs no shimmer (Principle XXXIV).
@RoutePage()
class PreviousApplicationsPage extends StatelessWidget {
  const PreviousApplicationsPage({super.key});

  @override
  Widget build(BuildContext context) {
    final colors = MasrafyColorTheme.of(context);
    final l = AppLocalizations.of(context);
    final args = PreviousApplicationsArgs.mock();

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
        onMenu: () => context.router.maybePop(),
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
              MasrafyBackTitleHeader(
                title: l.previous_applications_title,
                onBack: () => context.router.maybePop(),
              ),
              Gap(17.h),
              Padding(
                padding: EdgeInsetsDirectional.symmetric(horizontal: 24.w),
                child: Column(
                  children: [
                    for (final app in args.items) ...[
                      PastApplicationCard(
                        application: app,
                        onViewOffer: () => context.router.push(
                          OfferDetailsRoute(
                            offer: app.offer,
                            summary: app.toSummary(),
                          ),
                        ),
                      ),
                      Gap(25.h),
                    ],
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
