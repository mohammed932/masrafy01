part of 'previous_applications.imports.dart';

/// "Applications" — the user's previous loan applications (Figma `4088:296`),
/// reached from the Account screen's "Previous Applications" row. A plain
/// back-chip header (so A35 does not apply) over a scrolling list of
/// [PastApplicationCard]s, with the shared bottom nav (Menu tab active). The
/// single route-level widget for this file (Principle XXXVI). Backend-wired:
/// loads via [PreviousApplicationsCubit] (shimmer while loading, Principle
/// XXXIV).
@RoutePage()
class PreviousApplicationsPage extends StatelessWidget {
  const PreviousApplicationsPage({super.key});

  @override
  Widget build(BuildContext context) {
    return BlocProvider<PreviousApplicationsCubit>(
      create: (_) => getIt<PreviousApplicationsCubit>()..load(),
      child: const _PreviousApplicationsView(),
    );
  }
}

class _PreviousApplicationsView extends StatelessWidget {
  const _PreviousApplicationsView();

  @override
  Widget build(BuildContext context) {
    final colors = MasrafyColorTheme.of(context);
    final l = AppLocalizations.of(context);

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
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            MasrafyBackTitleHeader(
              title: l.previous_applications_title,
              onBack: () => context.router.maybePop(),
            ),
            Gap(17.h),
            Expanded(
              child: BlocBuilder<PreviousApplicationsCubit,
                  PreviousApplicationsState>(
                builder: (ctx, state) {
                  final cubit = ctx.read<PreviousApplicationsCubit>();
                  if (state.isLoading) return const _PreviousApplicationsShimmer();
                  if (state.isError) {
                    return MasrafyFetchErrorState(onRetry: cubit.load);
                  }
                  if (state.isEmpty) {
                    return MasrafyNoItemsState(
                      icon: Icons.description_outlined,
                      title: l.previous_applications_empty_title,
                      body: l.previous_applications_empty_body,
                    );
                  }
                  return SingleChildScrollView(
                    physics: const BouncingScrollPhysics(
                      parent: AlwaysScrollableScrollPhysics(),
                    ),
                    padding: EdgeInsetsDirectional.symmetric(horizontal: 24.w),
                    child: Column(
                      children: [
                        for (final app in state.applications) ...[
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
                  );
                },
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// Shape-matched loading skeleton — three past-application cards
/// (Principle XXXIV). Mirrors the KPI-row + status-pill layout of
/// [PastApplicationCard].
class _PreviousApplicationsShimmer extends StatelessWidget {
  const _PreviousApplicationsShimmer();

  @override
  Widget build(BuildContext context) {
    final colors = MasrafyColorTheme.of(context);
    return MasrafyShimmer(
      child: ListView.separated(
        physics: const NeverScrollableScrollPhysics(),
        padding: EdgeInsetsDirectional.symmetric(horizontal: 24.w),
        itemCount: 3,
        separatorBuilder: (_, __) => Gap(25.h),
        itemBuilder: (_, __) => Container(
          padding: EdgeInsetsDirectional.all(17.r),
          decoration: BoxDecoration(
            color: colors.bg.container,
            borderRadius: BorderRadius.circular(18.r),
            border: Border.all(color: colors.border.secondary),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        MasrafyShimmerBox(width: 160, height: 16, radius: 6),
                        Gap(6.h),
                        MasrafyShimmerBox(width: 110, height: 11, radius: 6),
                      ],
                    ),
                  ),
                  Gap(8.w),
                  MasrafyShimmerBox(width: 64, height: 20, radius: 999),
                ],
              ),
              Gap(12.h),
              Row(
                children: [
                  Expanded(child: MasrafyShimmerBox(height: 51, radius: 10)),
                  Gap(8.w),
                  Expanded(child: MasrafyShimmerBox(height: 51, radius: 10)),
                  Gap(8.w),
                  Expanded(child: MasrafyShimmerBox(height: 51, radius: 10)),
                ],
              ),
              Gap(12.h),
              MasrafyShimmerBox(height: 40, radius: 12),
            ],
          ),
        ),
      ),
    );
  }
}
