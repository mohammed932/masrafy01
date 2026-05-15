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
import { PageHeaderComponent } from '@shared/ui';
import { ApplicationsApiService, type AdminApplicationRow } from '../api/applications.api.service';
import { ApprovalPillComponent, type ApprovalTier } from './components/approval-pill.component';
import {
  TierFilterChipsComponent,
  type TierFilter,
} from './components/tier-filter-chips.component';
import {
  LeadFilterChipsComponent,
  type LeadFilter,
  type LeadFilterCounts,
} from './components/lead-filter-chips.component';

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
    LeadFilterChipsComponent,
    PageHeaderComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="page">
      <app-page-header [title]="titleText" [subtitle]="subtitleText" />

      <app-tier-filter-chips
        [selected]="selectedTier()"
        [counts]="counts()"
        (filterChange)="onFilterChange($event)"
      />

      <app-lead-filter-chips
        [selected]="selectedLeadFilter()"
        [counts]="leadCounts()"
        (filterChange)="onLeadFilterChange($event)"
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

  protected readonly titleText = $localize`:@@applications.title:Applications`;
  protected readonly subtitleText = $localize`:@@applications.subtitle:Loan-match results triaged by approval probability.`;

  protected readonly displayed = [
    'probability',
    'purpose',
    'amount',
    'status',
    'created',
    'actions',
  ];
  protected readonly rows = signal<readonly AdminApplicationRow[]>([]);
  protected readonly loading = signal(false);
  protected readonly selectedTier = signal<TierFilter>(null);
  protected readonly selectedLeadFilter = signal<LeadFilter>(null);
  protected readonly leadCounts = computed<LeadFilterCounts>(() => {
    const r = this.rows();
    return {
      needs_first_contact: r.filter((x) => x.leadStatus === 'needs_first_contact').length,
      stale: r.filter((x) => x.isStale === true).length,
      recent: r.filter((x) => {
        if (!x.lastActivity) return false;
        return Date.now() - new Date(x.lastActivity.occurredAt).getTime() < 24 * 60 * 60 * 1000;
      }).length,
      followup_today: r.filter((x) => x.hasOverdueFollowUp === true).length,
      docs_in_progress: r.filter((x) => x.leadStatus === 'document_collection').length,
      ready_for_submission: r.filter((x) => x.leadStatus === 'ready_for_submission').length,
      submitted_to_bank: r.filter((x) => x.leadStatus === 'submitted_to_bank').length,
    };
  });
  protected readonly counts = computed(() => {
    const r = this.rows();
    return {
      high: r.filter((x) => x.bestOffer?.tier === 'excellent').length,
      medium: r.filter((x) => x.bestOffer?.tier === 'good').length,
      needs_coaching: r.filter(
        (x) =>
          x.status === 'no_match' ||
          (x.bestOffer &&
            (['moderate', 'low', 'very_low'] as ApprovalTier[]).includes(x.bestOffer.tier)),
      ).length,
    };
  });

  async ngOnInit(): Promise<void> {
    const initial = this.route.snapshot.queryParamMap.get('tier');
    if (initial === 'high' || initial === 'medium' || initial === 'needs_coaching') {
      this.selectedTier.set(initial);
    }
    const leadInit = this.route.snapshot.queryParamMap.get('filter');
    if (
      leadInit === 'needs_first_contact' ||
      leadInit === 'stale' ||
      leadInit === 'recent' ||
      leadInit === 'followup_today' ||
      leadInit === 'docs_in_progress' ||
      leadInit === 'ready_for_submission' ||
      leadInit === 'submitted_to_bank'
    ) {
      this.selectedLeadFilter.set(leadInit);
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

  protected onLeadFilterChange(next: LeadFilter): void {
    this.selectedLeadFilter.set(next);
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { filter: next ?? null },
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
      const { rows } = await this.api.list({
        tier: this.selectedTier(),
        leadFilter: this.selectedLeadFilter(),
        limit: 50,
      });
      this.rows.set(rows);
    } finally {
      this.loading.set(false);
    }
  }
}
