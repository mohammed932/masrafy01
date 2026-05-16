import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialog } from '@angular/material/dialog';
import {
  KeyChipComponent,
  PageHeaderComponent,
  SkeletonRowsComponent,
  StatStripComponent,
  StatusPillComponent,
  type StatStripItem,
  type StatusTone,
} from '@shared/ui';
import {
  LookupsApiService,
  type EnumerationRow,
  type EnumerationTypeSummary,
} from './lookups.api.service';
import {
  EnumerationEditDialogComponent,
  type EnumerationEditDialogData,
} from './components/enumeration-edit.dialog';

interface TypeMeta {
  en: string;
  ar: string;
  description: string;
  icon: string;
}

const TYPE_LABELS: Record<string, TypeMeta> = {
  salary_category: {
    en: 'Salary categories',
    ar: 'فئات الرواتب',
    description: 'Salary-band keys used by bank programs to gate eligibility and tenor.',
    icon: 'badge',
  },
  transfer_type: {
    en: 'Salary transfer types',
    ar: 'أنواع تحويل الراتب',
    description: "How the applicant's income reaches the bank account.",
    icon: 'swap_horiz',
  },
  employment_type: {
    en: 'Employment types',
    ar: 'أنواع التوظيف',
    description: 'Top-level employment buckets shown on the mobile wizard.',
    icon: 'work',
  },
  loan_purpose: {
    en: 'Loan purposes',
    ar: 'أغراض القرض',
    description: 'Why the customer wants the loan — drives program filtering.',
    icon: 'flag',
  },
  property_type: {
    en: 'Property types',
    ar: 'أنواع العقار',
    description: 'Mortgage-only property categories.',
    icon: 'home',
  },
  city_tier: {
    en: 'City tiers',
    ar: 'فئات المدن',
    description: 'Main-cities vs. other-cities discount tiers.',
    icon: 'location_city',
  },
  professor_rank: {
    en: 'Professor ranks',
    ar: 'رتب الأساتذة',
    description: 'Academic ranks for income-assumption strategies.',
    icon: 'school',
  },
  military_grade: {
    en: 'Military grades',
    ar: 'رتب عسكرية',
    description: 'Military / police grades for income-assumption strategies.',
    icon: 'military_tech',
  },
  product_category: {
    en: 'Product categories',
    ar: 'فئات المنتج',
    description: 'Top-level product taxonomy on the bank-programs catalog.',
    icon: 'category',
  },
  customer_program_tier: {
    en: 'Customer program tiers',
    ar: 'فئات برنامج العميل',
    description: 'Blue / Plus / Wealth customer-tier flags from the bank registry.',
    icon: 'workspace_premium',
  },
  performance_tier: {
    en: 'Performance tiers (MOB)',
    ar: 'فئات أداء العميل',
    description: 'Months-on-book bands used by buyout + cross-sell programs.',
    icon: 'timeline',
  },
  company_type: {
    en: 'Company types',
    ar: 'أنواع الشركات',
    description: 'Employer categories — Bankers program eligibility.',
    icon: 'business',
  },
  required_document: {
    en: 'Required documents',
    ar: 'المستندات المطلوبة',
    description: 'Document-type keys referenced by programs + the upload pipeline.',
    icon: 'description',
  },
  currency: {
    en: 'Currencies',
    ar: 'العملات',
    description: 'ISO 4217 codes the platform accepts on applications + programs.',
    icon: 'payments',
  },
};

