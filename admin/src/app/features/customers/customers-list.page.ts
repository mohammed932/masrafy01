import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { NzIconModule, provideNzIconsPatch } from 'ng-zorro-antd/icon';
import { NzDrawerService } from 'ng-zorro-antd/drawer';
import {
  IdcardOutline,
  CheckCircleOutline,
  ClockCircleOutline,
  StopOutline,
} from '@ant-design/icons-angular/icons';
import {
  PageHeaderComponent,
  StatStripComponent,
  StatusPillComponent,
  SkeletonRowsComponent,
  type StatStripItem,
} from '@shared/ui';
import { EmptyStateComponent } from '@shared/empty-state.component';
import { RelativeTimePipe } from '@shared/relative-time.pipe';
import { CustomersApiService, type CustomerListRow } from './customers.api.service';
import {
  CustomerDetailDrawerComponent,
  type CustomerDetailDrawerData,
} from './customer-detail.drawer';

/**
 * Admin Customers — list of end-users who signed up via the mobile app.
 * Read-only: searchable, paginated, with a stat strip and a row → detail
 * drawer (applications + support history). Matches the users-list house
 * pattern (avatar identity, stat strip, status pills, relative time).
 */
@Component({
  selector: 'app-customers-list',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    NzInputModule,
    NzTableModule,
    NzTagModule,
    NzIconModule,
    PageHeaderComponent,
    StatStripComponent,
    StatusPillComponent,
    SkeletonRowsComponent,
    EmptyStateComponent,
    RelativeTimePipe,
  ],
  providers: [
    provideNzIconsPatch([IdcardOutline, CheckCircleOutline, ClockCircleOutline, StopOutline]),
  ],
  template: `
    <section class="page">
      <app-page-header [title]="titleText" [subtitle]="subtitleText()"></app-page-header>

      <app-stat-strip [items]="statItems()" [ariaLabel]="statAria" />

      <div class="toolbar">
        <nz-input-group class="search-input" nzPrefixIcon="search">
          <input
            nz-input
            [formControl]="searchControl"
            i18n-placeholder="@@customers.search.placeholder"
            placeholder="Search phone, email, or name"
            autocomplete="off"
          />
        </nz-input-group>
      </div>

      <div class="table-panel">
        @if (loading() && rows().length === 0) {
          <app-skeleton-rows [rows]="6" [cols]="[2, 1, 1, 1, 1, 1]" />
        } @else {
          <nz-table
            #tbl
            [nzData]="rows()"
            [nzLoading]="loading()"
            [nzFrontPagination]="false"
            [nzShowPagination]="total() > 0"
            [nzPageIndex]="pageIndex() + 1"
            [nzPageSize]="pageSize()"
            [nzTotal]="total()"
            [nzPageSizeOptions]="[10, 25, 50]"
            [nzShowSizeChanger]="true"
            (nzPageIndexChange)="onPageIndex($event)"
            (nzPageSizeChange)="onPageSize($event)"
            [nzNoResult]="emptyTpl"
            class="customers-table"
          >
            <thead>
              <tr>
                <th i18n="@@customers.col.name">Name</th>
                <th i18n="@@customers.col.phone">Phone</th>
                <th nzAlign="center" i18n="@@customers.col.applications">Applications</th>
                <th i18n="@@customers.col.verified">Status</th>
                <th i18n="@@customers.col.created">Joined</th>
                <th i18n="@@customers.col.lastLogin">Last login</th>
              </tr>
            </thead>
            <tbody>
              @for (row of tbl.data; track row.id) {
                <tr
                  class="customers-row"
                  tabindex="0"
                  [attr.aria-label]="openLabel"
                  (click)="openDetail(row)"
                  (keydown.enter)="openDetail(row)"
                  (keydown.space)="openDetail(row); $event.preventDefault()"
                >
                  <td>
                    <div class="identity">
                      <span
                        class="avatar"
                        [attr.data-status]="row.isVerified ? 'verified' : 'pending'"
                        aria-hidden="true"
                        >{{ initials(row) }}</span
                      >
                      <div class="identity-text">
                        <span class="identity-name">
                          {{ row.firstName }} {{ row.lastName }}
                          @if (row.nameSplitNeedsReview) {
                            <span
                              class="review-flag"
                              i18n-title="@@customers.name.review"
                              title="Needs review"
                              aria-hidden="true"
                              >⚑</span
                            >
                          }
                        </span>
                        <span class="identity-email">{{ row.email ?? row.locale }}</span>
                      </div>
                    </div>
                  </td>
                  <td>
                    @if (row.phone) {
                      <code class="phone">{{ row.phone }}</code>
                    } @else {
                      <span class="muted">—</span>
                    }
                  </td>
                  <td nzAlign="center">
                    @if (row.applicationCount > 0) {
                      <span class="count-chip">{{ row.applicationCount }}</span>
                    } @else {
                      <span class="muted">0</span>
                    }
                  </td>
                  <td>
                    <div class="status-cell">
                      <app-status-pill
                        [label]="row.isVerified ? verifiedLabel : unverifiedLabel"
                        [tone]="row.isVerified ? 'success' : 'neutral'"
                      />
                      @if (!row.isActive) {
                        <app-status-pill [label]="inactiveLabel" tone="error" />
                      }
                    </div>
                  </td>
                  <td class="muted" [title]="row.createdAt">{{ row.createdAt | relativeTime }}</td>
                  <td class="muted" [title]="row.lastLoginAt ?? ''">
                    {{ row.lastLoginAt ? (row.lastLoginAt | relativeTime) : '—' }}
                  </td>
                </tr>
              }
            </tbody>
          </nz-table>
        }

        <ng-template #emptyTpl>
          <app-empty-state icon="idcard" [title]="emptyTitle()" [subtitle]="emptySubtitle()" />
        </ng-template>
      </div>
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
        animation: rise var(--motion-duration-base) var(--motion-easing-standard) both;
      }
      @keyframes rise {
        from {
          opacity: 0;
          transform: translateY(8px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }
      .toolbar {
        display: flex;
        align-items: center;
        gap: var(--space-3);
      }
      .search-input {
        max-inline-size: 360px;
        inline-size: 100%;
      }
      .table-panel {
        background: var(--color-surface-default);
        border: 1px solid var(--color-border-default);
        border-radius: var(--radius-md);
        box-shadow: var(--shadow-sm);
        overflow: hidden;
      }
      .customers-table {
        inline-size: 100%;
        background: transparent;
      }
      .customers-row {
        cursor: pointer;
        transition: background var(--motion-duration-fast) var(--motion-easing-standard);
      }
      .customers-row:hover {
        background: var(--color-surface-row-hover);
      }
      .customers-row:focus-visible {
        outline: 2px solid var(--color-brand-primary);
        outline-offset: -2px;
      }
      /* Identity */
      .identity {
        display: inline-flex;
        align-items: center;
        gap: var(--space-3);
      }
      .avatar {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        inline-size: 36px;
        block-size: 36px;
        border-radius: var(--radius-pill);
        background: var(--color-tonal-accent-bg);
        color: var(--color-brand-primary);
        font-size: var(--text-xs);
        font-weight: var(--font-weight-bold);
        letter-spacing: 0.04em;
        flex-shrink: 0;
        box-shadow: inset 0 0 0 1px var(--color-border-default);
      }
      .avatar[data-status='verified'] {
        background: var(--color-brand-primary);
        color: var(--color-text-on-brand);
        box-shadow: inset 0 0 0 1px var(--color-brand-primary-hover);
      }
      .avatar[data-status='pending'] {
        background: var(--color-surface-muted);
        color: var(--color-text-secondary);
      }
      .identity-text {
        display: inline-flex;
        flex-direction: column;
        gap: 2px;
        line-height: 1.2;
        min-inline-size: 0;
      }
      .identity-name {
        display: inline-flex;
        align-items: center;
        gap: var(--space-2);
        font-weight: var(--font-weight-semibold);
        color: var(--color-text-primary);
      }
      .review-flag {
        color: var(--color-warning);
        font-size: var(--text-sm);
        cursor: help;
      }
      .identity-email {
        font-size: var(--text-sm);
        color: var(--color-text-secondary);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        max-inline-size: 28ch;
      }
      .phone {
        font-family: 'JetBrains Mono', ui-monospace, 'SF Mono', Menlo, monospace;
        font-variant-numeric: tabular-nums;
        color: var(--color-text-primary);
      }
      .count-chip {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-inline-size: 24px;
        padding-inline: var(--space-2);
        padding-block: 2px;
        border-radius: var(--radius-pill);
        background: var(--color-tonal-accent-bg);
        color: var(--color-brand-primary);
        font-size: var(--text-xs);
        font-weight: var(--font-weight-semibold);
        font-variant-numeric: tabular-nums;
      }
      .status-cell {
        display: inline-flex;
        flex-wrap: wrap;
        gap: var(--space-2);
      }
      .muted {
        color: var(--color-text-tertiary);
        font-variant-numeric: tabular-nums;
      }
      @media (prefers-reduced-motion: reduce) {
        .page {
          animation: none;
        }
      }
    `,
  ],
})
export class CustomersListPage implements OnInit {
  private readonly api = inject(CustomersApiService);
  private readonly drawer = inject(NzDrawerService);

