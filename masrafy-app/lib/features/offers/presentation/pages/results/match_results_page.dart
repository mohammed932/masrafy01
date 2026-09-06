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
                      ? _ResultsContent(
                          args: args,
                          offers: args.offers,
                          unavailable: const [],
                        )
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
                              unavailable: state.unavailablePrograms,
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
  const _ResultsContent({
    required this.args,
    required this.offers,
    required this.unavailable,
  });

  final MatchResultsArgs args;
  final List<MatchOffer> offers;

  /// Programs checked but not priceable, each with its reason (FR-022). Rendered
  /// BELOW the priced offers: they are real options once the missing detail is
  /// supplied, so they belong on the shortlist — just not at the top of it.
  final List<UnavailableProgramEntity> unavailable;

  @override
  Widget build(BuildContext context) {
    final l = AppLocalizations.of(context);
    final typeLabel = loanTypeLabel(l, args.loanTypeKey);
    return Column(
      children: [
        // Labelled as the REQUEST, not as the deal: each card below carries its
        // own amount and term, and those legitimately differ per bank once the
        // program ceiling or the debt-burden cap bites. Unlabelled, this card
        // read as "your loan is 1,000,000 over 6 months" while every card under
        // it said 12 months.
        MatchSummaryCard(
          rows: [
            (label: l.results_loan_type, value: typeLabel),
            (
              label: l.results_requested,
              value: l.results_amount_egp(
                NumberFormat.decimalPattern().format(args.amount),
              ),
            ),
            (
              label: l.results_requested_duration,
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
        // Listed, never hidden, and never shown with a zero (FR-020, FR-022). The
        // heading is what stops a reader taking these for offers.
        if (unavailable.isNotEmpty) ...[
          Gap(28.h),
          Align(
            alignment: AlignmentDirectional.centerStart,
            child: Text(
              l.results_unavailable_section,
              style: MasrafyTextTheme.of(context)
                  .heading4
                  .copyWith(color: MasrafyColorTheme.of(context).textBase),
            ),
          ),
          for (final program in unavailable) ...[
            Gap(14.h),
            UnavailableProgramCard(program: program),
          ],
        ],
      ],
    );
  }
}

/// Shape-matched shimmer mirroring the summary card + ranked offer cards
/// (Principle XXXIV — re-fires on every reload, never a centered spinner).
/// `Shimmer.fromColors` masks every opaque pixel, so cards use a transparent
/// fill + border and only the inner placeholders sweep — reading as content
/// loading, not solid slabs.
class _ResultsSkeleton extends StatelessWidget {
  const _ResultsSkeleton();

  @override
  Widget build(BuildContext context) {
    return MasrafyShimmer(
      child: Column(
        children: [
          const _SummaryCardSkeleton(),
          for (var i = 0; i < 3; i++) ...[
            Gap(25.h),
            _OfferCardSkeleton(topPick: i == 0),
          ],
        ],
      ),
    );
  }
}

/// Skeleton for [MatchSummaryCard] — three label/value rows in a card outline.
class _SummaryCardSkeleton extends StatelessWidget {
  const _SummaryCardSkeleton();

  static const _valueWidths = <double>[88, 116, 96];

  @override
  Widget build(BuildContext context) {
    final colors = MasrafyColorTheme.of(context);
    return Container(
      padding: EdgeInsets.all(15.r),
      decoration: BoxDecoration(
        color: Colors.transparent,
        borderRadius: BorderRadius.circular(14.r),
        border: Border.all(color: colors.secondary.border),
      ),
      child: Column(
        children: [
          for (var i = 0; i < 3; i++) ...[
            Padding(
              padding: EdgeInsetsDirectional.symmetric(vertical: 9.h),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const MasrafyShimmerBox(width: 82, height: 12, radius: 6),
                  MasrafyShimmerBox(
                    width: _valueWidths[i % _valueWidths.length],
                    height: 13,
                    radius: 6,
                  ),
                ],
              ),
            ),
            if (i < 2) Divider(height: 1.h, color: colors.border.secondary),
          ],
        ],
      ),
    );
  }
}

/// Skeleton for [MatchOfferCard]: two bars where the bank name and the
/// program/type subline land, then the KPI row. The [topPick] card mirrors the
/// azure-bordered top-pick variant and carries the View-offer CTA bar.
class _OfferCardSkeleton extends StatelessWidget {
  const _OfferCardSkeleton({required this.topPick});

  final bool topPick;

  @override
  Widget build(BuildContext context) {
    final colors = MasrafyColorTheme.of(context);
    return Container(
      width: double.infinity,
      padding: EdgeInsetsDirectional.fromSTEB(17.w, 23.h, 17.w, 17.h),
      decoration: BoxDecoration(
        color: Colors.transparent,
        borderRadius: BorderRadius.circular(18.r),
        border: Border.all(
          color: topPick ? colors.secondary.main : colors.border.secondary,
        ),
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
                    const MasrafyShimmerBox(width: 168, height: 18, radius: 8),
                    Gap(8.h),
                    const MasrafyShimmerBox(width: 120, height: 12, radius: 6),
                  ],
                ),
              ),
            ],
          ),
          Gap(16.h),
          Row(
            children: [
              for (var i = 0; i < 3; i++) ...[
                if (i > 0) Gap(8.w),
                const Expanded(
                  child: MasrafyShimmerBox(height: 56, radius: 12),
                ),
              ],
            ],
          ),
          // Mirrors the max-borrow band, which every real offer carries.
          Gap(8.h),
          const MasrafyShimmerBox(height: 33, radius: 10),
          if (topPick) ...[
            Gap(16.h),
            const MasrafyShimmerBox(height: 48, radius: 12),
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
