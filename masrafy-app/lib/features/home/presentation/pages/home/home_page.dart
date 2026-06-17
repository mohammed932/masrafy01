part of 'home.imports.dart';

/// Home / loan-type selection (Figma `100:1503`). Gradient hero header over a
/// rounded body sheet holding the four loan-type cards, the support banner,
/// and the Continue CTA, with a bottom nav bar. Single route-level widget
/// (Principle XXXVI); private leaf helpers below. Content is static design
/// data (the four constitution-locked categories).
@RoutePage()
class HomePage extends StatelessWidget {
  const HomePage({super.key});

  @override
  Widget build(BuildContext context) {
    return BlocProvider<HomeCubit>(
      create: (_) => getIt<HomeCubit>(),
      child: const _HomeView(),
    );
  }
}

class _HomeView extends StatelessWidget {
  const _HomeView();

  List<_LoanCardData> _cards(AppLocalizations l) => [
        _LoanCardData(HomeLoanCategory.personal, MasrafyAssets.homeIconPersonal,
            l.home_cat_personal, l.home_limit_personal, l.home_apr_personal),
        _LoanCardData(HomeLoanCategory.mortgage, MasrafyAssets.homeIconMortgage,
            l.home_cat_mortgage, l.home_limit_mortgage, l.home_apr_mortgage),
        _LoanCardData(HomeLoanCategory.car, MasrafyAssets.homeIconCar,
            l.home_cat_car, l.home_limit_car, l.home_apr_car),
        _LoanCardData(HomeLoanCategory.business, MasrafyAssets.homeIconBusiness,
            l.home_cat_business, l.home_limit_business, l.home_apr_business),
      ];

