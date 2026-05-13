import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
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
  imports: [CommonModule, MatTableModule, MatTooltipModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <table mat-table [dataSource]="rows()" class="accuracy-table">
      <ng-container matColumnDef="tier">
        <th mat-header-cell *matHeaderCellDef i18n="@@analytics.tier.col.tier">Tier</th>
        <td mat-cell *matCellDef="let row">{{ row.tierLabel }}</td>
      </ng-container>
      <ng-container matColumnDef="offers">
        <th mat-header-cell *matHeaderCellDef i18n="@@analytics.tier.col.offers">Offers</th>
        <td mat-cell *matCellDef="let row" class="numeric">{{ row.offerCount }}</td>
      </ng-container>
      <ng-container matColumnDef="decisions">
        <th mat-header-cell *matHeaderCellDef i18n="@@analytics.tier.col.decisions">Decisions</th>
        <td mat-cell *matCellDef="let row" class="numeric">{{ row.decisionCount }}</td>
      </ng-container>
      <ng-container matColumnDef="rate">
        <th mat-header-cell *matHeaderCellDef i18n="@@analytics.tier.col.rate">Approval rate</th>
        <td mat-cell *matCellDef="let row" class="numeric">
          @if (row.approvalRate === null) {
            <span
              class="muted"
              [matTooltip]="insufficientLabel()"
              i18n="@@analytics.tier.rate.empty"
              >—</span
            >
          } @else {
            {{ (row.approvalRate * 100).toFixed(1) }}%
          }
        </td>
      </ng-container>
      <tr mat-header-row *matHeaderRowDef="cols"></tr>
      <tr mat-row *matRowDef="let row; columns: cols"></tr>
    </table>
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
  protected readonly cols = ['tier', 'offers', 'decisions', 'rate'];

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
