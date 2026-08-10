part of 'offer_details.imports.dart';

/// Offer details — full breakdown for a single match (Figma `2040:1402`). A
/// collapsing gradient sliver hero ("{type} Loan" + "{pct}% Approval", per
/// Principle XXXIII / A35) over a rounded sheet: loan-summary card, a 2×3 stat
/// grid, a fees table, and the Apply CTA, plus a save/unsave heart toggle in the
/// app bar (filled = saved). The single route-level widget for this file
/// (Principle XXXVI). Apply proceeds with the offer and lands on Applications;
/// the heart bookmarks/removes it in place (POST/DELETE saved-offers) with a
/// toast and no navigation — both backend-wired for real offers
/// (`offer.applicationId`/`offer.bankOfferId` set), while placeholder views
/// (saved-offer / past-application / mock) get an inert Apply and no heart.
///
/// Two ways in:
///  - [applicationId] set — an application the customer already proceeded with
///    (the Applications screen's "View offer"). The offer is FETCHED on open
///    (`GET /api/v1/applications/:id`, shimmer per Principle XXXIV) rather than
///    reopened from the row the list was drawn from: the bank decision, the
///    saved/heart flag and the offer's very existence all move without the
///    client hearing about it, and this is the screen that acts on them.
///  - [offer] + [summary] set — the live apply flow (already fresh: the results
///    screen just ran `/apply`) and the placeholder views (saved offer / mock).
@RoutePage()
class OfferDetailsPage extends StatelessWidget {
  const OfferDetailsPage({
    super.key,
    this.applicationId,
    this.offer,
    this.summary,
  }) : assert(
          applicationId != null || (offer != null && summary != null),
          'OfferDetailsPage needs an applicationId to fetch, or an offer + '
          'summary to render.',
        );

  /// Fetch key. When set, [offer] and [summary] are not read at all — the
  /// screen loads its own data.
  final String? applicationId;

  final MatchOffer? offer;
  final MatchResultsArgs? summary;

  @override
  Widget build(BuildContext context) {
    final id = applicationId;
    if (id != null) {
      return BlocProvider<ApplicationOfferCubit>(
        create: (_) => getIt<ApplicationOfferCubit>()..load(id),
        child: _FetchedOfferDetails(applicationId: id),
      );
    }
    return _OfferDetailsView(offer: offer!, summary: summary!);
  }
}

/// Resolves an [ApplicationOfferCubit] read into the real screen: shimmer while
/// the offer is in flight, a retryable error state if it never arrives, and
/// [_OfferDetailsView] on the fetched data.
class _FetchedOfferDetails extends StatelessWidget {
  const _FetchedOfferDetails({required this.applicationId});

  final String applicationId;

  @override
  Widget build(BuildContext context) {
    return BlocBuilder<ApplicationOfferCubit, ApplicationOfferState>(
      builder: (ctx, state) {
        if (state.isLoading) return const _OfferDetailsShimmer();
        final offer = state.offer;
        final summary = state.summary;
        if (state.isError || offer == null || summary == null) {
          return _OfferDetailsErrorState(
            onRetry: () =>
                ctx.read<ApplicationOfferCubit>().load(applicationId),
          );
        }
        return _OfferDetailsView(offer: offer, summary: summary);
      },
    );
  }
}

/// The screen itself, on data that is already resolved — fetched by
/// [_FetchedOfferDetails] or handed in by the caller.
class _OfferDetailsView extends StatelessWidget {
  const _OfferDetailsView({required this.offer, required this.summary});

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
    // An unrated program scores 0 for want of configuration, not for want of
    // a fit — printing "0% match score" would state the opposite.
    final subtitle = offer.approvalUnrated
        ? l.offer_unrated
        : l.offer_approval(offer.approvalPct);
    final grouped = NumberFormat.decimalPattern();

    // A real, not-yet-applied offer is the only case with a live Apply CTA, and
    // therefore the only one that needs the National ID document gate. It is
    // also the only case allowed to touch DI: placeholder views (mock /
    // saved-offer / past-application) are pumped straight into widget tests
    // with no container.
    final gated = offer.applicationId.isNotEmpty && !offer.alreadyApplied;
    // Bank-facing name of the matched program. Real offers carry the friendly
    // name (the code is the fallback for programs that never got one);
    // saved-offer / past-application / mock views carry neither.
    final programName = offer.programFriendlyName.isNotEmpty
        ? offer.programFriendlyName
        : offer.programCode;

