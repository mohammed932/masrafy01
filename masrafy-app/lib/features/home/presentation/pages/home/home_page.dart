part of 'home.imports.dart';

/// Home / loan-type selection (Figma `100:1503`). Gradient hero header over a
/// rounded body sheet holding the four loan-type cards, the support banner,
/// and the Continue CTA. Rendered as the Home tab of `MainShellPage`, which
/// owns the bottom nav — this is not a route of its own. Private leaf helpers
/// below. Content is static design data (the four constitution-locked
/// categories).
class HomePage extends StatelessWidget {
  const HomePage({super.key});

  @override
  Widget build(BuildContext context) {
    return BlocProvider<HomeCubit>(
      create: (_) => getIt<HomeCubit>()..loadProgramNames(),
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
    final isArabic = l.localeName.startsWith('ar');
    final cards = _cards(l);
    void soon() => MasrafyToast.info(context, l.common_coming_soon);
    final topInset = MediaQuery.of(context).viewPadding.top;

    return Scaffold(
      backgroundColor: colors.bg.layout,
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
                          // The second half of the request: which catalog
                          // program the customer is asking about, inside the
                          // category they picked above. Hidden — not shown
                          // empty — when the catalog offers none here, so a
                          // category an operator has not filled in still leads
                          // somewhere instead of dead-ending the customer.
                          if (state.isLoadingPrograms ||
                              state.programsForCategory.isNotEmpty) ...[
                            Gap(20.h),
                            MasrafySelectField<String>(
                              label: l.home_program_label,
                              hint: l.home_program_hint,
                              sheetTitle: l.home_program_label,
                              showSearch: state.programsForCategory.length > 8,
                              searchHint: l.home_program_search_hint,
                              isEnabled: !state.isLoadingPrograms,
                              value: state.programKey,
                              options: [
                                for (final p in state.programsForCategory)
                                  MasrafySelectOption(
                                    value: p.key,
                                    label: p.label(isArabic: isArabic),
                                  ),
                              ],
                              onSelected: cubit.selectProgram,
                            ),
                          ],
                          Gap(25.h),
                          MasrafySupportCard(
                            label: l.home_support_label,
                            title: l.home_support_title,
                            onTap: soon,
                          ),
                          Gap(25.h),
                          MasrafyGradientButton(
                            label: l.home_continue,
                            // Locked until the pair is complete: a category
                            // whose catalog offers names is not a request on
                            // its own. `canContinue` also covers the two cases
                            // where no name can be picked (still loading, or
                            // none offered) so the CTA is never dead.
                            onPressed: !state.canContinue
                                ? null
                                : () {
                                    final program = state.programKey;
                                    switch (state.selected) {
                                      case HomeLoanCategory.mortgage:
                                        ctx.router.push(
                                            MortgageQuestionnaireRoute(
                                                programNameKey: program));
                                      case HomeLoanCategory.car:
                                        ctx.router.push(CarQuestionnaireRoute(
                                            programNameKey: program));
                                      case HomeLoanCategory.business:
                                        ctx.router.push(
                                            BusinessQuestionnaireRoute(
                                                programNameKey: program));
                                      case HomeLoanCategory.personal:
                                        ctx.router.push(
                                            PersonalQuestionnaireRoute(
                                                programNameKey: program));
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

