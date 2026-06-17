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
      bottomNavigationBar: MasrafyAppBottomNav(
        active: MasrafyAppNavTab.home,
        loansLabel: l.home_nav_loans,
        menuLabel: l.home_nav_menu,
        onLoans: soon,
        onHome: () {},
        onMenu: () => context.router.push(const AccountRoute()),
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
                          MasrafySupportCard(
                            label: l.home_support_label,
                            title: l.home_support_title,
                            onTap: soon,
                          ),
                          Gap(25.h),
                          MasrafyGradientButton(
                            label: l.home_continue,
                            onPressed: () {
                              switch (state.selected) {
                                case HomeLoanCategory.mortgage:
                                  ctx.router.push(
                                      const MortgageQuestionnaireRoute());
                                case HomeLoanCategory.car:
                                  ctx.router
                                      .push(const CarQuestionnaireRoute());
                                case HomeLoanCategory.business:
                                  ctx.router.push(
                                      const BusinessQuestionnaireRoute());
                                case HomeLoanCategory.personal:
                                  soon();
                              }
                            },
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