  protected readonly titleText = $localize`:@@customers.title:Customers`;
  protected readonly statAria = $localize`:@@customers.stat.aria:Customer totals`;
  protected readonly openLabel = $localize`:@@customers.open:View customer details`;
  protected readonly verifiedLabel = $localize`:@@customers.status.verified:Verified`;
  protected readonly unverifiedLabel = $localize`:@@customers.status.unverified:Unverified`;
  protected readonly inactiveLabel = $localize`:@@customers.status.inactive:Inactive`;

  protected readonly searchControl = new FormControl<string>('', { nonNullable: true });
  protected readonly q = signal('');
  protected readonly pageIndex = signal(0);
  protected readonly pageSize = signal(25);
  protected readonly total = signal(0);
  protected readonly loading = signal(false);
  protected readonly rows = signal<CustomerListRow[]>([]);

  private searchTimer: ReturnType<typeof setTimeout> | null = null;

  protected readonly subtitleText = (): string => {
    const base = $localize`:@@customers.subtitle:Mobile end-users who signed up for the Masrafy app.`;
    const t = this.total();
    return t > 0 ? `${base} · ${t}` : base;
  };

  protected readonly statItems = computed<StatStripItem[]>(() => {
    const r = this.rows();
    const shown = r.length;
    const verified = r.filter((c) => c.isVerified).length;
    const pending = shown - verified;
    const inactive = r.filter((c) => !c.isActive).length;
    const pct = shown > 0 ? Math.round((verified / shown) * 100) : 0;
    return [
      {
        label: $localize`:@@customers.stat.total:Total`,
        value: this.total(),
        icon: 'idcard',
        hint: $localize`:@@customers.stat.total.hint:registered customers`,
      },
      {
        label: $localize`:@@customers.stat.verified:Verified`,
        value: verified,
        tone: 'success',
        icon: 'check-circle',
        hint: $localize`:@@customers.stat.verified.hint:${pct}:pct:% of shown`,
      },
      {
        label: $localize`:@@customers.stat.pending:Pending`,
        value: pending,
        tone: 'warning',
        icon: 'clock-circle',
        hint: $localize`:@@customers.stat.pending.hint:awaiting profile`,
      },
      {
        label: $localize`:@@customers.stat.inactive:Inactive`,
        value: inactive,
        tone: inactive > 0 ? 'error' : 'muted',
        icon: 'stop',
        hint: $localize`:@@customers.stat.inactive.hint:deactivated`,
      },
    ];
  });

