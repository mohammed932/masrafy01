part of 'offer_details.imports.dart';

/// Offer details — full breakdown for a single match (Figma `2040:1402`). A
/// collapsing gradient sliver hero ("{type} Loan" + "{pct}% Approval", per
/// Principle XXXIII / A35) over a rounded sheet: loan-summary card, a 2×3 stat
/// grid, a fees table, and the Apply / Save CTAs. The single route-level widget
/// for this file (Principle XXXVI). Apply proceeds with the offer and lands on
/// Applications; Save bookmarks it and lands on Saved Offers — both backend-
/// wired for real offers (`offer.applicationId`/`offer.bankOfferId` set) and
/// inert placeholders otherwise (saved-offer / past-application / mock views
/// with nothing new to proceed on or save).
@RoutePage()
class OfferDetailsPage extends StatelessWidget {
  const OfferDetailsPage({
    super.key,
    required this.offer,
    required this.summary,
  });

  final MatchOffer offer;
  final MatchResultsArgs summary;

  @override
  Widget build(BuildContext context) {
    final colors = MasrafyColorTheme.of(context);
    final text = MasrafyTextTheme.of(context);
    final l = AppLocalizations.of(context);
    final topInset = MediaQuery.of(context).viewPadding.top;
    final typeLabel = loanTypeLabel(l, summary.loanTypeKey);
    final title = l.offer_title(typeLabel);
    final subtitle = l.offer_approval(offer.approvalPct);
    final grouped = NumberFormat.decimalPattern();

    void comingSoon() => MasrafyToast.success(context, l.offer_action_soon);

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
              title: title,
              subtitle: subtitle,
              onBack: () => context.router.maybePop(),
              expandedHeight: MasrafyGradientHeader.expandedHeightFor(
                context,
                title: title,
                subtitle: subtitle,
                hasBack: true,
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
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      MatchSummaryCard(
                        rows: [
                          (label: l.results_loan_type, value: typeLabel),
                          (
                            label: l.results_amount,
                            value: l.results_amount_egp(
                              grouped.format(summary.amount),
                            ),
                          ),
                          (
                            label: l.results_duration,
                            value: l.results_months(offer.termMonths),
                          ),
                        ],
                      ),
                      Gap(25.h),
                      _StatGrid(
                        tiles: [
                          OfferStatTile(
                            label: l.offer_interest_rate,
                            value: '${_trimRate(offer.ratePct)}%',
                            caption: l.offer_fixed_apr,
                            valueColor: colors.secondary.main,
                          ),
                          OfferStatTile(
                            label: l.offer_monthly,
                            value: grouped.format(offer.monthly),
                            caption: l.offer_egp_month,
                            valueColor: colors.textBase,
                          ),
                          OfferStatTile(
                            label: l.offer_duration,
                            value: '${offer.termMonths}',
                            caption: l.offer_months,
                            valueColor: colors.textBase,
                          ),
                          OfferStatTile(
                            label: l.offer_total_interest,
                            value: grouped.format(offer.totalInterest),
                            caption: l.offer_egp_extra,
                            valueColor: colors.warning.active,
                          ),
                          OfferStatTile(
                            label: l.offer_national_id,
                            value: l.offer_national_id_pending,
                            caption: l.offer_personal_id,
                            valueColor: colors.warning.active,
                          ),
                          OfferStatTile(
                            label: l.offer_total_loan,
                            value: grouped.format(offer.totalLoan),
                            caption: l.offer_total_loan_caption,
                            valueColor: colors.success.main,
                          ),
                        ],
                      ),
                      Gap(20.h),
                      Text(
                        l.offer_fees_title.toUpperCase(),
                        style: text.bodySmall.copyWith(
                          color: colors.primary.border,
                          fontWeight: FontWeight.w700,
                          letterSpacing: 0.9,
                        ),
                      ),
                      Gap(12.h),
                      OfferFeesCard(
                        rows: [
                          (
                            label: l.offer_admin_fees,
                            value: l.offer_admin_fees_value,
                            valueColor: colors.warning.active,
                          ),
                          (
                            label: l.offer_interest_charge,
                            value: l.offer_interest_charge_value,
                            valueColor: colors.warning.active,
                          ),
                          (
                            label: l.offer_early_settlement,
                            value: l.offer_early_settlement_value,
                            valueColor: colors.success.main,
                          ),
                        ],
                      ),
                      Gap(25.h),
                      // Already-applied offers (opened from the Applications
                      // screen) can't be re-applied — hide the Apply CTA
                      // entirely; only the Save CTA below remains.
                      if (!offer.alreadyApplied) ...[
                        // Real offers (from apply) proceed via select-offer;
                        // saved-offer / past-application summaries have no
                        // application to proceed on, so keep the placeholder and
                        // avoid touching DI (widget tests pump this page directly).
                        offer.applicationId.isEmpty
                          ? MasrafyGradientButton(
                              label: l.offer_apply,
                              onPressed: comingSoon,
                            )
                          : BlocProvider<SelectOfferCubit>(
                              create: (_) => getIt<SelectOfferCubit>(),
                              child: BlocConsumer<SelectOfferCubit,
                                  SelectOfferState>(
                                listener: (ctx, state) async {
                                  if (state.isSuccess) {
                                    MasrafyToast.success(
                                        ctx, l.offer_proceed_success);
                                    // One-way gate: the backend blocks
                                    // re-selecting once proceeded, so clear the
                                    // now-stale wizard/results/details stack.
                                    ctx.router.replaceAll([
                                      const HomeRoute(),
                                      const PreviousApplicationsRoute(),
                                    ]);
                                  } else if (state.needsDocuments) {
                                    // Apply-time document gate (v9.0.1): collect
                                    // photo + National ID on a focused screen,
                                    // then auto-resume select-offer on return —
                                    // no dialog, no dead end.
                                    final done = await ctx.router
                                        .push<bool>(const ApplyDocumentsRoute());
                                    if (done == true && ctx.mounted) {
                                      ctx.read<SelectOfferCubit>().select(
                                            offer.applicationId,
                                            offer.bankOfferId,
                                          );
                                    }
                                  } else if (state.needsProfile) {
                                    ctx.router.push(CompleteProfileRoute());
                                  } else if (state.isError) {
                                    MasrafyToast.error(
                                        ctx, l.offer_proceed_error);
                                  }
                                },
                                builder: (ctx, state) => MasrafyGradientButton(
                                  label: l.offer_apply,
                                  isLoading: state.isLoading,
                                  onPressed: state.isLoading
                                      ? null
                                      : () => ctx
                                          .read<SelectOfferCubit>()
                                          .select(
                                            offer.applicationId,
                                            offer.bankOfferId,
                                          ),
                                ),
                              ),
                            ),
                        Gap(12.h),
                      ],
                      offer.bankOfferId.isEmpty
                          ? _SaveOfferButton(
                              label: l.offer_save_later,
                              onTap: comingSoon,
                            )
                          : BlocProvider<SaveOfferCubit>(
                              create: (_) => getIt<SaveOfferCubit>(),
                              child:
                                  BlocConsumer<SaveOfferCubit, SaveOfferState>(
                                listener: (ctx, state) {
                                  if (state.isSuccess) {
                                    MasrafyToast.success(
                                        ctx, l.offer_save_success);
                                    ctx.router.push(SavedOffersRoute());
                                  } else if (state.isError) {
                                    MasrafyToast.error(ctx, l.offer_save_error);
                                  }
                                },
                                builder: (ctx, state) => _SaveOfferButton(
                                  label: l.offer_save_later,
                                  onTap: state.isLoading
                                      ? () {}
                                      : () => ctx
                                          .read<SaveOfferCubit>()
                                          .save(offer.bankOfferId),
                                ),
                              ),
                            ),
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

  /// 9.5 → "9.5", 10.0 → "10".
  static String _trimRate(double rate) => rate == rate.truncateToDouble()
      ? rate.truncate().toString()
      : rate.toString();
}

/// 2-column stat grid built from a flat list of tiles (Figma `2040:1452`).
class _StatGrid extends StatelessWidget {
  const _StatGrid({required this.tiles});

  final List<Widget> tiles;

  @override
  Widget build(BuildContext context) {
    final rows = <Widget>[];
    for (int i = 0; i < tiles.length; i += 2) {
      if (i > 0) rows.add(Gap(10.h));
      rows.add(
        IntrinsicHeight(
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Expanded(child: tiles[i]),
              Gap(10.w),
              Expanded(
                child: i + 1 < tiles.length
                    ? tiles[i + 1]
                    : const SizedBox.shrink(),
              ),
            ],
          ),
        ),
      );
    }
    return Column(children: rows);
  }
}

/// Secondary CTA — blue-ice fill, indigo label (Figma `2040:1519`).
class _SaveOfferButton extends StatelessWidget {
  const _SaveOfferButton({required this.label, required this.onTap});

  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = MasrafyColorTheme.of(context);
    final text = MasrafyTextTheme.of(context);
    return Material(
      color: colors.secondary.border,
      borderRadius: BorderRadius.circular(14.r),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(14.r),
        child: Container(
          width: double.infinity,
          padding: EdgeInsets.symmetric(vertical: 14.h),
          alignment: Alignment.center,
          child: Text(
            label,
            style: text.bodySmall.copyWith(
              color: colors.primary.main,
              fontWeight: FontWeight.w600,
            ),
          ),
        ),
      ),
    );
  }
}