  @override
  Widget build(BuildContext context) {
    final colors = MasrafyColorTheme.of(context);
    final text = MasrafyTextTheme.of(context);
    final l = AppLocalizations.of(context);
    final cards = _cards(l);
    void soon() => MasrafyToast.info(context, l.common_coming_soon);
    final topInset = MediaQuery.of(context).viewPadding.top;

    return Scaffold(
      backgroundColor: colors.bg.layout,
      bottomNavigationBar: _HomeBottomNav(
        loansLabel: l.home_nav_loans,
        profileLabel: l.home_nav_profile,
        onTap: soon,
      ),
      body: BlocBuilder<HomeCubit, HomeState>(
        builder: (ctx, state) {
          final cubit = ctx.read<HomeCubit>();
          Widget card(int i) {
            final c = cards[i];
            return HomeLoanCard(
              icon: c.icon,
              title: c.title,
              limit: c.limit,
              apr: c.apr,
              selected: state.selected == c.category,
              onTap: () => cubit.selectCategory(c.category),
            );
          }

          return CustomScrollView(
            physics: const BouncingScrollPhysics(
              parent: AlwaysScrollableScrollPhysics(),
            ),
            slivers: [
              SliverPersistentHeader(
                pinned: true,
                delegate: MasrafySliverGradientHeaderDelegate(
                  title: l.home_title,
                  subtitle: l.home_subtitle,
                  expandedHeight: MasrafyGradientHeader.expandedHeightFor(
                    ctx,
                    title: l.home_title,
                    subtitle: l.home_subtitle,
                    minHeight: 180.h,
                  ),
                  collapsedHeight: topInset + kToolbarHeight + 14,
                ),
              ),
              SliverToBoxAdapter(
                child: Transform.translate(
                  offset: Offset(0, -28.h),
                  child: Container(
                    width: double.infinity,
                    decoration: BoxDecoration(
                      color: colors.bg.layout,
                      borderRadius: BorderRadiusDirectional.only(
                        topStart: Radius.circular(28.r),
                        topEnd: Radius.circular(28.r),
                      ),
                    ),
                    child: Padding(
                      padding: EdgeInsetsDirectional.fromSTEB(24.w, 40.h, 24.w, 24.h),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            l.home_loan_types,
                            style: text.bodySmall.bold().copyWith(
                                  color: colors.text.heading,
                                ),
                          ),
                          Gap(12.h),
                          Row(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Expanded(child: card(0)),
                              Gap(10.w),
                              Expanded(child: card(1)),
                            ],
                          ),
                          Gap(10.h),
                          Row(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Expanded(child: card(2)),
                              Gap(10.w),
                              Expanded(child: card(3)),
                            ],
                          ),
                          Gap(25.h),
                          _SupportBanner(
                            label: l.home_support_label,
                            title: l.home_support_title,
                            onTap: soon,
                          ),
                          Gap(25.h),
                          MasrafyGradientButton(
                            label: l.home_continue,
                            onPressed: () =>
                                state.selected == HomeLoanCategory.mortgage
                                    ? ctx.router.push(
                                        const MortgageQuestionnaireRoute())
                                    : soon(),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
              ),
            ],
          );
        },
      ),
    );
  }
}

class _LoanCardData {
  const _LoanCardData(this.category, this.icon, this.title, this.limit, this.apr);
  final HomeLoanCategory category;
  final String icon;
  final String title;
  final String limit;
  final String apr;
}

/// Navy "Ask Masrafy anything" support banner (Figma `137:2966`).
class _SupportBanner extends StatelessWidget {
  const _SupportBanner({
    required this.label,
    required this.title,
    required this.onTap,
  });
  final String label;
  final String title;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = MasrafyColorTheme.of(context);
    final text = MasrafyTextTheme.of(context);
    return InkWell(
      borderRadius: BorderRadius.circular(18.r),
      onTap: onTap,
      child: Container(
        padding: EdgeInsetsDirectional.all(17.r),
        decoration: BoxDecoration(
          color: Color.lerp(colors.primary.active, Colors.black, 0.4),
          borderRadius: BorderRadius.circular(18.r),
          border: Border.all(color: colors.secondary.main.withValues(alpha: 0.2)),
        ),
        child: Row(
          children: [
            Container(
              width: 46.r,
              height: 46.r,
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(14.r),
                border: Border.all(
                  color: colors.secondary.main.withValues(alpha: 0.3),
                ),
              ),
              child: Icon(
                Icons.support_agent_outlined,
                color: colors.secondary.hover,
                size: 24.r,
              ),
            ),
            Gap(14.w),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    label.toUpperCase(),
                    style: text.caption.bold().copyWith(
                          color: colors.secondary.hover,
                          letterSpacing: 0.8,
                        ),
                  ),
                  Gap(2.h),
                  Text(
                    title,
                    style: text.bodySmall.bold().copyWith(color: colors.white),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// Bottom navigation bar — My Loans / Home (active) / Profile (Figma `137:2976`).
class _HomeBottomNav extends StatelessWidget {
  const _HomeBottomNav({
    required this.loansLabel,
    required this.profileLabel,
    required this.onTap,
  });
  final String loansLabel;
  final String profileLabel;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = MasrafyColorTheme.of(context);
    final text = MasrafyTextTheme.of(context);
    Widget item(IconData icon, String label) => InkWell(
          onTap: onTap,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(icon, size: 20.r, color: colors.primary.main),
              Gap(2.h),
              Text(
                label,
                style: text.caption.copyWith(color: colors.primary.main),
              ),
            ],
          ),
        );

    return Container(
      color: colors.bg.container,
      padding: EdgeInsetsDirectional.only(top: 8.h, bottom: 15.h),
      child: SafeArea(
        top: false,
        child: Row(
          mainAxisAlignment: MainAxisAlignment.spaceEvenly,
          children: [
            item(Icons.favorite_border, loansLabel),
            Container(
              width: 45.r,
              height: 45.r,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: colors.primary.main,
                border: Border.all(color: colors.white, width: 4),
              ),
              child: Icon(Icons.home_rounded, color: colors.white, size: 22.r),
            ),
            item(Icons.person_outline, profileLabel),
          ],
        ),
      ),
    );
  }
}
