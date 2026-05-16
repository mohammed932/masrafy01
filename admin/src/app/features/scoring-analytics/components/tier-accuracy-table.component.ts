import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzToolTipModule } from 'ng-zorro-antd/tooltip';
import type { TierAccuracyRow } from '../scoring-analytics.api.service';
import type { ApprovalTier } from '../../applications/list/components/approval-pill.component';

interface Row {
  tier: ApprovalTier;
  tierLabel: string;
  offerCount: number;
  decisionCount: number;
  approvalRate: number | null;
}

@Component({
  selector: 'app-tier-accuracy-table',
  standalone: true,
  imports: [CommonModule, NzTableModule, NzToolTipModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <nz-table
      #t
      [nzData]="rows()"
      [nzShowPagination]="false"
      [nzFrontPagination]="false"
      class="accuracy-table"
      nzSize="middle"
    >
      <thead>
        <tr>
          <th i18n="@@analytics.tier.col.tier">Tier</th>
          <th class="numeric" i18n="@@analytics.tier.col.offers">Offers</th>
          <th class="numeric" i18n="@@analytics.tier.col.decisions">Decisions</th>
          <th class="numeric" i18n="@@analytics.tier.col.rate">Approval rate</th>
        </tr>
      </thead>
      <tbody>
        @for (row of t.data; track row.tier) {
          <tr>
            <td>{{ row.tierLabel }}</td>
            <td class="numeric">{{ row.offerCount }}</td>
            <td class="numeric">{{ row.decisionCount }}</td>
            <td class="numeric">
              @if (row.approvalRate === null) {
                <span
                  class="muted"
                  nz-tooltip
                  [nzTooltipTitle]="insufficientLabel()"
                  i18n="@@analytics.tier.rate.empty"
                  >—</span
                >
              } @else {
                {{ (row.approvalRate * 100).toFixed(1) }}%
              }
            </td>
          </tr>
        }
      </tbody>
    </nz-table>
  `,
  styles: [
    `
      :host {
        display: block;
      }
      .accuracy-table {
        width: 100%;
      }
      .numeric {
        font-variant-numeric: tabular-nums lining-nums;
        font-feature-settings: var(--font-feature-tabular);
        text-align: end;
      }
      .muted {
        color: var(--color-text-tertiary);
      }
    `,
  ],
})
export class TierAccuracyTableComponent {
  readonly data = input<TierAccuracyRow[]>([]);

  protected readonly rows = computed<Row[]>(() => {
    const ordered: ApprovalTier[] = ['excellent', 'good', 'moderate', 'low', 'very_low'];
    return ordered.map((t) => {
      const found = this.data().find((r) => r.tier === t);
      return {
        tier: t,
        tierLabel: this.tierLabel(t),
        offerCount: found?.offerCount ?? 0,
        decisionCount: found?.decisionCount ?? 0,
        approvalRate: found?.approvalRate ?? null,
      };
    });
  });

  protected insufficientLabel(): string {
    return $localize`:@@analytics.tier.rate.empty.tooltip:Insufficient data for this tier in the selected window`;
  }

  private tierLabel(tier: ApprovalTier): string {
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
