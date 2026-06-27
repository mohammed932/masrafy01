import 'package:flutter/material.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import 'package:gap/gap.dart';
import 'package:intl/intl.dart';

import 'package:app/core/theme/colors/masrafy_color_theme.dart';
import 'package:app/core/theme/typography/masrafy_text_theme.dart';
import 'package:app/features/offers/presentation/models/match_results_args.dart';
import 'package:app/l10n/generated/app_localizations.dart';

import '../../../models/previous_applications_args.dart';

/// A single past-application card on the "Applications" screen (Figma
/// `4088:332`). Mirrors the live-offers `MatchOfferCard` — "{pct}% Guarantee
/// Approval" heading, "{type} · {n} months" subtitle, a Rate / Monthly / Total
/// KPI row and an outlined "View offer" CTA — but swaps the best-match chip for
/// a status pill (Applied / Approved / Rejected). Flow-local (Principle XXXII);
/// UI-only.
class PastApplicationCard extends StatelessWidget {
  const PastApplicationCard({
    super.key,
    required this.application,
    required this.onViewOffer,
  });

  final PastApplication application;
  final VoidCallback onViewOffer;

  @override
  Widget build(BuildContext context) {
    final colors = MasrafyColorTheme.of(context);
    final text = MasrafyTextTheme.of(context);
    final l = AppLocalizations.of(context);
    final offer = application.offer;
    final productLabel = loanTypeLabel(l, application.loanTypeKey);

    return Container(
      width: double.infinity,
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
                    Text(
                      l.results_guarantee_approval(offer.approvalPct),
                      style: text.bodyLarge.copyWith(
                        color: colors.primary.main,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                    Gap(1.h),
                    Text(
                      '$productLabel · ${l.results_months(offer.termMonths)}',
                      style: text.bodySmall.copyWith(
                        color: colors.primary.border,
                      ),
                    ),
                  ],
                ),
              ),
              Gap(8.w),
              _StatusPill(status: application.status),
            ],
          ),
          Gap(12.h),
          Row(
            children: [
              Expanded(
                child: _KpiCell(
                  label: l.results_rate,
                  value: '${_trimRate(offer.ratePct)}%',
                  valueColor: colors.secondary.main,
                ),
              ),
              Gap(8.w),
              Expanded(
                child: _KpiCell(
                  label: l.results_monthly,
                  value: NumberFormat.decimalPattern().format(offer.monthly),
                  valueColor: colors.primary.border,
                ),
              ),
              Gap(8.w),
              Expanded(
                child: _KpiCell(
                  label: l.results_total,
                  value: offer.totalLabel,
                  valueColor: colors.primary.border,
                ),
              ),
            ],
          ),
          Gap(12.h),
          _ViewOfferButton(label: l.results_view_offer, onTap: onViewOffer),
        ],
      ),
    );
  }

  /// 9.5 → "9.5", 10.0 → "10".
  static String _trimRate(double rate) => rate == rate.truncateToDouble()
      ? rate.truncate().toString()
      : rate.toString();
}

/// Decision pill — colour resolved from [PastApplicationStatus] (Figma
/// `4088:339` Applied / `4088:366` Approved / `4088:393` Rejected).
class _StatusPill extends StatelessWidget {
  const _StatusPill({required this.status});

  final PastApplicationStatus status;

  @override
  Widget build(BuildContext context) {
    final colors = MasrafyColorTheme.of(context);
    final text = MasrafyTextTheme.of(context);

    final (tone, border, labelGetter) = switch (status) {
      PastApplicationStatus.applied => (
          colors.warning,
          colors.warning.main,
          AppLocalizations.of(context).previous_applications_status_applied,
        ),
      PastApplicationStatus.approved => (
          colors.success,
          colors.success.border,
          AppLocalizations.of(context).previous_applications_status_approved,
        ),
      PastApplicationStatus.rejected => (
          colors.error,
          colors.error.main.withValues(alpha: 0.3),
          AppLocalizations.of(context).previous_applications_status_rejected,
        ),
    };

    return Container(
      padding: EdgeInsetsDirectional.symmetric(horizontal: 11.w, vertical: 4.h),
      decoration: BoxDecoration(
        color: tone.main.withValues(alpha: 0.2),
        borderRadius: BorderRadius.circular(999.r),
        border: Border.all(color: border),
      ),
      child: Text(
        labelGetter,
        style: text.caption.copyWith(
          color: tone.main,
          fontWeight: FontWeight.w700,
          fontSize: 10.sp,
        ),
      ),
    );
  }
}

/// One Rate / Monthly / Total stat cell (Figma `4088:342`).
class _KpiCell extends StatelessWidget {
  const _KpiCell({
    required this.label,
    required this.value,
    required this.valueColor,
  });

  final String label;
  final String value;
  final Color valueColor;

  @override
  Widget build(BuildContext context) {
    final colors = MasrafyColorTheme.of(context);
    final text = MasrafyTextTheme.of(context);
    return Container(
      padding: EdgeInsetsDirectional.symmetric(horizontal: 8.w, vertical: 9.h),
      decoration: BoxDecoration(
        color: colors.bg.layout,
        borderRadius: BorderRadius.circular(10.r),
      ),
      child: Column(
        children: [
          Text(
            label,
            style: text.caption.copyWith(
              color: colors.primary.border,
              fontSize: 10.sp,
            ),
          ),
          Gap(3.h),
          Text(
            value,
            style: text.body.copyWith(
              color: valueColor,
              fontWeight: FontWeight.w800,
            ),
          ),
        ],
      ),
    );
  }
}

/// Outlined "View offer" CTA — blue-ice border, dark label (Figma `4088:357`).
class _ViewOfferButton extends StatelessWidget {
  const _ViewOfferButton({required this.label, required this.onTap});

  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = MasrafyColorTheme.of(context);
    final text = MasrafyTextTheme.of(context);
    return Material(
      color: colors.bg.container,
      borderRadius: BorderRadius.circular(12.r),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(12.r),
        child: Container(
          width: double.infinity,
          padding: EdgeInsets.symmetric(vertical: 12.h),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(12.r),
            border: Border.all(color: colors.secondary.border),
          ),
          child: Text(
            label,
            textAlign: TextAlign.center,
            style: text.bodySmall.copyWith(
              color: colors.textBase,
              fontWeight: FontWeight.w700,
            ),
          ),
        ),
      ),
    );
  }
}