  protected emptyTitle(): string {
    return this.q().trim().length > 0
      ? $localize`:@@customers.empty.search.title:No matches`
      : $localize`:@@customers.empty.title:No customers yet`;
  }

  protected emptySubtitle(): string {
    return this.q().trim().length > 0
      ? $localize`:@@customers.empty.search:No customers match your search.`
      : $localize`:@@customers.empty:Mobile signups will appear here once people register in the app.`;
  }

  ngOnInit(): void {
    this.searchControl.valueChanges.subscribe((value) => {
      this.q.set(value);
      if (this.searchTimer) clearTimeout(this.searchTimer);
      this.searchTimer = setTimeout(() => {
        this.pageIndex.set(0);
        void this.load();
      }, 250);
    });
    void this.load();
  }

  onPageIndex(oneBasedIndex: number): void {
    this.pageIndex.set(Math.max(oneBasedIndex - 1, 0));
    void this.load();
  }

  onPageSize(size: number): void {
    this.pageSize.set(size);
    this.pageIndex.set(0);
    void this.load();
  }

  openDetail(row: CustomerListRow): void {
    this.drawer.create<CustomerDetailDrawerComponent, CustomerDetailDrawerData>({
      nzContent: CustomerDetailDrawerComponent,
      nzData: { customerId: row.id, onChanged: () => void this.load() },
      nzTitle: `${row.firstName} ${row.lastName}`.trim(),
      nzWidth: 'min(520px, calc(100vw - 48px))',
      nzPlacement: 'right',
    });
  }

  /** Initials from first + last name; skips non-letter last names (e.g. SOCIAL "—"). */
  protected initials(row: CustomerListRow): string {
    const first = row.firstName.trim()[0] ?? '';
    const last = row.lastName.trim().match(/[\p{L}]/u)?.[0] ?? '';
    return (first + last).toUpperCase() || '?';
  }

  private async load(): Promise<void> {
    this.loading.set(true);
    try {
      const result = await this.api.list({
        q: this.q(),
        pageIndex: this.pageIndex(),
        pageSize: this.pageSize(),
      });
      this.rows.set(result.data);
      this.total.set(result.pagination.total);
    } finally {
      this.loading.set(false);
    }
  }
}
