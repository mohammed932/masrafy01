part of 'results.imports.dart';

/// Offers list — "Your top matches are ready" (Figma `2040:1253`). A collapsing
/// gradient sliver hero (per Principle XXXIII / A35) over a rounded sheet that
/// stacks the loan-summary card and the ranked [MatchOfferCard]s. The single
/// route-level widget for this file (Principle XXXVI). The offers are fetched
/// live: [MatchingResultsCubit] runs `/api/v1/apply` from [MatchResultsArgs]'
/// request; a shape-matched shimmer shows while loading (Principle XXXIV).
@RoutePage()
class MatchResultsPage extends StatelessWidget {
  const MatchResultsPage({super.key, required this.args});

  final MatchResultsArgs args;

  @override
  Widget build(BuildContext context) {
    final request = args.request;
    if (request == null) {
      // Static offers (saved-offer / past-application summaries, tests) — no
      // apply call, no cubit needed.
      return _MatchResultsView(args: args);
    }
    return BlocProvider<MatchingResultsCubit>(
      create: (_) => getIt<MatchingResultsCubit>()..submit(request),
      child: _MatchResultsView(args: args),
    );
  }
}

class _MatchResultsView extends StatelessWidget {
  const _MatchResultsView({required this.args});

  final MatchResultsArgs args;

  @override
  Widget build(BuildContext context) {
    final colors = MasrafyColorTheme.of(context);
    final l = AppLocalizations.of(context);
    final topInset = MediaQuery.of(context).viewPadding.top;

    return Scaffold(
      backgroundColor: colors.bg.layout,
      body: CustomScrollView(
        physics: const BouncingScrollPhysics(
          parent: AlwaysScrollableScrollPhysics(),
        ),
        slivers: [
          SliverPersistentHeader(
            pinned: true,
            delegate: MasrafySliverGradientHeaderDelegate(
              title: l.results_title,
              subtitle: l.results_subtitle,
              onBack: () => context.router.maybePop(),
              bottom: const MasrafySegmentedProgress(total: 5, current: 4),
              expandedHeight: MasrafyGradientHeader.expandedHeightFor(
                context,
                title: l.results_title,
                subtitle: l.results_subtitle,
                hasBack: true,
                bottomExtent: 18.h + 4.h, // Gap(18) + progress bar height
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
                  padding:
                      EdgeInsetsDirectional.fromSTEB(24.w, 52.h, 24.w, 24.h),
                  child: args.request == null
                      ? _ResultsContent(args: args, offers: args.offers)
                      : BlocBuilder<MatchingResultsCubit, MatchingResultsState>(
                          builder: (ctx, state) {
                            if (state.isLoading) {
                              return const _ResultsSkeleton();
                            }
                            if (state.needsProfile) {
                              return _ResultsProfileGate(
                                onComplete: () =>
                                    ctx.router.push(CompleteProfileRoute()),
                              );
                            }
                            if (state.isError) {
                              return MasrafyFetchErrorState(
                                onRetry: () => ctx
                                    .read<MatchingResultsCubit>()
                                    .submit(args.request!),
                              );
                            }
                            if (state.isEmpty) {
                              return MasrafyNoItemsState(
                                icon: Icons.search_off_rounded,
                                title: l.results_empty_title,
                                body: l.results_empty_body,
                              );
                            }
                            return _ResultsContent(
                              args: args,
                              offers: state.offers,
                            );
                          },
                        ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// Loaded state — the summary card + ranked offer cards (the original layout).
class _ResultsContent extends StatelessWidget {
  const _ResultsContent({required this.args, required this.offers});

  final MatchResultsArgs args;
  final List<MatchOffer> offers;

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    final typeLabel = loanTypeLabel(l, args.loanTypeKey);
    return Column(
      children: [
        MatchSummaryCard(
          rows: [
            (label: l.results_loan_type, value: typeLabel),
            (
              label: l.results_amount,
              value: l.results_amount_egp(
                NumberFormat.decimalPattern().format(args.amount),
              ),
            ),
            (
              label: l.results_duration,
              value: l.results_months(args.durationMonths),
            ),
          ],
        ),
        for (final offer in offers) ...[
          Gap(25.h),
          MatchOfferCard(
            offer: offer,
            productLabel: typeLabel,
            onViewOffer: () => context.router.push(
              OfferDetailsRoute(offer: offer, summary: args),
            ),
          ),
        ],
      ],
    );
  }
}

/// Shape-matched shimmer mirroring the summary card + three offer cards
/// (Principle XXXIV — re-fires on every reload, never a centered spinner).
class _ResultsSkeleton extends StatelessWidget {
  const _ResultsSkeleton();

  @override
  Widget build(BuildContext context) {
    return MasrafyShimmer(
      child: Column(
        children: [
          MasrafyShimmerBox(height: 120, radius: 18),
          for (var i = 0; i < 3; i++) ...[
            Gap(25.h),
            MasrafyShimmerBox(height: 150, radius: 18),
          ],
        ],
      ),
    );
  }
}

/// Shown when the profile isn't complete enough to run matching (edge case —
/// the app gates incomplete profiles before Home). Routes back to finish it.
class _ResultsProfileGate extends StatelessWidget {
  const _ResultsProfileGate({required this.onComplete});

  final VoidCallback onComplete;

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    return MasrafyNoItemsState(
      icon: Icons.person_outline_rounded,
      title: l.results_profile_title,
      body: l.results_profile_body,
      actionLabel: l.results_profile_action,
      onAction: onComplete,
    );
  }
}
