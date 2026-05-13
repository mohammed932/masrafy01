import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatTableModule } from '@angular/material/table';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { ApplicationsApiService, type AdminApplicationRow } from '../api/applications.api.service';
import {
  ApprovalPillComponent,
  type ApprovalTier,
} from './components/approval-pill.component';
import {
  TierFilterChipsComponent,
  type TierFilter,
} from './components/tier-filter-chips.component';

/**
 * Applications list — daily-driver triage view for sales_manager / sales_agent / analyst.
 * Pill renders best-offer probability; chip filters by tier bucket.
 */
@Component({
  selector: 'app-applications-list-page',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    MatTableModule,
    MatIconModule,
    MatProgressBarModule,
    ApprovalPillComponent,
    TierFilterChipsComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="page">
      <header class="page-header">
        <div class="page-titles">
          <h1 class="title" i18n="@@applications.title">Applications</h1>
          <p class="subtitle" i18n="@@applications.subtitle">
            Loan-match results triaged by approval probability.
          </p>
        </div>
      </header>

      <app-tier-filter-chips
        [selected]="selectedTier()"
        [counts]="counts()"
        (filterChange)="onFilterChange($event)"
      />

      @if (loading()) {
        <mat-progress-bar mode="indeterminate" />
      }

      @if (!loading() && rows().length === 0) {
        <div class="empty">
          <p i18n="@@applications.empty.title">No leads in this bucket yet</p>
          <p class="muted" i18n="@@applications.empty.subtitle">
            Try a different filter or wait for new applications.
          </p>
        </div>
      } @else {
        <div class="table-wrap">
          <table mat-table [dataSource]="rows()" class="applications-table">
            <ng-container matColumnDef="probability">
              <th mat-header-cell *matHeaderCellDef i18n="@@applications.col.probability">
                Probability
              </th>
              <td mat-cell *matCellDef="let row">
                <app-approval-pill [bestOffer]="row.bestOffer" />
              </td>
            </ng-container>

            <ng-container matColumnDef="purpose">
              <th mat-header-cell *matHeaderCellDef i18n="@@applications.col.purpose">
                Loan purpose
              </th>
              <td mat-cell *matCellDef="let row">{{ row.loanPurpose }}</td>
            </ng-container>

            <ng-container matColumnDef="amount">
              <th mat-header-cell *matHeaderCellDef i18n="@@applications.col.amount">Amount</th>
              <td mat-cell *matCellDef="let row" class="numeric">
                {{ row.requestedAmountEGP }} {{ row.requestedCurrency }}
              </td>
            </ng-container>

            <ng-container matColumnDef="status">
              <th mat-header-cell *matHeaderCellDef i18n="@@applications.col.status">Status</th>
              <td mat-cell *matCellDef="let row">{{ row.status }}</td>
            </ng-container>

            <ng-container matColumnDef="created">
              <th mat-header-cell *matHeaderCellDef i18n="@@applications.col.created">Created</th>
              <td mat-cell *matCellDef="let row" class="muted">
                {{ row.createdAt | date: 'short' }}
              </td>
            </ng-container>

            <ng-container matColumnDef="actions">
              <th mat-header-cell *matHeaderCellDef></th>
              <td mat-cell *matCellDef="let row">
                <a
                  mat-icon-button
                  [routerLink]="['/applications', row.id]"
                  [attr.aria-label]="detailAriaLabel(row.id)"
                >
                  <mat-icon>chevron_right</mat-icon>
                </a>
              </td>
            </ng-container>

            <tr mat-header-row *matHeaderRowDef="displayed"></tr>
            <tr
              mat-row
              *matRowDef="let row; columns: displayed"
              class="applications-row"
              tabindex="0"
              role="link"
              [attr.aria-label]="detailAriaLabel(row.id)"
              (click)="openDetail(row.id)"
              (keydown.enter)="openDetail(row.id)"
              (keydown.space)="openDetail(row.id, $event)"
            ></tr>
          </table>
        </div>
      }
    </section>
  `,
  styles: [
    `
      .page {
        display: flex;
        flex-direction: column;
        gap: var(--space-5);
        max-width: var(--content-max-width);
        margin-inline: auto;
        padding: var(--space-5) var(--space-6);
      }
      .page-header {
        display: flex;
        align-items: flex-end;
        justify-content: space-between;
        gap: var(--space-4);
        flex-wrap: wrap;
      }
      .title {
        margin: 0 0 4px;
        font-size: 22px;
        font-weight: var(--font-weight-semibold);
        color: var(--color-text-primary);
        letter-spacing: -0.015em;
      }
      .subtitle {
        margin: 0;
        font-size: 14px;
        color: var(--color-text-secondary);
      }
      .table-wrap {
        background: var(--color-surface-default);
        border-radius: var(--radius-lg, 12px);
        border: 1px solid var(--color-border-default);
        overflow: hidden;
      }
      .applications-table {
        width: 100%;
      }
      .numeric {
        font-variant-numeric: tabular-nums lining-nums;
        font-feature-settings: var(--font-feature-tabular);
      }
      .muted {
        color: var(--color-text-tertiary);
      }
      .empty {
        padding: var(--space-8) var(--space-6);
        text-align: center;
        background: var(--color-surface-default);
        border-radius: var(--radius-lg, 12px);
        border: 1px dashed var(--color-border-default);
      }
      .empty p {
        margin: 0 0 var(--space-2);
        font-size: 15px;
        color: var(--color-text-primary);
      }
      .empty .muted {
        font-size: 13px;
      }
      .applications-row {
        cursor: pointer;
        transition: background var(--motion-duration-fast) var(--motion-easing-standard);
      }
      .applications-row:hover {
        background: var(--color-surface-row-hover);
      }
      .applications-row:focus-visible {
        outline: 2px solid var(--color-brand-primary);
        outline-offset: -2px;
      }
    `,
  ],
})
export class ApplicationsListPage implements OnInit {
  private readonly api = inject(ApplicationsApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected readonly displayed = ['probability', 'purpose', 'amount', 'status', 'created', 'actions'];
  protected readonly rows = signal<readonly AdminApplicationRow[]>([]);
  protected readonly loading = signal(false);
  protected readonly selectedTier = signal<TierFilter>(null);
  protected readonly counts = computed(() => {
    const r = this.rows();
    return {
      high: r.filter((x) => x.bestOffer?.tier === 'excellent').length,
      medium: r.filter((x) => x.bestOffer?.tier === 'good').length,
      needs_coaching: r.filter(
        (x) =>
          x.status === 'no_match' ||
          (x.bestOffer && (['moderate', 'low', 'very_low'] as ApprovalTier[]).includes(x.bestOffer.tier)),
      ).length,
    };
  });

  async ngOnInit(): Promise<void> {
    const initial = this.route.snapshot.queryParamMap.get('tier');
    if (initial === 'high' || initial === 'medium' || initial === 'needs_coaching') {
      this.selectedTier.set(initial);
    }
    await this.reload();
  }

  protected onFilterChange(next: TierFilter): void {
    this.selectedTier.set(next);
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { tier: next ?? null },
      queryParamsHandling: 'merge',
    });
    void this.reload();
  }

  protected detailAriaLabel(id: string): string {
    return $localize`:@@applications.action.detail:Open application ${id}`;
  }

  protected openDetail(id: string, ev?: Event): void {
    if (ev) ev.preventDefault();
    void this.router.navigate(['/applications', id]);
  }

  private async reload(): Promise<void> {
    this.loading.set(true);
    try {
      const { rows } = await this.api.list({ tier: this.selectedTier(), limit: 50 });
      this.rows.set(rows);
    } finally {
      this.loading.set(false);
    }
  }
}
