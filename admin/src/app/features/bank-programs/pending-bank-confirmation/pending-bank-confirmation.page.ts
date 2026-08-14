import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { PageHeaderComponent, SkeletonRowsComponent, StatusPillComponent } from '@shared/ui';
import { BankProgramsApiService } from '../bank-programs.api.service';
import type { PendingBankConfirmationRow } from '../bank-programs.types';

/**
 * "Waiting for the bank" — every program held back by a number the team estimated
 * rather than the bank stated (FR-036).
 *
 * ONE list, so "what are we waiting on each bank for" is a screen rather than an audit
 * of twenty programs. Each row names the FIELDS concerned, not just the program: the
 * next action is an email to the bank, and it needs the list of numbers in it.
 *
 * **Programs that existed before this feature never appear here** (FR-037). Their
 * marker map is empty by column default, so they read as fully bank-stated, stay live,
 * and are reviewed once through a deliberate one-off pass — the empty state says so,
 * because "nothing is waiting" and "nothing has been checked yet" are very different
 * claims and only one of them is true on the day this ships.
 */
@Component({
  selector: 'app-pending-bank-confirmation-page',
  standalone: true,
  imports: [
    RouterLink,
    NzTableModule,
    NzTagModule,
    PageHeaderComponent,
    SkeletonRowsComponent,
    StatusPillComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="page">
      <app-page-header
        title="Waiting for the bank"
        i18n-title="@@pending_confirmation.title"
        subtitle="Programs we cannot switch on yet, because a number on them is our estimate rather than the bank's."
        i18n-subtitle="@@pending_confirmation.subtitle"
      ></app-page-header>

      @if (loading()) {
        <app-skeleton-rows [rows]="5"></app-skeleton-rows>
      } @else if (error()) {
        <p class="pbc__error" role="alert" i18n="@@pending_confirmation.error">
          The list could not be loaded. Refresh to try again.
        </p>
      } @else if (rows().length === 0) {
        <div class="pbc__empty">
          <h3 class="pbc__emptyTitle" i18n="@@pending_confirmation.empty_title">
            Nothing is waiting on a bank
          </h3>
          <!-- FR-037, said out loud. A program that predates the marker carries no
               source information at all, so an empty list is NOT the same as "every
               number has been confirmed" — and letting it read that way is exactly
               how an unreviewed guess stays live forever. -->
          <p class="pbc__emptyBody" i18n="@@pending_confirmation.empty_body">
            Programs created before source marking are not listed here — they carry no source
            information either way, and are reviewed once as a separate pass rather than being
            switched off.
          </p>
        </div>
      } @else {
        <nz-table
          #table
          [nzData]="rows()"
          [nzShowPagination]="false"
          [nzScroll]="{ x: '900px' }"
        >
          <thead>
            <tr>
              <th i18n="@@pending_confirmation.col_program">Program</th>
              <th i18n="@@pending_confirmation.col_bank">Bank</th>
              <th i18n="@@pending_confirmation.col_fields">Numbers we estimated</th>
              <th i18n="@@pending_confirmation.col_waiting">Waiting</th>
              <th i18n="@@pending_confirmation.col_state">State</th>
            </tr>
          </thead>
          <tbody>
            @for (row of table.data; track row.programCode) {
              <tr>
                <td>
                  <a [routerLink]="['/banks/programs', row.programCode, 'edit']">
                    {{ row.friendlyName }}
                  </a>
                  <div class="pbc__code">{{ row.programCode }}</div>
                </td>
                <td>{{ row.bankName }}</td>
                <td>
                  <!-- EVERY path, not a count: the admin is about to ask the bank
                       about all of them in one message (FR-033). -->
                  <div class="pbc__paths">
                    @for (path of row.estimatedPaths; track path) {
                      <nz-tag class="pbc__path">{{ path }}</nz-tag>
                    }
                  </div>
                </td>
                <td class="pbc__waiting">
                  {{ row.waitingDays }}
                  <span class="pbc__days" i18n="@@pending_confirmation.days">days</span>
                  @if (row.waitingSinceEstimated) {
                    <!-- The marker predates its audit event (import, backfill, seed),
                         so this is the program's last-updated date standing in. Said
                         plainly rather than shown as an exact figure it is not. -->
                    <span class="pbc__approx" i18n="@@pending_confirmation.approx">(approx.)</span>
                  }
                </td>
                <td>
                  <!-- A live program carrying an estimate should not exist for long:
                       the gate blocks going live and a new marker takes it off air, so
                       this state means a marker landed by a path that bypassed both
                       (an import, a seed). Flagged as something to fix, not as normal. -->
                  <app-status-pill
                    [tone]="row.active ? 'warning' : 'neutral'"
                    [label]="row.active ? liveLabel : notLiveLabel"
                  ></app-status-pill>
                </td>
              </tr>
            }
          </tbody>
        </nz-table>
      }
    </section>
  `,
  styles: [
    `
      :host {
        display: block;
      }

      .pbc__empty {
        padding: var(--space-6) var(--space-4);
        text-align: center;
        border: 1px dashed var(--color-border-default);
        border-radius: var(--radius-md);
        background: var(--color-surface-muted);
      }

      .pbc__emptyTitle {
        margin: 0 0 var(--space-2);
        font-size: var(--text-lg);
        color: var(--color-text-primary);
      }

      .pbc__emptyBody {
        margin: 0 auto;
        max-inline-size: 62ch;
        font-size: var(--text-sm);
        color: var(--color-text-secondary);
      }

      .pbc__code {
        font-size: var(--text-xs);
        color: var(--color-text-tertiary);
        font-variant-numeric: tabular-nums;
      }

      .pbc__paths {
        display: flex;
        flex-wrap: wrap;
        gap: var(--space-1);
        max-inline-size: 46ch;
      }

      .pbc__path {
        font-size: var(--text-xs);
        font-family: var(--font-mono);
      }

      .pbc__waiting {
        font-variant-numeric: tabular-nums;
        white-space: nowrap;
      }

      .pbc__days,
      .pbc__approx {
        margin-inline-start: var(--space-1);
        font-size: var(--text-xs);
        color: var(--color-text-tertiary);
      }

      .pbc__error {
        margin: var(--space-4) 0 0;
        color: var(--color-error);
      }
    `,
  ],
})
export class PendingBankConfirmationPage {
  private readonly api = inject(BankProgramsApiService);

  readonly liveLabel = $localize`:@@pending_confirmation.state_live:Live — switch off`;
  readonly notLiveLabel = $localize`:@@pending_confirmation.state_off:Not live`;

  readonly loading = signal(true);
  readonly error = signal(false);
  private readonly data = signal<PendingBankConfirmationRow[]>([]);

  readonly rows = computed(() => this.data());

  constructor() {
    void this.load();
  }

  private async load(): Promise<void> {
    this.loading.set(true);
    this.error.set(false);
    try {
      const response = await this.api.pendingBankConfirmation({ page: 1, pageSize: 100 });
      this.data.set(response.data);
    } catch {
      this.error.set(true);
    } finally {
      this.loading.set(false);
    }
  }
}
