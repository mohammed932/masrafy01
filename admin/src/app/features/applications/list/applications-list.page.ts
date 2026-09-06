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
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzIconModule, provideNzIconsPatch } from 'ng-zorro-antd/icon';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzInputModule } from 'ng-zorro-antd/input';
import {
  RightOutline,
  SearchOutline,
  ClockCircleOutline,
  ProfileOutline,
  RiseOutline,
} from '@ant-design/icons-angular/icons';
import {
  PageHeaderComponent,
  SkeletonRowsComponent,
  StatStripComponent,
  StatusPillComponent,
  type StatStripItem,
} from '@shared/ui';
import { ApplicationsApiService, type AdminApplicationRow } from '../api/applications.api.service';
import {
  LEAD_STATUS_VALUES,
  leadStatusMeta,
  type LeadStatus,
  type LeadStatusMeta,
} from '../shared/lead-status';
import {
  LeadStatusChipsComponent,
  type LeadStatusCounts,
  type LeadStatusFilter,
} from './components/lead-status-chips.component';

@Component({
  selector: 'app-applications-list-page',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    ReactiveFormsModule,
    NzTableModule,
    NzIconModule,
    NzButtonModule,
    NzInputModule,
    LeadStatusChipsComponent,
    PageHeaderComponent,
    StatStripComponent,
    StatusPillComponent,
    SkeletonRowsComponent,
  ],
  providers: [
    provideNzIconsPatch([
      RightOutline,
      SearchOutline,
      ClockCircleOutline,
      ProfileOutline,
      RiseOutline,
    ]),
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="page">
      <app-page-header [title]="titleText" [subtitle]="subtitleText" />

      <app-stat-strip [items]="statItems()" [ariaLabel]="statAriaLabel" />

      <div class="toolbar">
        <div class="search">
          <span
            nz-icon
            nzType="search"
            nzTheme="outline"
            class="search-icon"
            aria-hidden="true"
          ></span>
          <input
            nz-input
            type="search"
            [formControl]="searchControl"
            [placeholder]="searchPlaceholder"
            [attr.aria-label]="searchPlaceholder"
          />
        </div>
      </div>

      <app-lead-status-chips
        [selected]="selectedLeadStatus()"
        [counts]="leadCounts()"
        (filterChange)="onLeadStatusFilterChange($event)"
      />

      @if (loading()) {
        <app-skeleton-rows [rows]="6" [cols]="[2, 1, 1, 1, 1]" />
      }

      @if (!loading() && filteredRowsArray().length === 0) {
        <div class="empty">
          <p i18n="@@applications.empty.title">No applications match your filters</p>
          <p class="muted" i18n="@@applications.empty.subtitle">
            Clear a filter or wait for new applications.
          </p>
        </div>
      } @else if (!loading()) {
        <div class="table-wrap">
          <nz-table
            #t
            [nzData]="filteredRowsArray()"
            [nzFrontPagination]="true"
            [nzShowPagination]="filteredRowsArray().length > pageSize()"
            [nzPageIndex]="pageIndex()"
            (nzPageIndexChange)="pageIndex.set($event)"
            [nzPageSize]="pageSize()"
            (nzPageSizeChange)="onPageSizeChange($event)"
            [nzPageSizeOptions]="pageSizeOptions"
            [nzShowSizeChanger]="filteredRowsArray().length > pageSize()"
            class="applications-table"
            nzSize="middle"
          >
            <thead>
              <tr>
                <th i18n="@@applications.col.applicant">Applicant</th>
                <th i18n="@@applications.col.loan">Loan</th>
                <th i18n="@@app.detail.meta.matched">Programs matched</th>
                <th i18n="@@applications.col.status">Status</th>
                <th i18n="@@applications.col.submitted">Submitted</th>
                <th class="actions-th" aria-hidden="true"></th>
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
                    <div class="applicant">
                      <span class="avatar" aria-hidden="true">{{ initials(row) }}</span>
                      <div class="applicant-meta">
                        <span class="applicant-name">{{ applicantName(row) }}</span>
                        <span class="applicant-id tabular">#{{ shortId(row.id) }}</span>
                      </div>
                    </div>
                  </td>
                  <td>
                    <div class="loan">
                      <span class="loan-amount tabular">{{
                        formatAmount(row.requestedAmountEGP)
                      }}</span>
                      <span class="loan-purpose">{{ purposeLabel(row.loanPurpose) }}</span>
                    </div>
                  </td>
                  <td>
                    <span class="offers tabular"
                      >{{ row.eligibleProgramsCount }}/{{ row.programsCheckedCount }}</span
                    >
                  </td>
                  <td>
                    <app-status-pill [label]="leadMeta(row).label" [tone]="leadMeta(row).tone" />
                  </td>
                  <td>
                    <span class="submitted-age">
                      <span
                        nz-icon
                        nzType="clock-circle"
                        nzTheme="outline"
                        aria-hidden="true"
                      ></span>
                      {{ relativeAge(row) }}
                    </span>
                  </td>
                  <td class="actions-cell">
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

      /* ---------- toolbar ---------- */
      .toolbar {
        display: flex;
        gap: var(--space-3);
        align-items: center;
        flex-wrap: wrap;
      }
      .search {
        position: relative;
        flex: 1 1 280px;
        max-inline-size: 360px;
        display: flex;
        align-items: center;
      }
      .search input {
        padding-inline-start: 36px;
        block-size: 36px;
        border-radius: var(--radius-md);
      }
      .search-icon {
        position: absolute;
        inset-inline-start: 12px;
        color: var(--text-tertiary);
        pointer-events: none;
      }

      /* ---------- table ---------- */
      .table-wrap {
        background: var(--bg-surface);
        border-radius: var(--radius-lg);
        border: 1px solid var(--border-default);
        overflow: hidden;
      }
      .applications-table {
        width: 100%;
      }
      .applications-table :where(th) {
        font-size: 10px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.1em;
        color: var(--text-tertiary);
      }
      .actions-th {
        inline-size: 48px;
      }
      .tabular {
        font-variant-numeric: tabular-nums lining-nums;
        font-feature-settings: var(--font-feature-tabular);
      }
      .muted {
        color: var(--text-tertiary);
      }

      .applications-row {
        cursor: pointer;
        position: relative;
        transition: background var(--motion-duration-fast) var(--motion-easing-standard);
      }
      .applications-row:hover {
        background: var(--bg-subtle);
      }
      .applications-row:focus-visible {
        outline: 2px solid var(--primary);
        outline-offset: -2px;
      }

      /* applicant cell */
      .applicant {
        display: flex;
        align-items: center;
        gap: 10px;
      }
      .avatar {
        inline-size: 32px;
        block-size: 32px;
        border-radius: 50%;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        font-size: 11px;
        font-weight: 700;
        background: color-mix(in oklab, var(--primary) 12%, transparent);
        color: var(--primary);
        letter-spacing: 0.04em;
        flex-shrink: 0;
      }
      .applicant-meta {
        display: flex;
        flex-direction: column;
        gap: 2px;
        min-inline-size: 0;
      }
      .applicant-name {
        font-size: 13px;
        font-weight: 600;
        color: var(--text-primary);
      }
      .applicant-id {
        font-size: 11px;
        color: var(--text-tertiary);
        font-variant-numeric: tabular-nums lining-nums;
        font-family: var(--font-mono, var(--font-sans));
      }

      /* loan cell */
      .loan {
        display: flex;
        flex-direction: column;
        gap: 2px;
      }
      .loan-amount {
        font-size: 13px;
        font-weight: 700;
        color: var(--text-primary);
        font-variant-numeric: tabular-nums lining-nums;
        letter-spacing: -0.005em;
      }
      .loan-purpose {
        font-size: 11px;
        color: var(--text-tertiary);
        text-transform: capitalize;
      }

      /* offers cell — eligible / checked, the pair the detail page also prints */
      .offers {
        font-size: 13px;
        font-weight: 600;
        color: var(--text-secondary);
        letter-spacing: -0.005em;
      }

      .submitted-age {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        font-size: 11px;
        color: var(--text-tertiary);
        font-variant-numeric: tabular-nums lining-nums;
      }

      .actions-cell {
        text-align: end;
      }

      .empty {
        padding: var(--space-8) var(--space-6);
        text-align: center;
        background: var(--bg-surface);
        border-radius: var(--radius-lg);
        border: 1px dashed var(--border-default);
      }
      .empty p {
        margin: 0 0 var(--space-2);
        font-size: 15px;
        color: var(--text-primary);
      }
      .empty .muted {
        font-size: 13px;
      }

      @media (prefers-reduced-motion: reduce) {
        .applications-row {
          transition: none !important;
        }
      }

      @media (max-width: 720px) {
        .toolbar {
          flex-direction: column;
          align-items: stretch;
        }
        .search {
          max-inline-size: 100%;
        }
      }
    `,
  ],
})
export class ApplicationsListPage implements OnInit {
  private readonly api = inject(ApplicationsApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected readonly titleText = $localize`:@@applications.title:Applications`;
  protected readonly subtitleText = $localize`:@@applications.subtitle:Newest applications first.`;
  protected readonly statAriaLabel = $localize`:@@applications.stat.aria:Application totals`;
  protected readonly searchPlaceholder = $localize`:@@apps.search.placeholder:Search by applicant or ID`;

  protected readonly rows = signal<readonly AdminApplicationRow[]>([]);
  protected readonly loading = signal(false);
  protected readonly selectedLeadStatus = signal<LeadStatusFilter>(null);
  protected readonly searchQuery = signal('');
  protected readonly searchControl = new FormControl<string>('', { nonNullable: true });

  protected readonly pageIndex = signal(1);
  protected readonly pageSize = signal(10);
  protected readonly pageSizeOptions = [10, 25, 50];

  protected readonly leadCounts = computed<LeadStatusCounts>(() => {
    const out: LeadStatusCounts = {};
    for (const r of this.rows()) out[r.leadStatus] = (out[r.leadStatus] ?? 0) + 1;
    return out;
  });

  protected readonly filteredRows = computed<readonly AdminApplicationRow[]>(() => {
    const q = this.searchQuery().trim().toLowerCase();
    const stage = this.selectedLeadStatus();
    return this.rows().filter((r) => {
      if (stage && r.leadStatus !== stage) return false;
      if (q.length > 0) {
        const name = this.applicantName(r).toLowerCase();
        if (!name.includes(q) && !r.id.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  });

  protected filteredRowsArray(): AdminApplicationRow[] {
    return [...this.filteredRows()];
  }

  protected readonly statItems = computed<StatStripItem[]>(() => {
    const r = this.rows();
    const dayAgo = Date.now() - 86_400_000;
    const newToday = r.filter((x) => new Date(x.createdAt).getTime() >= dayAgo).length;
    const awaiting = r.filter((x) => x.leadStatus === 'pending').length;
    return [
      {
        label: $localize`:@@applications.stat.total:Total in view`,
        value: r.length,
        icon: 'profile',
      },
      {
        label: $localize`:@@applications.stat.newToday:New today`,
        value: newToday,
        tone: newToday > 0 ? 'success' : 'muted',
        icon: 'rise',
      },
      {
        label: $localize`:@@applications.stat.awaiting:Awaiting action`,
        value: awaiting,
        tone: awaiting > 0 ? 'warning' : 'muted',
        icon: 'clock-circle',
      },
    ];
  });

  async ngOnInit(): Promise<void> {
    const stage = this.route.snapshot.queryParamMap.get('leadStatus');
    if (stage && (LEAD_STATUS_VALUES as readonly string[]).includes(stage)) {
      this.selectedLeadStatus.set(stage as LeadStatus);
    }
    const q = this.route.snapshot.queryParamMap.get('q');
    if (q) {
      this.searchQuery.set(q);
      this.searchControl.setValue(q, { emitEvent: false });
    }
    this.searchControl.valueChanges.subscribe((v) => {
      this.searchQuery.set(v);
      this.pageIndex.set(1);
    });
    await this.reload();
  }

  protected onLeadStatusFilterChange(next: LeadStatusFilter): void {
    this.selectedLeadStatus.set(next);
    this.pageIndex.set(1);
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { leadStatus: next ?? null },
      queryParamsHandling: 'merge',
    });
  }

  protected onPageSizeChange(size: number): void {
    this.pageSize.set(size);
    this.pageIndex.set(1);
  }

  protected detailAriaLabel(id: string): string {
    return $localize`:@@applications.action.detail:Open application ${id}`;
  }

  protected leadMeta(row: AdminApplicationRow): LeadStatusMeta {
    return leadStatusMeta(row.leadStatus);
  }

  protected openDetail(id: string, ev?: Event): void {
    if (ev) ev.preventDefault();
    void this.router.navigate(['/applications', id]);
  }

  protected applicantName(row: AdminApplicationRow): string {
    const a = row.applicant;
    if (a) {
      const name = `${a.firstName ?? ''} ${a.lastName ?? ''}`.replace(/\s+/g, ' ').trim();
      if (name.length > 0) return name;
    }
    const masked = row.maskedApplicant as { alias?: string; nationalId?: string };
    if (masked.alias) return masked.alias;
    return $localize`:@@apps.applicant.anonymous:Applicant`;
  }

  protected initials(row: AdminApplicationRow): string {
    const name = this.applicantName(row);
    const parts = name.split(/\s+/).filter(Boolean);
    if (parts.length === 0) return '?';
    if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
    return (parts[0]!.charAt(0) + parts[1]!.charAt(0)).toUpperCase();
  }

  protected shortId(id: string): string {
    return id.length > 8 ? id.slice(-8).toUpperCase() : id.toUpperCase();
  }

  protected formatAmount(raw: string): string {
    const n = Number.parseFloat(raw);
    if (!Number.isFinite(n)) return `${raw} EGP`;
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 2)}M EGP`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K EGP`;
    return `${n.toFixed(0)} EGP`;
  }

  protected purposeLabel(p: string): string {
    // Constitution v1.7.0 / Principle II scope-lock: 4 categories.
    switch (p) {
      case 'personal':
        return $localize`:@@apps.purpose.personal:Personal`;
      case 'car':
        return $localize`:@@apps.purpose.car:Car`;
      case 'mortgage':
        return $localize`:@@apps.purpose.mortgage:Mortgage`;
      case 'business':
        return $localize`:@@apps.purpose.business:Business`;
      default:
        return p.replace(/_/g, ' ');
    }
  }

  protected relativeAge(row: AdminApplicationRow): string {
    const ms = Date.now() - new Date(row.createdAt).getTime();
    const days = Math.floor(ms / 86_400_000);
    const hours = Math.floor(ms / 3_600_000);
    const mins = Math.floor(ms / 60_000);
    if (days >= 1) return $localize`:@@apps.age.days:${days}d ago`;
    if (hours >= 1) return $localize`:@@apps.age.hours:${hours}h ago`;
    if (mins >= 1) return $localize`:@@apps.age.mins:${mins}m ago`;
    return $localize`:@@apps.age.now:just now`;
  }

  private async reload(): Promise<void> {
    this.loading.set(true);
    try {
      // Load every proceeded application so client-side counts, filters and
      // front pagination operate on the full set. Follow the cursor with a
      // safety cap so a runaway dataset can never loop forever.
      const PAGE_LIMIT = 100;
      const MAX_PAGES = 20;
      const all: AdminApplicationRow[] = [];
      let cursor: string | undefined;
      let pages = 0;
      do {
        const { rows, nextCursor } = await this.api.list({ cursor, limit: PAGE_LIMIT });
        all.push(...rows);
        cursor = nextCursor ?? undefined;
        pages += 1;
      } while (cursor && pages < MAX_PAGES);
      if (cursor) {
        console.warn(
          `[applications] stopped loading after ${pages} pages (${all.length} rows); more remain.`,
        );
      }
      this.rows.set(all);
    } finally {
      this.loading.set(false);
    }
  }
}
