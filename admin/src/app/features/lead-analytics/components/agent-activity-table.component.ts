import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatTableModule } from '@angular/material/table';
import type { AgentActivitySummaryRow } from '../lead-analytics.api.service';

@Component({
  selector: 'app-agent-activity-table',
  standalone: true,
  imports: [CommonModule, MatTableModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="table-wrap">
      <table mat-table [dataSource]="rows()">
        <ng-container matColumnDef="agent">
          <th mat-header-cell *matHeaderCellDef i18n="@@leadAnalytics.col.agent">Agent</th>
          <td mat-cell *matCellDef="let row">{{ row.agentAlias }}</td>
        </ng-container>
        <ng-container matColumnDef="type">
          <th mat-header-cell *matHeaderCellDef i18n="@@leadAnalytics.col.type">Activity type</th>
          <td mat-cell *matCellDef="let row">{{ formatType(row.activityType) }}</td>
        </ng-container>
        <ng-container matColumnDef="count">
          <th mat-header-cell *matHeaderCellDef class="numeric" i18n="@@leadAnalytics.col.count">
            Count
          </th>
          <td mat-cell *matCellDef="let row" class="numeric">{{ row.count }}</td>
        </ng-container>
        <ng-container matColumnDef="duration">
          <th mat-header-cell *matHeaderCellDef class="numeric" i18n="@@leadAnalytics.col.duration">
            Total duration (min)
          </th>
          <td mat-cell *matCellDef="let row" class="numeric">
            {{ row.totalDurationMinutes !== null ? row.totalDurationMinutes : '—' }}
          </td>
        </ng-container>
        <tr mat-header-row *matHeaderRowDef="displayed"></tr>
        <tr mat-row *matRowDef="let row; columns: displayed"></tr>
      </table>
      @if (rows().length === 0) {
        <p class="empty" i18n="@@leadAnalytics.empty">
          No activity recorded in this window.
        </p>
      }
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
      }
      .table-wrap {
        background: var(--color-surface-default);
        border: 1px solid var(--color-border-default);
        border-radius: var(--radius-lg);
        overflow: hidden;
      }
      table {
        inline-size: 100%;
      }
      .numeric {
        font-variant-numeric: tabular-nums lining-nums;
        text-align: end;
      }
      .empty {
        padding: var(--space-6);
        text-align: center;
        color: var(--color-text-tertiary);
        font-size: var(--text-sm);
      }
    `,
  ],
})
export class AgentActivityTableComponent {
  readonly rows = input.required<readonly AgentActivitySummaryRow[]>();
  protected readonly displayed = ['agent', 'type', 'count', 'duration'];

  formatType(t: string): string {
    return t
      .toLowerCase()
      .split('_')
      .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
      .join(' ');
  }
}