    // What the bank booked, versus what the wizard asked for. They diverge
    // whenever the program ceiling or the debt-burden cap reduced the ask, and
    // the gap is exactly what made this screen unreadable: every figure below
    // (installment, interest, total) is priced on the APPROVED amount.
    // Rounded to the pound before comparing — a sub-EGP delta is fee rounding,
    // not a reduction worth a second row.
    final approvedAmount = offer.offeredPrincipal > 0
        ? offer.offeredPrincipal
        : summary.amount.round();
    final approvedDiffers = approvedAmount != summary.amount.round();

    // Fee lines come from the engine's own breakdown. They used to be hardcoded
    // literals ("1% (EGP 1,500)", "12.5% / year") that contradicted the
    // installment printed inches above them; a fee with no figure is now simply
    // not listed rather than invented.
    String? feeAmount(String key) {
      final raw = offer.feesBreakdown?[key];
      final value = raw is num ? raw.toDouble() : double.tryParse('$raw');
      if (value == null || value <= 0) return null;
      return l.offer_fee_egp(grouped.format(value));
    }

    final feeRows = <OfferFeeRow>[
      (
        label: l.offer_admin_fees,
        value: feeAmount('adminFeeEGP') ?? l.offer_admin_fees_value,
        valueColor: colors.warning.active,
      ),
      (
        label: l.offer_interest_charge,
        value: l.offer_interest_charge_value_rate(_trimRate(offer.ratePct)),
        valueColor: colors.warning.active,
      ),
      for (final fee in [
        (key: 'stampDutyEGP', label: l.offer_stamp_duty),
        (key: 'lifeInsuranceEGP', label: l.offer_life_insurance),
      ])
        if (feeAmount(fee.key) case final amount?)
          (
            label: fee.label,
            value: amount,
            valueColor: colors.warning.active,
          ),
      (
        label: l.offer_early_settlement,
        value: l.offer_early_settlement_value,
        valueColor: colors.success.main,
      ),
    ];

    void comingSoon() => MasrafyToast.success(context, l.offer_action_soon);

