part of 'saved_offers.imports.dart';

/// Saved Offers — the customer's bookmarked matches (Figma `4088:153`). A plain
/// back-title header over a scrolling list of [SavedOfferCard]s with the shared
/// bottom nav. Reached from Account ▸ Saved Offers. The single route-level
/// widget for this file (Principle XXXVI). Backend-wired: loads via
/// [SavedOffersCubit] (shimmer while loading, Principle XXXIV) and removes
/// (unsaves) optimistically.
@RoutePage()
class SavedOffersPage extends StatelessWidget {
  const SavedOffersPage({super.key, this.fromTab = false});

  /// `true` when opened via the My Loans bottom-nav tab (a tab root with
  /// nothing to pop) — hides the header back chip. `false` when pushed from
  /// the Account ▸ Saved Offers row, where back is meaningful.
  final bool fromTab;

  @override
  Widget build(BuildContext context) {
    return BlocProvider<SavedOffersCubit>(
      create: (_) => getIt<SavedOffersCubit>()..load(),
      child: _SavedOffersView(fromTab: fromTab),
    );
  }
}

class _SavedOffersView extends StatelessWidget {
  const _SavedOffersView({required this.fromTab});

  final bool fromTab;

  @override
  Widget build(BuildContext context) {
    final colors = MasrafyColorTheme.of(context);
    final l = AppLocalizations.of(context);

    return Scaffold(
      backgroundColor: colors.bg.layout,
      bottomNavigationBar: MasrafyAppBottomNav(
        active: MasrafyAppNavTab.loans,
        loansLabel: l.home_nav_loans,
        homeLabel: l.home_nav_home,
        menuLabel: l.home_nav_menu,
        onLoans: () {},
        onHome: () => context.router.replaceAll([const HomeRoute()]),
        onMenu: () => context.router.replaceAll([const AccountRoute()]),
      ),
      body: SafeArea(
        bottom: false,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            MasrafyBackTitleHeader(
              title: l.account_row_saved_offers,
              onBack: fromTab ? null : () => context.router.maybePop(),
            ),
            Gap(8.h),
            Expanded(
              child: BlocConsumer<SavedOffersCubit, SavedOffersState>(
                listenWhen: (p, c) =>
                    p.removeError != c.removeError && c.removeError != null,
                listener: (ctx, state) =>
                    MasrafyToast.error(ctx, _removeMessage(l, state.removeError!)),
                builder: (ctx, state) {
                  final cubit = ctx.read<SavedOffersCubit>();
                  if (state.isLoading) return const _SavedOffersShimmer();
                  if (state.isError) {
                    return MasrafyFetchErrorState(onRetry: cubit.load);
                  }
                  if (state.isEmpty) {
                    return MasrafyNoItemsState(
                      icon: Icons.favorite_border,
                      title: l.saved_offers_empty_title,
                      body: l.saved_offers_empty_body,
                    );
                  }
                  return ListView.separated(
                    physics: const BouncingScrollPhysics(
                      parent: AlwaysScrollableScrollPhysics(),
                    ),
                    padding: EdgeInsetsDirectional.fromSTEB(24.w, 17.h, 24.w, 24.h),
                    itemCount: state.offers.length,
                    separatorBuilder: (_, __) => Gap(16.h),
                    itemBuilder: (_, i) {
                      final offer = state.offers[i];
                      return SavedOfferCard(
                        offer: offer,
                        productLabel: loanTypeLabel(l, offer.loanTypeKey),
                        onView: () => _openDetails(ctx, offer),
                        onRemove: () => cubit.remove(offer.bankOfferId),
                      );
                    },
                  );
                },
              ),
            ),
          ],
        ),
      ),
    );
  }

  /// Rebuild a [MatchOffer] + [MatchResultsArgs] from the saved entity and reuse
  /// the existing Offer-Details screen.
  void _openDetails(BuildContext context, SavedOfferEntity e) {
    final offer = MatchOffer(
      approvalPct: e.approvalPct,
      termMonths: e.termMonths,
      ratePct: e.ratePct,
      monthly: e.monthly,
      totalLabel: e.totalLabel,
      totalInterest: e.totalInterest,
      totalLoan: e.totalLoan,
    );
    final summary = MatchResultsArgs(
      loanTypeKey: e.loanTypeKey,
      amount: e.amount,
      durationMonths: e.termMonths,
      offers: [offer],
    );
    context.router.push(OfferDetailsRoute(offer: offer, summary: summary));
  }

  String _removeMessage(AppLocalizations l, Failure f) {
    switch (f.code) {
      case 'NETWORK_UNREACHABLE':
        return l.error_network;
      default:
        return l.saved_offers_remove_failed;
    }
  }
}

/// Shape-matched loading skeleton — three saved-offer cards (Principle XXXIV).
class _SavedOffersShimmer extends StatelessWidget {
  const _SavedOffersShimmer();

  @override
  Widget build(BuildContext context) {
    final colors = MasrafyColorTheme.of(context);
    return MasrafyShimmer(
      child: ListView.separated(
        physics: const NeverScrollableScrollPhysics(),
        padding: EdgeInsetsDirectional.fromSTEB(24.w, 17.h, 24.w, 24.h),
        itemCount: 3,
        separatorBuilder: (_, __) => Gap(16.h),
        itemBuilder: (_, __) => Container(
          padding: EdgeInsetsDirectional.all(17.w),
          decoration: BoxDecoration(
            color: colors.bg.container,
            borderRadius: BorderRadius.circular(15.r),
            border: Border.all(color: colors.border.secondary),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              MasrafyShimmerBox(width: 180, height: 16, radius: 6),
              Gap(8.h),
              MasrafyShimmerBox(width: 120, height: 11, radius: 6),
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
              Row(
                children: [
                  Expanded(
                    flex: 2,
                    child: MasrafyShimmerBox(height: 42, radius: 10),
                  ),
                  Gap(8.w),
                  Expanded(child: MasrafyShimmerBox(height: 42, radius: 10)),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}
