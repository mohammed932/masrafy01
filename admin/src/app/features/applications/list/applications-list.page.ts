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
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzIconModule, provideNzIconsPatch } from 'ng-zorro-antd/icon';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzModalService } from 'ng-zorro-antd/modal';
import {
  RightOutline,
  UnorderedListOutline,
  AppstoreOutline,
} from '@ant-design/icons-angular/icons';
import { ApplicationsKanbanComponent, type KanbanTransition } from './components/applications-kanban.component';
import { AddActivityDialog, type AddActivityDialogData } from '../detail/components/add-activity.dialog';
import { ACTIVITY_REASONS } from '../activity-reasons';
import {
  PageHeaderComponent,
  SkeletonRowsComponent,
  StatStripComponent,
  StatusPillComponent,
  type StatStripItem,
  type StatusTone,
} from '@shared/ui';
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
    NzTableModule,
    NzIconModule,
    NzButtonModule,
    ApprovalPillComponent,
    TierFilterChipsComponent,
    LeadFilterChipsComponent,
    PageHeaderComponent,
    StatStripComponent,
    StatusPillComponent,
    SkeletonRowsComponent,
    ApplicationsKanbanComponent,
  ],
  providers: [provideNzIconsPatch([RightOutline, UnorderedListOutline, AppstoreOutline])],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="page">
      <app-page-header [title]="titleText" [subtitle]="subtitleText" />

      <app-stat-strip [items]="statItems()" [ariaLabel]="statAriaLabel" />

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

      <div class="view-toggle" role="radiogroup" [attr.aria-label]="viewToggleAria">
        <button
          type="button"
          class="view-seg"
          role="radio"
          [class.active]="view() === 'list'"
          [attr.aria-checked]="view() === 'list'"
          (click)="view.set('list')"
        >
          <span nz-icon nzType="unordered-list" nzTheme="outline"></span>
          <span i18n="@@applications.view.list">List</span>
        </button>
        <button
          type="button"
          class="view-seg"
          role="radio"
          [class.active]="view() === 'kanban'"
          [attr.aria-checked]="view() === 'kanban'"
          (click)="view.set('kanban')"
        >
          <span nz-icon nzType="appstore" nzTheme="outline"></span>
          <span i18n="@@applications.view.kanban">Kanban</span>
        </button>
      </div>

      @if (loading()) {
        <app-skeleton-rows [rows]="6" [cols]="[1, 2, 1, 1, 1]" />
      }

      @if (!loading() && rows().length === 0) {
        <div class="empty">
          <p i18n="@@applications.empty.title">No leads in this bucket yet</p>
          <p class="muted" i18n="@@applications.empty.subtitle">
            Try a different filter or wait for new applications.
          </p>
        </div>
      } @else if (view() === 'kanban') {
        <app-applications-kanban
          [rows]="rows()"
          (transitionRequested)="onTransition($event)"
        />
      } @else {
        <div class="table-wrap">
          <nz-table
            #t
            [nzData]="rowsArray()"
            [nzShowPagination]="false"
            [nzFrontPagination]="false"
            class="applications-table"
            nzSize="middle"
          >
            <thead>
              <tr>
                <th i18n="@@applications.col.probability">Probability</th>
                <th i18n="@@applications.col.purpose">Loan purpose</th>
                <th i18n="@@applications.col.amount">Amount</th>
                <th i18n="@@applications.col.status">Status</th>
                <th i18n="@@applications.col.created">Created</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              @for (row of t.data; track row.id) {
                <tr
                  class="applications-row"
                  tabindex="0"
                  role="link"
                  [attr.aria-label]="detailAriaLabel(row.id)"
                  (click)="openDetail(row.id)"
                  (keydown.enter)="openDetail(row.id)"
                  (keydown.space)="openDetail(row.id, $event)"
                >
                  <td>
                    <app-approval-pill [bestOffer]="row.bestOffer" />
                  </td>
                  <td>{{ row.loanPurpose }}</td>
                  <td class="numeric">{{ row.requestedAmountEGP }} {{ row.requestedCurrency }}</td>
                  <td>
                    <app-status-pill
                      [label]="statusLabelFor(row)"
                      [tone]="statusToneFor(row)"
                    />
                  </td>
                  <td class="muted">{{ row.createdAt | date: 'short' }}</td>
                  <td>
                    <a
                      nz-button
                      nzType="text"
                      nzShape="circle"
                      [routerLink]="['/applications', row.id]"
                      [attr.aria-label]="detailAriaLabel(row.id)"
                      (click)="$event.stopPropagation()"
                    >
                      <span nz-icon nzType="right" nzTheme="outline"></span>
                    </a>
                  </td>
                </tr>
              }
            </tbody>
          </nz-table>
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
      .view-toggle {
        display: inline-flex;
        align-self: flex-start;
        background: var(--bg-subtle, var(--color-surface-row-hover));
        border: 1px solid var(--border-default, var(--color-border-default));
        padding: 3px;
        border-radius: var(--radius-pill);
        gap: 2px;
      }
      .view-seg {
        appearance: none;
        background: transparent;
        border: 0;
        cursor: pointer;
        padding: 6px 14px;
        font-size: 13px;
        font-weight: 600;
        color: var(--text-secondary, var(--color-text-secondary));
        border-radius: var(--radius-pill);
        display: inline-flex;
        align-items: center;
        gap: 6px;
        transition: background 160ms cubic-bezier(0.4, 0, 0.2, 1),
          color 160ms cubic-bezier(0.4, 0, 0.2, 1);
      }
      .view-seg:hover:not(.active) {
        color: var(--text-primary, var(--color-text-primary));
      }
      .view-seg.active {
        background: var(--primary, var(--color-brand-primary));
        color: var(--text-on-primary, var(--color-text-on-brand));
      }
      .view-seg:focus-visible {
        outline: none;
        box-shadow: var(--focus-halo);
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
  protected readonly statAriaLabel = $localize`:@@applications.stat.aria:Application totals`;

  protected statusLabelFor(row: AdminApplicationRow): string {
    if (row.leadStatus === 'bank_decided') {
      return $localize`:@@applications.status.bankDecided:Bank decided`;
    }
    if (row.leadStatus === 'submitted_to_bank') {
      return $localize`:@@applications.status.submittedToBank:Submitted to bank`;
    }
    if (row.status === 'matched' && !row.bestOffer) {
      return $localize`:@@applications.status.noQualifying:No qualifying offers`;
    }
    return this.statusLabel(row.status);
  }

  protected statusToneFor(row: AdminApplicationRow): StatusTone {
    if (row.leadStatus === 'bank_decided') return 'success';
    if (row.leadStatus === 'submitted_to_bank') return 'info';
    if (row.status === 'matched' && !row.bestOffer) return 'warning';
    return this.statusTone(row.status);
  }

  protected statusLabel(status: string): string {
    return status
      .split('_')
      .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
      .join(' ');
  }

  protected statusTone(status: string): StatusTone {
    switch (status) {
      case 'matched':
        return 'success';
      case 'no_match':
        return 'warning';
      case 'erased':
        return 'error';
      case 'archived':
        return 'neutral';
      case 'draft':
        return 'info';
      default:
        return 'neutral';
    }
  }
  protected readonly statItems = computed<StatStripItem[]>(() => {
    const lc = this.leadCounts();
    const total = this.rows().length;
    return [
      { label: $localize`:@@applications.stat.visible:Visible`, value: total },
      { label: $localize`:@@applications.stat.stale:Stale leads`, value: lc.stale, tone: lc.stale > 0 ? 'warning' : 'muted' },
      { label: $localize`:@@applications.stat.followupToday:Follow-up today`, value: lc.followup_today, tone: lc.followup_today > 0 ? 'success' : 'muted' },
      { label: $localize`:@@applications.stat.ready:Ready for bank`, value: lc.ready_for_submission },
    ];
  });

  protected readonly rows = signal<readonly AdminApplicationRow[]>([]);
  protected readonly loading = signal(false);
  protected readonly selectedTier = signal<TierFilter>(null);
  protected readonly selectedLeadFilter = signal<LeadFilter>(null);
  protected readonly view = signal<'list' | 'kanban'>('list');
  protected readonly viewToggleAria = $localize`:@@applications.view.aria:Switch between list and Kanban view`;
  private readonly modal = inject(NzModalService);

  protected rowsArray(): AdminApplicationRow[] {
    return [...this.rows()];
  }

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

  protected onTransition(t: KanbanTransition): void {
    const seed = this.activityForTransition(t.to);
    if (!seed) return;
    const ref = this.modal.create<AddActivityDialog, AddActivityDialogData, boolean>({
      nzContent: AddActivityDialog,
      nzData: {
        applicationId: t.application.id,
        defaultActivityType: seed,
        reasonsByType: ACTIVITY_REASONS,
      },
      nzFooter: null,
      nzWidth: 720,
      nzAutofocus: null,
    });
    ref.afterClose.subscribe((saved) => {
      if (saved) void this.reload();
    });
  }

  private activityForTransition(to: AdminApplicationRow['leadStatus']): string | null {
    switch (to) {
      case 'document_collection':
        return 'CALLED_USER';
      case 'ready_for_submission':
        return 'MARKED_AS_REVIEWED';
      case 'submitted_to_bank':
        return 'SUBMITTED_TO_BANK';
      case 'bank_decided':
        return 'BANK_RESPONDED';
      default:
        return null;
    }
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