    final content = CustomScrollView(
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
            // Save/heart toggle lives in the app bar; only real offers (with a
            // bankOfferId) can be saved, so placeholder views get no action.
            action: offer.bankOfferId.isEmpty
                ? null
                : BlocBuilder<SaveOfferCubit, SaveOfferState>(
                    builder: (ctx, state) => _HeartAction(
                      isSaved: state.isSaved,
                      isLoading: state.isBusy,
                      onTap: () {
                        final cubit = ctx.read<SaveOfferCubit>();
                        if (state.isSaved) {
                          cubit.remove(offer.bankOfferId);
                        } else {
                          cubit.save(offer.bankOfferId);
                        }
                      },
                    ),
                  ),
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
                padding: EdgeInsetsDirectional.fromSTEB(24.w, 52.h, 24.w, 24.h),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    MatchSummaryCard(
                      rows: [
                        // Which bank program this is — the hero says only
                        // "Personal Loan", so without this row two offers from
                        // two banks render identically. Falls back to the raw
                        // code, and is dropped entirely on placeholder views
                        // (saved offers / mocks) that carry neither.
                        if (programName.isNotEmpty)
                          (label: l.results_program, value: programName),
                        (label: l.results_loan_type, value: typeLabel),
                        // The ask and the offer are two different numbers
                        // whenever the program ceiling or the debt-burden
                        // cap bit. Printing only the ask (as this card
                        // used to) put "EGP 1,000,000" directly above an
                        // installment that priced 494,280.
                        if (approvedDiffers)
                          (
                            label: l.results_requested,
                            value: l.results_amount_egp(
                              grouped.format(summary.amount),
                            ),
                          ),
                        (
                          label: approvedDiffers
                              ? l.results_approved_amount
                              : l.results_amount,
                          value: l.results_amount_egp(
                            grouped.format(approvedAmount),
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
                        // The one number on this screen the customer can
                        // actually spend: the booked principal minus the
                        // fees financed into it. Sits next to the term so
                        // "how much, for how long" reads as one row.
                        if (offer.cashReceived != null)
                          OfferStatTile(
                            label: l.offer_cash_received,
                            value: grouped.format(offer.cashReceived),
                            caption: l.offer_cash_received_caption,
                            valueColor: colors.success.main,
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
                          caption: l.offer_total_interest_caption,
                          valueColor: colors.warning.active,
                        ),
                        OfferStatTile(
                          label: l.offer_total_loan,
                          value: grouped.format(offer.totalLoan),
                          caption: l.offer_total_loan_caption,
                          valueColor: colors.success.main,
                        ),
                        // Affordability: what this salary supports here,
                        // and where this offer sits against the cap.
                        if (offer.maxLoan != null)
                          OfferStatTile(
                            label: l.offer_max_borrow,
                            value: grouped.format(offer.maxLoan),
                            caption: offer.dbrCapPct == null
                                ? l.offer_egp_extra
                                : l.offer_max_borrow_caption(
                                    _trimRate(offer.dbrCapPct!),
                                  ),
                            valueColor: colors.success.main,
                          ),
                        if (offer.dbrPct != null)
                          OfferStatTile(
                            label: l.offer_dbr,
                            value: '${_trimRate(offer.dbrPct!)}%',
                            caption: l.offer_dbr_caption,
                            valueColor: colors.warning.active,
                          ),
                        // Document status, not a figure — last, so the
                        // money tiles read as one uninterrupted block.
                        _NationalIdStatTile(tracked: gated),
                      ],
                    ),
                    if (offer.hasUnusedHeadroom) ...[
                      Gap(10.h),
                      Text(
                        l.offer_headroom_hint,
                        style: text.bodySmall.copyWith(
                          color: colors.success.main,
                        ),
                      ),
                    ],
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
                    OfferFeesCard(rows: feeRows),
                    if (offer.requiredDocuments.isNotEmpty) ...[
                      Gap(20.h),
                      OfferRequiredDocumentsCard(
                        documentKeys: offer.requiredDocuments,
                      ),
                    ],
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
                                listener: (ctx, state) {
                                  if (state.isSuccess) {
                                    MasrafyToast.success(
                                        ctx, l.offer_proceed_success);
                                    // One-way gate: the backend blocks
                                    // re-selecting once proceeded, so clear the
                                    // now-stale wizard/results/details stack.
                                    ctx.router.replaceAll([
                                      MainShellRoute(),
                                      const PreviousApplicationsRoute(),
                                    ]);
                                  } else if (state.needsDocuments) {
                                    // Server-side half of the document gate —
                                    // reached only when the local pre-check
                                    // couldn't answer (status still loading, or
                                    // the read failed). Same warning, same
                                    // destination, so the two can't drift.
                                    _promptForNationalId(ctx);
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
                                  onPressed:
                                      state.isLoading ? null : () => _apply(ctx),
                                ),
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
    );

    // Only a REAL offer can be saved, and the heart action above is already
    // hidden without a `bankOfferId`. So placeholder views (mock previews,
    // saved-offer / past-application summaries) get the page with no
    // save machinery at all, rather than a cubit that can never be used.
    final Widget saveScoped = offer.bankOfferId.isEmpty
        ? content
        : BlocProvider<SaveOfferCubit>(
              create: (_) => getIt<SaveOfferCubit>()..check(offer.bankOfferId),
              child: BlocListener<SaveOfferCubit, SaveOfferState>(
                listener: (ctx, state) {
                  if (state.isSuccess) {
                    MasrafyToast.success(
                      ctx,
                      state.isSaved
                          ? l.offer_save_success
                          : l.offer_removed_success,
                    );
                  } else if (state.isError) {
                    MasrafyToast.error(
                      ctx,
                      state.isSaved ? l.offer_remove_error : l.offer_save_error,
                    );
                  }
                },
                child: content,
              ),
            );

    return Scaffold(
      backgroundColor: colors.bg.layout,
      // Document-gate pre-check (Constitution v9.1.0). Read on open so the
      // National ID stat tile reports the truth instead of a fixed "Pending",
      // and so the Apply tap can warn locally rather than spend a select-offer
      // call the backend would only reject.
      body: gated
          ? BlocProvider<NationalIdStatusCubit>(
              create: (_) => getIt<NationalIdStatusCubit>()..load(),
              child: saveScoped,
            )
          : saveScoped,
    );
  }

  /// Warns before the National ID gate takes the user off this screen, then —
  /// on confirm — collects the missing sides and resumes the apply. Both the
  /// local pre-check and the server's `NATIONAL_ID_REQUIRED` land here.
  Future<void> _promptForNationalId(BuildContext context) async {
    final l = AppLocalizations.of(context);
    final id = context.read<NationalIdStatusCubit>().state;
    final confirmed = await MasrafyDocumentsRequiredDialog.show(
      context,
      title: l.offer_national_id_required_title,
      message: l.offer_national_id_required_body,
      // Naming the two sides turns "something is missing" into "the back is
      // missing" — the user leaves this dialog knowing what they're going to do.
      documents: [
        (label: l.signup_id_front, uploaded: id.frontUploaded),
        (label: l.signup_id_back, uploaded: id.backUploaded),
      ],
      cancelLabel: l.common_cancel,
      confirmLabel: l.offer_national_id_required_cta,
    );
    // Declining keeps the user on the offer with nothing sent — the CTA stays
    // tappable, so this is a pause, not a dead end.
    if (!confirmed || !context.mounted) return;
    final done = await context.router.push<bool>(const ApplyDocumentsRoute());
    if (!context.mounted) return;
    // Re-read either way: the user may have uploaded one side and backed out,
    // and the tile must not keep claiming otherwise.
    context.read<NationalIdStatusCubit>().load();
    if (done == true) {
      context
          .read<SelectOfferCubit>()
          .select(offer.applicationId, offer.bankOfferId);
    }
  }

  /// Apply tap. Only a KNOWN-incomplete National ID blocks: a status still
  /// loading (or whose read failed) falls through to the server, which is the
  /// authority on the gate — an offline user whose ID is already on file must
  /// still be able to proceed.
  void _apply(BuildContext context) {
    if (context.read<NationalIdStatusCubit>().state.blocksApply) {
      _promptForNationalId(context);
      return;
    }
    context
        .read<SelectOfferCubit>()
        .select(offer.applicationId, offer.bankOfferId);
  }

  /// 9.5 → "9.5", 10.0 → "10".
  static String _trimRate(double rate) => rate == rate.truncateToDouble()
      ? rate.truncate().toString()
      : rate.toString();
}

/// Shape-matched skeleton for the fetched variant (Principle XXXIV): the same
/// gradient hero, then the summary card / 2-column stat grid / fees table / CTA
/// blocks the loaded screen draws. The hero is NOT shimmered — the sweep masks
/// every opaque pixel, and a full-bleed gradient would sweep as one blob — so it
/// renders for real with placeholder bars where its title and subtitle go.
class _OfferDetailsShimmer extends StatelessWidget {
  const _OfferDetailsShimmer();

  @override
  Widget build(BuildContext context) {
    final colors = MasrafyColorTheme.of(context);
    return Scaffold(
      backgroundColor: colors.bg.layout,
      body: SingleChildScrollView(
        physics: const NeverScrollableScrollPhysics(),
        child: Column(
          children: [
            const _OfferDetailsLoadingHero(),
            Transform.translate(
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
                  padding: EdgeInsetsDirectional.fromSTEB(24.w, 52.h, 24.w, 24.h),
                  child: MasrafyShimmer(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        // Loan-summary card (program / type / amount / duration).
                        MasrafyShimmerBox(height: 176, radius: 16),
                        Gap(25.h),
                        // 2×4 stat grid.
                        for (int row = 0; row < 4; row++) ...[
                          if (row > 0) Gap(10.h),
                          Row(
                            children: [
                              Expanded(
                                child: MasrafyShimmerBox(height: 92, radius: 14),
                              ),
                              Gap(10.w),
                              Expanded(
                                child: MasrafyShimmerBox(height: 92, radius: 14),
                              ),
                            ],
                          ),
                        ],
                        Gap(20.h),
                        MasrafyShimmerBox(width: 90, height: 12, radius: 6),
                        Gap(12.h),
                        MasrafyShimmerBox(height: 150, radius: 16),
                        Gap(25.h),
                        MasrafyShimmerBox(height: 52, radius: 16),
                      ],
                    ),
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// The offer read failed — retryable, and the back button still works, so a
/// failed fetch is a pause rather than a dead end.
class _OfferDetailsErrorState extends StatelessWidget {
  const _OfferDetailsErrorState({required this.onRetry});

  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    final colors = MasrafyColorTheme.of(context);
    return Scaffold(
      backgroundColor: colors.bg.layout,
      body: Column(
        children: [
          const _OfferDetailsLoadingHero(),
          Expanded(child: MasrafyFetchErrorState(onRetry: onRetry)),
        ],
      ),
    );
  }
}

/// The gradient hero with nothing in it yet: real gradient + working back
/// button, two placeholder bars where the "{type} Loan" title and "{pct}% match
/// score" subtitle land. Shared by the shimmer and the error state so a failed
/// load doesn't jump to a different header.
class _OfferDetailsLoadingHero extends StatelessWidget {
  const _OfferDetailsLoadingHero();

  @override
  Widget build(BuildContext context) {
    final colors = MasrafyColorTheme.of(context);

    Widget bar({required double width, required double height}) => Container(
          width: width.w,
          height: height.h,
          decoration: BoxDecoration(
            color: colors.white.withValues(alpha: 0.16),
            borderRadius: BorderRadius.circular(8.r),
          ),
        );

    // Height of the placeholder block below, INCLUDING the Gap(18) the header
    // puts in front of `bottom` (see `expandedHeightFor`).
    final bottomExtent = 18.h + 26.h + 8.h + 14.h;

    return MasrafyGradientHeader(
      title: '',
      subtitle: '',
      onBack: () => context.router.maybePop(),
      bottom: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          bar(width: 200, height: 26),
          Gap(8.h),
          bar(width: 120, height: 14),
        ],
      ),
      heightInPixels: MasrafyGradientHeader.expandedHeightFor(
        context,
        title: '',
        subtitle: '',
        hasBack: true,
        bottomExtent: bottomExtent,
        minHeight: 180.h,
      ),
    );
  }
}

/// National ID document status in the stat grid. [tracked] is false for
/// placeholder views (mock / saved-offer / past-application): they have no
/// status cubit above them and no Apply CTA to gate, so they keep the neutral
/// "Pending" this tile has always shown.
class _NationalIdStatTile extends StatelessWidget {
  const _NationalIdStatTile({required this.tracked});

  final bool tracked;

  @override
  Widget build(BuildContext context) {
    final colors = MasrafyColorTheme.of(context);
    final l = AppLocalizations.of(context);

    OfferStatTile tile({required String value, required Color color}) =>
        OfferStatTile(
          label: l.offer_national_id,
          value: value,
          caption: l.offer_personal_id,
          valueColor: color,
        );

    final pending = tile(
      value: l.offer_national_id_pending,
      color: colors.warning.active,
    );
    if (!tracked) return pending;

    return BlocBuilder<NationalIdStatusCubit, NationalIdStatusState>(
      builder: (_, state) => state.isReady
          // Both sides on file — this offer's document gate is satisfied.
          ? tile(
              value: l.offer_national_id_uploaded,
              color: colors.success.main,
            )
          // Unknown reads as pending: it is the status quo, and it never
          // promises the gate is clear when nobody has checked.
          : pending,
    );
  }
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

/// Glass heart toggle pinned in the gradient app bar — filled when the offer is
/// saved, outline when not; spinner while the save/remove call is in flight.
/// Mirrors the header's glass back button on the opposite side.
class _HeartAction extends StatelessWidget {
  const _HeartAction({
    required this.isSaved,
    required this.isLoading,
    required this.onTap,
  });

  final bool isSaved;
  final bool isLoading;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = MasrafyColorTheme.of(context);
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: isLoading ? null : onTap,
        borderRadius: BorderRadius.circular(10.r),
        child: Container(
          padding: EdgeInsets.all(10.r),
          decoration: BoxDecoration(
            color: colors.white.withValues(alpha: 0.1),
            borderRadius: BorderRadius.circular(10.r),
            border: Border.all(color: colors.white.withValues(alpha: 0.15)),
          ),
          child: isLoading
              ? SizedBox(
                  width: 24.r,
                  height: 24.r,
                  child: Padding(
                    padding: EdgeInsets.all(3.r),
                    child: CircularProgressIndicator(
                      strokeWidth: 2,
                      valueColor: AlwaysStoppedAnimation<Color>(colors.white),
                    ),
                  ),
                )
              : Icon(
                  isSaved ? Icons.favorite : Icons.favorite_border,
                  size: 24.r,
                  color: colors.white,
                ),
        ),
      ),
    );
  }
}
