part of '../questionnaire.imports.dart';

/// One matched bank program. Featured programs get a brand-toned
/// border. Money + rate are decimal strings rendered as-is (no parse).
class PreviewMatchCard extends StatelessWidget {
  const PreviewMatchCard({super.key, required this.match});

  final PreviewMatchEntity match;

  @override
  Widget build(BuildContext context) {
    final colors = MasrafyColorTheme.of(context);
    final textTheme = MasrafyTextTheme.of(context);
    final l10n = AppLocalizations.of(context);

    return Container(
      width: double.infinity,
      padding: const EdgeInsetsDirectional.all(16),
      decoration: BoxDecoration(
        color: colors.bg.container,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: match.bankIsFeatured ? colors.primary.border : colors.border.main,
          width: match.bankIsFeatured ? 1.5 : 1,
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      match.programFriendlyName,
                      style: textTheme.body.semiBold().copyWith(
                            color: colors.text.primary,
                          ),
                    ),
                    Text(
                      match.bankName,
                      style: textTheme.bodySmall.copyWith(
                        color: colors.text.secondary,
                      ),
                    ),
                  ],
                ),
              ),
              if (match.bankIsFeatured)
                _Badge(
                  label: l10n.match_featured_badge,
                  bg: colors.primary.bg,
                  fg: colors.primary.text,
                ),
            ],
          ),
          const Gap(12),
          Row(
            children: [
              Expanded(
                child: _Metric(
                  label: l10n.match_preview_monthly_installment,
                  value: l10n.match_amount_egp(match.monthlyInstallmentEGP),
                ),
              ),
              Expanded(
                child: _Metric(
                  label: l10n.match_preview_effective_rate,
                  value: l10n.match_rate_percent(match.effectiveRatePercent),
                ),
              ),
            ],
          ),
          const Gap(12),
          _TierBadge(tier: match.approvalTier),
          if (!match.eligible && match.rejectionReasons.isNotEmpty) ...[
            const Gap(12),
            Text(
              l10n.match_preview_rejection_reasons,
              style: textTheme.bodySmall.semiBold().copyWith(
                    color: colors.error.text,
                  ),
            ),
            const Gap(4),
            for (final reason in match.rejectionReasons)
              _BulletLine(text: reason),
          ],
          if (match.requiredDocuments.isNotEmpty) ...[
            const Gap(12),
            Text(
              l10n.match_preview_required_documents,
              style: textTheme.bodySmall.semiBold().copyWith(
                    color: colors.text.primary,
                  ),
            ),
            const Gap(4),
            for (final doc in match.requiredDocuments)
              _BulletLine(text: doc),
          ],
        ],
      ),
    );
  }
}

class _Metric extends StatelessWidget {
  const _Metric({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    final colors = MasrafyColorTheme.of(context);
    final textTheme = MasrafyTextTheme.of(context);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: textTheme.bodySmall.copyWith(color: colors.text.tertiary),
        ),
        Text(
          value,
          style: textTheme.body.semiBold().copyWith(color: colors.text.primary),
        ),
      ],
    );
  }
}

class _Badge extends StatelessWidget {
  const _Badge({required this.label, required this.bg, required this.fg});

  final String label;
  final Color bg;
  final Color fg;

  @override
  Widget build(BuildContext context) {
    final textTheme = MasrafyTextTheme.of(context);
    return Container(
      padding: const EdgeInsetsDirectional.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(6),
      ),
      child: Text(
        label,
        style: textTheme.caption.semiBold().copyWith(color: fg),
      ),
    );
  }
}

class _TierBadge extends StatelessWidget {
  const _TierBadge({required this.tier});

  final ApprovalTier tier;

  @override
  Widget build(BuildContext context) {
    final colors = MasrafyColorTheme.of(context);
    final l10n = AppLocalizations.of(context);
    final tone = switch (tier) {
      ApprovalTier.excellent || ApprovalTier.good => colors.success,
      ApprovalTier.moderate => colors.warning,
      ApprovalTier.low || ApprovalTier.veryLow => colors.error,
      ApprovalTier.unknown => colors.primary,
    };
    final label = switch (tier) {
      ApprovalTier.excellent => l10n.match_tier_excellent,
      ApprovalTier.good => l10n.match_tier_good,
      ApprovalTier.moderate => l10n.match_tier_moderate,
      ApprovalTier.low => l10n.match_tier_low,
      ApprovalTier.veryLow => l10n.match_tier_very_low,
      ApprovalTier.unknown => l10n.match_tier_unknown,
    };
    return _Badge(label: label, bg: tone.bg, fg: tone.text);
  }
}

/// A bulleted line that mirrors correctly in RTL: a leading marker in its own
/// box + the (backend) text expanded, rather than a manual "• " prefix.
class _BulletLine extends StatelessWidget {
  const _BulletLine({required this.text});

  final String text;

  @override
  Widget build(BuildContext context) {
    final colors = MasrafyColorTheme.of(context);
    final textTheme = MasrafyTextTheme.of(context);
    final style = textTheme.bodySmall.copyWith(color: colors.text.secondary);
    return Padding(
      padding: const EdgeInsetsDirectional.only(bottom: 2),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('•', style: style),
          const Gap(6),
          Expanded(child: Text(text, style: style)),
        ],
      ),
    );
  }
}
