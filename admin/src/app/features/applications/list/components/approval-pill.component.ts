import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { CommonModule } from '@angular/common';

export type ApprovalTier = 'excellent' | 'good' | 'moderate' | 'low' | 'very_low';

export interface BestOfferSummary {
  score: number;
  tier: ApprovalTier;
  tierLabelCode: string;
}

/**
 * Pill rendering the best-offer approval score + tier label. Designed for table-cell use.
 * See specs/004-approval-probability-display/design/promax-list-pill.md for the
 * design rationale (color ramp, contrast, motion).
 */
@Component({
  selector: 'app-approval-pill',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (bestOffer(); as best) {
      <span
        class="pill"
        [attr.data-tier]="best.tier"
        [attr.aria-label]="ariaLabel(best.score, best.tier)"
      >
        <span class="score">{{ best.score }}%</span>
        <span class="tier">{{ tierLabel(best.tier) }}</span>
      </span>
    } @else {
      <span class="pill" data-tier="none" aria-label="No matches yet">
        <span class="score">—</span>
        <span class="tier" i18n="@@approval.tier.no_match">No matches yet</span>
      </span>
    }
  `,
  styles: [
    `
      :host {
        display: inline-flex;
      }
      .pill {
        display: inline-flex;
        align-items: center;
        gap: var(--space-2);
        padding: 4px 14px;
        border-radius: var(--radius-pill, 999px);
        min-height: 28px;
        font-family: var(--font-family-base);
        white-space: nowrap;
        line-height: 1;
      }
      .score {
        font-size: 13px;
        font-weight: var(--font-weight-bold);
        font-variant-numeric: tabular-nums lining-nums;
        font-feature-settings: var(--font-feature-tabular);
      }
      .tier {
        font-size: 11px;
        font-weight: var(--font-weight-semibold);
        text-transform: uppercase;
        letter-spacing: 0.04em;
      }
      .pill[data-tier='excellent'] {
        background: var(--color-success);
        color: var(--color-text-on-brand);
      }
      .pill[data-tier='good'] {
        background: color-mix(in srgb, var(--color-success) 18%, var(--color-surface-default));
        color: var(--color-success);
      }
      .pill[data-tier='moderate'] {
        background: color-mix(in srgb, var(--color-warning) 18%, var(--color-surface-default));
        color: var(--color-warning);
      }
      .pill[data-tier='low'] {
        background: color-mix(in srgb, var(--color-error) 14%, var(--color-surface-default));
        color: var(--color-error);
      }
      .pill[data-tier='very_low'] {
        background: var(--color-error);
        color: var(--color-text-on-brand);
      }
      .pill[data-tier='none'] {
        background: var(--color-surface-muted);
        color: var(--color-text-tertiary);
      }
    `,
  ],
})
export class ApprovalPillComponent {
  readonly bestOffer = input<BestOfferSummary | null>(null);

  protected readonly ariaLabel = computed(
    () => (score: number, tier: ApprovalTier) =>
      $localize`:@@approval.pill.aria:Approval probability ${score}% — ${this.tierLabel(tier)}`,
  );

  protected tierLabel(tier: ApprovalTier): string {
    switch (tier) {
      case 'excellent':
        return $localize`:@@approval.tier.excellent:Excellent`;
      case 'good':
        return $localize`:@@approval.tier.good:Good`;
      case 'moderate':
        return $localize`:@@approval.tier.moderate:Moderate`;
      case 'low':
        return $localize`:@@approval.tier.low:Low`;
      case 'very_low':
        return $localize`:@@approval.tier.very_low:Very low`;
    }
  }
}
