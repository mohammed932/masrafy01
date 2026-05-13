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
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="page">
      <header class="page-header">
        <div class="hero">
          <p class="eyebrow" i18n="@@lookups.eyebrow">Platform configuration</p>
          <h1 class="title" i18n="@@lookups.title">Lookups</h1>
          <p class="subtitle" i18n="@@lookups.subtitle">
            Manage every operator-curated dropdown the platform exposes — values are picked up
            instantly across the admin and mobile wizard. Add, rename, retire — no deploy needed.
          </p>
        </div>
        @if (!loadingTypes()) {
          <dl class="stat-strip" aria-label="Registry totals">
            <div class="stat">
              <dt i18n="@@lookups.stat.types">Categories</dt>
              <dd class="numeric">{{ heroStats().types }}</dd>
            </div>
            <div class="stat">
              <dt i18n="@@lookups.stat.values">Active values</dt>
              <dd class="numeric">{{ heroStats().active }}</dd>
            </div>
            <div class="stat">
              <dt i18n="@@lookups.stat.deprecated">Deprecated</dt>
              <dd class="numeric muted">{{ heroStats().deprecated }}</dd>
            </div>
          </dl>
        }
      </header>

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
                <span class="type-name-ar">{{ labelFor(t.type).ar }}</span>
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
              <mat-progress-bar mode="indeterminate" />
            } @else {
              <div class="table-wrap">
                <table mat-table [dataSource]="rows()" class="lookups-table">
                  <ng-container matColumnDef="key">
                    <th mat-header-cell *matHeaderCellDef i18n="@@lookups.col.key">Key</th>
                    <td mat-cell *matCellDef="let r">
                      <code class="key">{{ r.key }}</code>
                      @if (r.systemOnly) {
                        <mat-icon
                          class="system-icon"
                          matTooltip="System-managed — labels editable, key locked"
                          i18n-matTooltip="@@lookups.systemTooltip"
                          >lock</mat-icon
                        >
                      }
                    </td>
                  </ng-container>
                  <ng-container matColumnDef="labelEn">
                    <th mat-header-cell *matHeaderCellDef i18n="@@lookups.col.en">English</th>
                    <td mat-cell *matCellDef="let r">{{ r.labelEn }}</td>
                  </ng-container>
                  <ng-container matColumnDef="labelAr">
                    <th mat-header-cell *matHeaderCellDef i18n="@@lookups.col.ar">Arabic</th>
                    <td mat-cell *matCellDef="let r" dir="rtl" class="ar">{{ r.labelAr }}</td>
                  </ng-container>
                  <ng-container matColumnDef="status">
                    <th mat-header-cell *matHeaderCellDef i18n="@@lookups.col.status">Status</th>
                    <td mat-cell *matCellDef="let r">
                      @if (r.deprecatedAt) {
                        <span class="status status-deprecated" i18n="@@lookups.statusDeprecated"
                          >Deprecated</span
                        >
                      } @else if (r.active) {
                        <span class="status status-active" i18n="@@lookups.statusActive"
                          >Active</span
                        >
                      } @else {
                        <span class="status status-inactive" i18n="@@lookups.statusInactive"
                          >Inactive</span
                        >
                      }
                    </td>
                  </ng-container>
                  <ng-container matColumnDef="actions">
                    <th mat-header-cell *matHeaderCellDef></th>
                    <td mat-cell *matCellDef="let r" class="actions">
                      <mat-slide-toggle
                        [checked]="r.active && !r.deprecatedAt"
                        [disabled]="!!r.deprecatedAt || r.systemOnly"
                        (change)="toggleActive(r, $event.checked)"
                        aria-label="Active toggle"
                      />
                      <button
                        mat-icon-button
                        type="button"
                        (click)="openEdit(r)"
                        aria-label="Edit"
                        i18n-aria-label="@@lookups.editAria"
                      >
                        <mat-icon>edit</mat-icon>
                      </button>
                      <button
                        mat-icon-button
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
        gap: var(--space-5);
        max-width: var(--content-max-width);
        margin-inline: auto;
        padding: var(--space-5) var(--space-6);
      }
      .page-header {
        display: grid;
        grid-template-columns: 1fr auto;
        gap: var(--space-5);
        align-items: end;
        padding-block-end: var(--space-3);
        border-block-end: 1px solid var(--color-border-default);
      }
      @media (max-width: 720px) {
        .page-header {
          grid-template-columns: 1fr;
        }
      }
      .hero {
        display: flex;
        flex-direction: column;
        gap: 4px;
      }
      .eyebrow {
        margin: 0;
        font-size: var(--text-xs);
        font-weight: var(--font-weight-semibold);
        letter-spacing: 0.10em;
        text-transform: uppercase;
        color: var(--color-tonal-accent);
      }
      .title {
        margin: 0;
        font-size: var(--text-3xl);
        font-weight: var(--font-weight-bold);
        color: var(--color-text-primary);
        letter-spacing: -0.015em;
        line-height: 1.1;
      }
      .subtitle {
        margin: var(--space-2) 0 0;
        max-inline-size: 56ch;
        color: var(--color-text-secondary);
        font-size: var(--text-md);
        line-height: var(--line-height-base);
      }
      .stat-strip {
        display: inline-grid;
        grid-auto-flow: column;
        gap: var(--space-5);
        margin: 0;
      }
      .stat {
        display: flex;
        flex-direction: column;
        gap: 2px;
        min-inline-size: 96px;
      }
      .stat dt {
        margin: 0;
        font-size: var(--text-xs);
        font-weight: var(--font-weight-semibold);
        letter-spacing: 0.06em;
        text-transform: uppercase;
        color: var(--color-text-tertiary);
      }
      .stat dd {
        margin: 0;
        font-size: var(--text-2xl);
        font-weight: var(--font-weight-bold);
        color: var(--color-text-primary);
        line-height: 1;
        font-variant-numeric: tabular-nums lining-nums;
      }
      .stat dd.muted {
        color: var(--color-text-tertiary);
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
        grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
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
        grid-template-columns: 36px 1fr auto;
        gap: var(--space-3);
        align-items: center;
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
      .type-name-ar {
        font-size: var(--text-xs);
        color: var(--color-text-tertiary);
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
        gap: var(--space-3);
      }
      .detail-head {
        display: flex;
        justify-content: space-between;
        align-items: flex-end;
        gap: var(--space-3);
        flex-wrap: wrap;
      }
      .detail-head h2 {
        margin: 0 0 4px;
        font-size: var(--text-xl);
        font-weight: var(--font-weight-semibold);
        color: var(--color-text-primary);
      }
      .muted {
        margin: 0;
        color: var(--color-text-secondary);
        font-size: var(--text-sm);
        max-inline-size: 60ch;
      }
      .table-wrap {
        background: var(--color-surface-default);
        border: 1px solid var(--color-border-default);
        border-radius: var(--radius-lg);
        overflow: hidden;
      }
      .lookups-table {
        inline-size: 100%;
      }
      .key {
        font-family: ui-monospace, 'SF Mono', 'JetBrains Mono', Menlo, monospace;
        font-size: var(--text-xs);
        background: var(--color-surface-elevated);
        padding: 3px 10px;
        border-radius: var(--radius-sm);
        color: var(--color-text-primary);
        border: 1px solid var(--color-border-default);
        font-feature-settings: 'liga' 0;
      }
      .system-icon {
        font-size: 16px;
        inline-size: 16px;
        block-size: 16px;
        color: var(--color-text-tertiary);
        margin-inline-start: var(--space-2);
        vertical-align: middle;
      }
      .ar {
        font-size: var(--text-sm);
      }
      .status {
        font-size: var(--text-xs);
        font-weight: var(--font-weight-semibold);
        letter-spacing: 0.04em;
        text-transform: uppercase;
        padding: 3px 10px;
        border-radius: var(--radius-pill);
        display: inline-flex;
        align-items: center;
        gap: 6px;
      }
      .status::before {
        content: '';
        inline-size: 6px;
        block-size: 6px;
        border-radius: var(--radius-pill);
        background: currentColor;
      }
      .status-active {
        background: var(--color-success-bg);
        color: var(--color-success);
      }
      .status-inactive {
        background: var(--color-surface-muted);
        color: var(--color-text-secondary);
      }
      .status-deprecated {
        background: var(--color-warning-bg);
        color: var(--color-warning);
      }
      tr.mat-mdc-row:hover {
        background: var(--color-surface-row-hover);
      }
      th.mat-mdc-header-cell {
        font-size: var(--text-xs);
        letter-spacing: 0.06em;
        text-transform: uppercase;
        color: var(--color-text-tertiary);
        font-weight: var(--font-weight-semibold);
      }
      @media (prefers-reduced-motion: reduce) {
        .type-button,
        .type-button::before,
        .type-icon {
          transition: none;
        }
      }
      .actions {
        display: inline-flex;
        align-items: center;
        gap: var(--space-2);
        justify-content: flex-end;
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
  protected readonly displayedColumns = ['key', 'labelEn', 'labelAr', 'status', 'actions'];

  protected readonly heroStats = computed(() => {
    const t = this.types();
    return {
      types: t.length,
      active: t.reduce((acc, x) => acc + x.active, 0),
      deprecated: t.reduce((acc, x) => acc + x.deprecated, 0),
    };
  });

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
