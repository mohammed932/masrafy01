part of 'results.imports.dart';

/// Offers list — "Your top matches are ready" (Figma `2040:1253`). A collapsing
/// gradient sliver hero (per Principle XXXIII / A35) over a rounded sheet that
/// stacks the loan-summary card and the ranked [MatchOfferCard]s. The single
/// route-level widget for this file (Principle XXXVI); UI-only — the offers are
/// passed in via [MatchResultsArgs] (static mock for this iteration).
@RoutePage()
class MatchResultsPage extends StatelessWidget {
  const MatchResultsPage({super.key, required this.args});

  final MatchResultsArgs args;

  @override
  Widget build(BuildContext context) {
    final colors = MasrafyColorTheme.of(context);
    final l = AppLocalizations.of(context);
    final topInset = MediaQuery.of(context).viewPadding.top;
    final typeLabel = loanTypeLabel(l, args.loanTypeKey);

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
                  child: Column(
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
                      for (final offer in args.offers) ...[
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
