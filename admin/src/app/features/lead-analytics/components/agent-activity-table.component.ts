import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NzTableModule } from 'ng-zorro-antd/table';
import type { AgentActivitySummaryRow } from '../lead-analytics.api.service';

@Component({
  selector: 'app-agent-activity-table',
  standalone: true,
  imports: [CommonModule, NzTableModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="table-wrap">
      <nz-table
        #t
        [nzData]="rowsArray()"
        [nzShowPagination]="false"
        [nzFrontPagination]="false"
        nzSize="middle"
      >
        <thead>
          <tr>
            <th i18n="@@leadAnalytics.col.agent">Agent</th>
            <th i18n="@@leadAnalytics.col.type">Activity type</th>
            <th class="numeric" i18n="@@leadAnalytics.col.count">Count</th>
            <th class="numeric" i18n="@@leadAnalytics.col.duration">Total duration (min)</th>
          </tr>
        </thead>
        <tbody>
          @for (row of t.data; track row.agentAlias + '|' + row.activityType) {
            <tr>
              <td>{{ row.agentAlias }}</td>
              <td>{{ formatType(row.activityType) }}</td>
              <td class="numeric">{{ row.count }}</td>
              <td class="numeric">
                {{ row.totalDurationMinutes !== null ? row.totalDurationMinutes : '—' }}
              </td>
            </tr>
          }
        </tbody>
      </nz-table>
      @if (rows().length === 0) {
        <p class="empty" i18n="@@leadAnalytics.empty">No activity recorded in this window.</p>
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

  protected rowsArray(): AgentActivitySummaryRow[] {
    return [...this.rows()];
  }

  formatType(t: string): string {
    return t
      .toLowerCase()
      .split('_')
      .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
      .join(' ');
  }
}