@Component({
  selector: 'app-lookups-page',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatChipsModule,
    MatIconModule,
    MatProgressBarModule,
    MatSlideToggleModule,
    MatTableModule,
    MatTooltipModule,
    PageHeaderComponent,
    StatStripComponent,
    StatusPillComponent,
    KeyChipComponent,
    SkeletonRowsComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="page">
      <app-page-header
        [eyebrow]="eyebrowText"
        [title]="titleText"
        [subtitle]="subtitleText"
      >
        @if (!loadingTypes()) {
          <app-stat-strip [items]="statItems()" [ariaLabel]="statAriaLabel" />
        }
      </app-page-header>

      @if (loadingTypes()) {
        <mat-progress-bar mode="indeterminate" />
      } @else {
        <p class="section-label" i18n="@@lookups.categoriesLabel">Categories</p>
        <nav class="type-rail" aria-label="Lookup categories">
          @for (t of types(); track t.type) {
            <button
              type="button"
              class="type-button"
              [class.selected]="selectedType() === t.type"
              (click)="selectType(t.type)"
            >
              <span class="type-icon" aria-hidden="true">
                <mat-icon>{{ labelFor(t.type).icon }}</mat-icon>
              </span>
              <span class="type-body">
                <span class="type-name">{{ labelFor(t.type).en }}</span>
              </span>
              <span class="type-counts">
                <span class="count-active">{{ t.active }}</span>
                @if (t.deprecated > 0) {
                  <span class="count-deprecated"
                    ><mat-icon class="dep-dot" aria-hidden="true">history</mat-icon>{{
                      t.deprecated
                    }}</span
                  >
                }
              </span>
            </button>
          }
        </nav>

        @if (selectedType(); as t) {
          <section class="detail">
            <header class="detail-head">
              <div>
                <h2>{{ labelFor(t).en }}</h2>
                <p class="muted">{{ labelFor(t).description }}</p>
              </div>
              <button mat-flat-button color="primary" (click)="openCreate()">
                <mat-icon>add</mat-icon>
                <span i18n="@@lookups.addValue">Add value</span>
              </button>
            </header>

            @if (loadingRows()) {
              <app-skeleton-rows [rows]="4" [cols]="[3, 1, 1]" />
            } @else {
              <div class="table-wrap">
                <table mat-table [dataSource]="rows()" class="lookups-table">
                  <ng-container matColumnDef="value">
                    <th mat-header-cell *matHeaderCellDef i18n="@@lookups.col.value">Value</th>
                    <td mat-cell *matCellDef="let r" class="cell-value">
                      <span class="value-label">
                        {{ r.labelEn }}
                        @if (r.systemOnly) {
                          <mat-icon
                            class="system-icon"
                            matTooltip="System-managed — labels editable, key locked"
                            i18n-matTooltip="@@lookups.systemTooltip"
                            >lock</mat-icon
                          >
                        }
                      </span>
                      <app-key-chip class="value-key" [value]="r.key" />
                    </td>
                  </ng-container>
                  <ng-container matColumnDef="status">
                    <th mat-header-cell *matHeaderCellDef i18n="@@lookups.col.status">Status</th>
                    <td mat-cell *matCellDef="let r">
                      <app-status-pill [label]="labelForStatus(r)" [tone]="toneForStatus(r)" />
                    </td>
                  </ng-container>
                  <ng-container matColumnDef="actions">
                    <th mat-header-cell *matHeaderCellDef i18n="@@lookups.col.manage">Manage</th>
                    <td mat-cell *matCellDef="let r" class="actions">
                      <mat-slide-toggle
                        class="row-toggle"
                        [checked]="r.active && !r.deprecatedAt"
                        [disabled]="!!r.deprecatedAt || r.systemOnly"
                        (change)="toggleActive(r, $event.checked)"
                        aria-label="Active toggle"
                      />
                      <span class="actions-divider" aria-hidden="true"></span>
                      <button
                        class="icon-action"
                        type="button"
                        (click)="openEdit(r)"
                        aria-label="Edit"
                        i18n-aria-label="@@lookups.editAria"
                      >
                        <mat-icon>edit</mat-icon>
                      </button>
                      <button
                        class="icon-action danger"
                        type="button"
                        (click)="deprecate(r)"
                        [disabled]="!!r.deprecatedAt || r.systemOnly"
                        aria-label="Deprecate"
                        i18n-aria-label="@@lookups.deprecateAria"
                      >
                        <mat-icon>do_not_disturb_on</mat-icon>
                      </button>
                    </td>
                  </ng-container>

                  <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
                  <tr mat-row *matRowDef="let row; columns: displayedColumns"></tr>
                </table>

                @if (rows().length === 0) {
                  <p class="empty" i18n="@@lookups.empty">
                    No values yet. Click <strong>Add value</strong> to seed the first one.
                  </p>
                }
              </div>
            }
          </section>
        }
      }
    </section>
  `,
  styles: [
    `
      .page {
        display: flex;
        flex-direction: column;
        gap: var(--space-6);
        max-width: var(--content-max-width);
        margin-inline: auto;
        padding: var(--space-6) var(--space-6);
      }
      @media (max-width: 768px) {
        .page {
          padding: var(--space-4);
          gap: var(--space-5);
        }
      }
      .section-label {
        margin: 0;
        font-size: var(--text-xs);
        font-weight: var(--font-weight-semibold);
        letter-spacing: 0.10em;
        text-transform: uppercase;
        color: var(--color-text-secondary);
      }
      .type-rail {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
        gap: var(--space-3);
      }
      .type-button {
        appearance: none;
        text-align: start;
        cursor: pointer;
        padding: var(--space-3) var(--space-4);
        background: var(--color-surface-default);
        border: 1px solid var(--color-border-default);
        border-radius: var(--radius-md);
        display: grid;
        grid-template-columns: 36px minmax(0, 1fr) auto;
        gap: var(--space-3);
        align-items: center;
        min-block-size: 76px;
        position: relative;
        transition:
          border-color var(--motion-duration-fast) var(--motion-easing-standard),
          box-shadow var(--motion-duration-fast) var(--motion-easing-standard),
          transform var(--motion-duration-fast) var(--motion-easing-standard);
      }
      .type-button::before {
        content: '';
        position: absolute;
        inset-inline-start: 0;
        inset-block: 12px;
        inline-size: 3px;
        border-radius: 0 var(--radius-sm) var(--radius-sm) 0;
        background: transparent;
        transition: background var(--motion-duration-fast) var(--motion-easing-standard);
      }
      .type-button:hover {
        border-color: var(--color-tonal-accent);
        box-shadow: var(--shadow-sm);
        transform: translateY(-1px);
      }
      .type-button:focus-visible {
        outline: 2px solid var(--color-brand-primary);
        outline-offset: 2px;
      }
      .type-button.selected {
        border-color: var(--color-brand-primary);
        background: var(--color-tonal-accent-bg);
      }
      .type-button.selected::before {
        background: var(--color-brand-primary);
      }
      .type-icon {
        inline-size: 36px;
        block-size: 36px;
        border-radius: var(--radius-md);
        background: var(--color-surface-elevated);
        color: var(--color-tonal-accent);
        display: inline-flex;
        align-items: center;
        justify-content: center;
        transition: background var(--motion-duration-fast) var(--motion-easing-standard);
      }
      .type-button.selected .type-icon {
        background: var(--color-surface-default);
        color: var(--color-brand-primary);
      }
      .type-icon mat-icon {
        font-size: 20px;
        inline-size: 20px;
        block-size: 20px;
      }
      .type-body {
        display: flex;
        flex-direction: column;
        gap: 2px;
        min-inline-size: 0;
      }
      .type-name {
        font-weight: var(--font-weight-semibold);
        color: var(--color-text-primary);
        font-size: var(--text-sm);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .type-counts {
        display: inline-flex;
        flex-direction: column;
        gap: 2px;
        align-items: flex-end;
        font-variant-numeric: tabular-nums lining-nums;
      }
      .count-active {
        background: var(--color-success-bg);
        color: var(--color-success);
        font-size: var(--text-xs);
        padding: 2px 10px;
        border-radius: var(--radius-pill);
        font-weight: var(--font-weight-semibold);
      }
      .count-deprecated {
        color: var(--color-text-tertiary);
        font-size: var(--text-xs);
        display: inline-flex;
        align-items: center;
        gap: 2px;
      }
      .dep-dot {
        font-size: 12px;
        inline-size: 12px;
        block-size: 12px;
      }
      .detail {
        display: flex;
        flex-direction: column;
        gap: var(--space-4);
        min-block-size: 360px;
      }
      .detail-head {
        display: flex;
        justify-content: space-between;
        align-items: flex-end;
        gap: var(--space-4);
        flex-wrap: wrap;
      }
      .detail-head > div {
        flex: 1 1 auto;
        min-inline-size: 0;
      }
      .detail-head > button {
        flex: 0 0 auto;
        align-self: end;
      }
      .detail-head h2 {
        margin: 0 0 var(--space-1);
        font-size: var(--text-xl);
        font-weight: var(--font-weight-semibold);
        color: var(--color-text-primary);
        line-height: 1.2;
      }
      .muted {
        margin: 0;
        color: var(--color-text-secondary);
        font-size: var(--text-sm);
        max-inline-size: 60ch;
        line-height: var(--line-height-base);
      }
      .table-wrap {
        background: var(--color-surface-default);
        border: 1px solid var(--color-border-default);
        border-radius: var(--radius-lg);
        overflow: hidden;
      }
      .lookups-table {
        inline-size: 100%;
        table-layout: fixed;
      }
      .system-icon {
        font-size: 16px;
        inline-size: 16px;
        block-size: 16px;
        color: var(--color-text-tertiary);
        margin-inline-start: var(--space-2);
        vertical-align: middle;
      }
      .cell-value {
        padding-block: var(--space-2);
        vertical-align: middle;
      }
      .value-label {
        display: flex;
        align-items: center;
        gap: var(--space-2);
        font-size: var(--text-sm);
        font-weight: var(--font-weight-semibold);
        color: var(--color-text-primary);
        letter-spacing: -0.005em;
        line-height: 1.2;
      }
      .value-key {
        display: block;
        margin-block-start: 4px;
      }
      tr.mat-mdc-row {
        position: relative;
        block-size: 68px;
        transition: background var(--motion-duration-fast) var(--motion-easing-standard);
      }
      tr.mat-mdc-row::before {
        content: '';
        position: absolute;
        inset-block: 0;
        inset-inline-start: 0;
        inline-size: 3px;
        background: transparent;
        transition: background var(--motion-duration-fast) var(--motion-easing-standard);
      }
      tr.mat-mdc-row:hover {
        background: var(--color-surface-row-hover);
      }
      tr.mat-mdc-row:hover::before {
        background: var(--color-tonal-accent);
      }
      tr.mat-mdc-header-row {
        block-size: 44px;
      }
      th.mat-mdc-header-cell {
        font-size: var(--text-xxs);
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: var(--color-text-tertiary);
        font-weight: var(--font-weight-bold);
      }
      td.mat-mdc-cell,
      th.mat-mdc-header-cell {
        padding-inline: var(--space-4);
      }
      .lookups-table .mat-column-status {
        inline-size: 140px;
      }
      .lookups-table .mat-column-actions {
        inline-size: 220px;
      }
      .lookups-table td.mat-mdc-cell.mat-column-actions {
        text-align: start;
      }
      @media (prefers-reduced-motion: reduce) {
        .type-button,
        .type-button::before,
        .type-icon,
        tr.mat-mdc-row,
        tr.mat-mdc-row::before {
          transition: none;
        }
      }
      .actions {
        display: inline-flex;
        align-items: center;
        gap: var(--space-2);
        justify-content: flex-start;
      }
      .row-toggle {
        flex-shrink: 0;
      }
      .actions-divider {
        inline-size: 1px;
        block-size: 20px;
        background: var(--color-border-default);
        margin-inline: 2px;
      }
      .icon-action {
        appearance: none;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        inline-size: 32px;
        block-size: 32px;
        border-radius: var(--radius-md);
        border: 1px solid transparent;
        background: transparent;
        color: var(--color-text-secondary);
        cursor: pointer;
        transition:
          background var(--motion-duration-fast) var(--motion-easing-standard),
          border-color var(--motion-duration-fast) var(--motion-easing-standard),
          color var(--motion-duration-fast) var(--motion-easing-standard);
      }
      .icon-action mat-icon {
        font-size: 18px;
        inline-size: 18px;
        block-size: 18px;
      }
      .icon-action:hover {
        background: var(--color-surface-row-hover);
        border-color: var(--color-border-default);
        color: var(--color-text-primary);
      }
      .icon-action.danger:hover {
        background: var(--color-error-bg);
        border-color: var(--color-error-bg);
        color: var(--color-error);
      }
      .icon-action:disabled {
        color: var(--color-text-disabled);
        cursor: not-allowed;
      }
      .icon-action:disabled:hover {
        background: transparent;
        border-color: transparent;
        color: var(--color-text-disabled);
      }
      .icon-action:focus-visible {
        outline: var(--focus-ring-width) solid var(--focus-ring-color);
        outline-offset: var(--focus-ring-offset);
      }
      .empty {
        padding: var(--space-7) var(--space-6);
        text-align: center;
        color: var(--color-text-tertiary);
        font-size: var(--text-sm);
        line-height: var(--line-height-base);
      }
    `,
  ],
})
export class LookupsPage implements OnInit {
  private readonly api = inject(LookupsApiService);
  private readonly dialog = inject(MatDialog);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected readonly types = signal<EnumerationTypeSummary[]>([]);
  protected readonly rows = signal<EnumerationRow[]>([]);
  protected readonly loadingTypes = signal(true);
  protected readonly loadingRows = signal(false);
  protected readonly selectedType = signal<string | null>(null);
  protected readonly displayedColumns = ['value', 'status', 'actions'];

  protected readonly heroStats = computed(() => {
    const t = this.types();
    return {
      types: t.length,
      active: t.reduce((acc, x) => acc + x.active, 0),
      deprecated: t.reduce((acc, x) => acc + x.deprecated, 0),
    };
  });

  protected readonly eyebrowText = $localize`:@@lookups.eyebrow:Platform configuration`;
  protected readonly titleText = $localize`:@@lookups.title:Lookups`;
  protected readonly subtitleText = $localize`:@@lookups.subtitle:Manage every operator-curated dropdown the platform exposes — values are picked up instantly across the admin and mobile wizard. Add, rename, retire — no deploy needed.`;
  protected readonly statAriaLabel = $localize`:@@lookups.stat.aria:Registry totals`;

  protected readonly statItems = computed<StatStripItem[]>(() => {
    const s = this.heroStats();
    return [
      { label: $localize`:@@lookups.stat.types:Categories`, value: s.types },
      { label: $localize`:@@lookups.stat.values:Active values`, value: s.active, tone: 'success' },
      { label: $localize`:@@lookups.stat.deprecated:Deprecated`, value: s.deprecated, tone: 'muted' },
    ];
  });

  protected toneForStatus(row: EnumerationRow): StatusTone {
    if (row.deprecatedAt) return 'warning';
    if (row.active) return 'success';
    return 'neutral';
  }

  protected labelForStatus(row: EnumerationRow): string {
    if (row.deprecatedAt) return $localize`:@@lookups.statusDeprecated:Deprecated`;
    if (row.active) return $localize`:@@lookups.statusActive:Active`;
    return $localize`:@@lookups.statusInactive:Inactive`;
  }

  async ngOnInit(): Promise<void> {
    await this.reloadTypes();
    const initial = this.route.snapshot.queryParamMap.get('type');
    const target = initial && this.types().some((t) => t.type === initial)
      ? initial
      : this.types()[0]?.type ?? null;
    if (target) await this.selectType(target);
  }

  protected labelFor(type: string): TypeMeta {
    return (
      TYPE_LABELS[type] ?? {
        en: type,
        ar: type,
        description: '',
        icon: 'list',
      }
    );
  }

  async selectType(type: string): Promise<void> {
    this.selectedType.set(type);
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { type },
      queryParamsHandling: 'merge',
    });
    await this.reloadRows(type);
  }

  openCreate(): void {
    const type = this.selectedType();
    if (!type) return;
    this.openDialog({ mode: 'create', type });
  }

  openEdit(row: EnumerationRow): void {
    this.openDialog({ mode: 'edit', type: row.type, row });
  }

  async toggleActive(row: EnumerationRow, checked: boolean): Promise<void> {
    try {
      await this.api.update(row.id, { active: checked });
      await this.reloadAfterMutation();
    } catch {
      // toast surfaced via global error interceptor
    }
  }

  async deprecate(row: EnumerationRow): Promise<void> {
    try {
      await this.api.update(row.id, { deprecate: true });
      await this.reloadAfterMutation();
    } catch {
      // toast surfaced via global error interceptor
    }
  }

  private openDialog(data: EnumerationEditDialogData): void {
    const ref = this.dialog.open(EnumerationEditDialogComponent, {
      data,
      panelClass: 'app-modal-panel',
      backdropClass: 'app-modal-backdrop',
      autoFocus: 'first-tabbable',
    });
    ref.afterClosed().subscribe((saved) => {
      if (saved) void this.reloadAfterMutation();
    });
  }

  private async reloadTypes(): Promise<void> {
    this.loadingTypes.set(true);
    try {
      this.types.set(await this.api.listTypes());
    } finally {
      this.loadingTypes.set(false);
    }
  }

  private async reloadRows(type: string): Promise<void> {
    this.loadingRows.set(true);
    try {
      this.rows.set(await this.api.list(type));
    } finally {
      this.loadingRows.set(false);
    }
  }

  private async reloadAfterMutation(): Promise<void> {
    const type = this.selectedType();
    await this.reloadTypes();
    if (type) await this.reloadRows(type);
  }
}
