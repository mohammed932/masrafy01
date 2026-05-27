import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { NzIconModule, provideNzIconsPatch } from 'ng-zorro-antd/icon';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzSwitchModule } from 'ng-zorro-antd/switch';
import { NzToolTipModule } from 'ng-zorro-antd/tooltip';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzModalService } from 'ng-zorro-antd/modal';
import { BankProgramsApiService } from '../bank-programs/bank-programs.api.service';
import {
  IdcardOutline,
  SwapOutline,
  SolutionOutline,
  FlagOutline,
  HomeOutline,
  ClusterOutline,
  ReadOutline,
  SafetyOutline,
  AppstoreOutline,
  CrownOutline,
  LineChartOutline,
  ShopOutline,
  FileTextOutline,
  CreditCardOutline,
  UnorderedListOutline,
  HistoryOutline,
  LockOutline,
  EditOutline,
  MinusCircleOutline,
  PlusOutline,
  BankOutline,
  ArrowRightOutline,
  ArrowLeftOutline,
  CloseCircleOutline,
  SearchOutline,
} from '@ant-design/icons-angular/icons';
import {
  PageHeaderComponent,
  SkeletonRowsComponent,
  StatStripComponent,
  type StatStripItem,
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

/**
 * Categories not yet wired into any active bank program. Still seeded, still
 * editable (conditional consumers in cross-config validators), but parked
 * behind a "Reserved" disclosure so operators don't waste time on them by default.
 */
const RESERVED_TYPES: ReadonlySet<string> = new Set([
  'property_type',
  'city_tier',
  'professor_rank',
  'military_grade',
  'customer_program_tier',
  'performance_tier',
]);

const TYPE_LABELS: Record<string, TypeMeta> = {
  salary_category: {
    en: 'Salary categories',
    ar: 'فئات الرواتب',
    description: 'Salary-band keys used by bank programs to gate eligibility and tenor.',
    icon: 'idcard',
  },
  transfer_type: {
    en: 'Salary transfer types',
    ar: 'أنواع تحويل الراتب',
    description: "How the applicant's income reaches the bank account.",
    icon: 'swap',
  },
  employment_type: {
    en: 'Employment types',
    ar: 'أنواع التوظيف',
    description: 'Top-level employment buckets shown on the mobile wizard.',
    icon: 'solution',
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
    icon: 'cluster',
  },
  professor_rank: {
    en: 'Professor ranks',
    ar: 'رتب الأساتذة',
    description: 'Academic ranks for income-assumption strategies.',
    icon: 'read',
  },
  military_grade: {
    en: 'Military grades',
    ar: 'رتب عسكرية',
    description: 'Military / police grades for income-assumption strategies.',
    icon: 'safety',
  },
  product_category: {
    en: 'Product categories',
    ar: 'فئات المنتج',
    description: 'Top-level product taxonomy on the bank-programs catalog.',
    icon: 'appstore',
  },
  customer_program_tier: {
    en: 'Customer program tiers',
    ar: 'فئات برنامج العميل',
    description: 'Blue / Plus / Wealth customer-tier flags from the bank registry.',
    icon: 'crown',
  },
  performance_tier: {
    en: 'Performance tiers (MOB)',
    ar: 'فئات أداء العميل',
    description: 'Months-on-book bands used by buyout + cross-sell programs.',
    icon: 'line-chart',
  },
  company_type: {
    en: 'Company types',
    ar: 'أنواع الشركات',
    description: 'Employer categories — Bankers program eligibility.',
    icon: 'shop',
  },
  required_document: {
    en: 'Required documents',
    ar: 'المستندات المطلوبة',
    description: 'Document-type keys referenced by programs + the upload pipeline.',
    icon: 'file-text',
  },
  currency: {
    en: 'Currencies',
    ar: 'العملات',
    description: 'ISO 4217 codes the platform accepts on applications + programs.',
    icon: 'credit-card',
  },
};

@Component({
  selector: 'app-lookups-page',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    NzIconModule,
    NzButtonModule,
    NzTableModule,
    NzSwitchModule,
    NzToolTipModule,
    NzSpinModule,
    PageHeaderComponent,
    StatStripComponent,
    SkeletonRowsComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    provideNzIconsPatch([
      IdcardOutline,
      SwapOutline,
      SolutionOutline,
      FlagOutline,
      HomeOutline,
      ClusterOutline,
      ReadOutline,
      SafetyOutline,
      AppstoreOutline,
      CrownOutline,
      LineChartOutline,
      ShopOutline,
      FileTextOutline,
      CreditCardOutline,
      UnorderedListOutline,
      HistoryOutline,
      LockOutline,
      EditOutline,
      MinusCircleOutline,
      PlusOutline,
      BankOutline,
      ArrowRightOutline,
      ArrowLeftOutline,
      CloseCircleOutline,
      SearchOutline,
    ]),
  ],
  template: `
    <section class="page">
      <app-page-header [eyebrow]="eyebrowText" [title]="titleText" [subtitle]="subtitleText">
        @if (!loadingTypes()) {
          <app-stat-strip [items]="statItems()" [ariaLabel]="statAriaLabel" />
        }
      </app-page-header>

      @if (loadingTypes()) {
        <div class="loading-row"><nz-spin nzSimple /></div>
      } @else {
        <p class="section-label" i18n="@@lookups.categoriesLabel">Categories</p>
        <nav class="type-rail" aria-label="Lookup categories">
          @for (t of coreTypes(); track t.type) {
            <button
              type="button"
              class="type-button"
              [class.selected]="selectedType() === t.type"
              (click)="selectType(t.type)"
            >
              <span class="type-icon" aria-hidden="true">
                <span nz-icon [nzType]="labelFor(t.type).icon" nzTheme="outline"></span>
              </span>
              <span class="type-body">
                <span class="type-name">{{ labelFor(t.type).en }}</span>
              </span>
              <span class="type-counts">
                <span class="count-active">{{ t.active }}</span>
                @if (t.deprecated > 0) {
                  <span class="count-deprecated">
                    <span nz-icon nzType="history" nzTheme="outline" class="dep-dot" aria-hidden="true"></span
                    >{{ t.deprecated }}</span
                  >
                }
              </span>
            </button>
          }
        </nav>

        @if (reservedTypes().length > 0) {
          <details
            class="reserved-disclosure"
            [open]="reservedOpen()"
            (toggle)="onReservedToggle($event)"
          >
            <summary class="reserved-summary">
              <span class="reserved-label">
                <span nz-icon nzType="lock" nzTheme="outline" class="reserved-lock"></span>
                <span i18n="@@lookups.reserved.title">Reserved for future programs</span>
              </span>
              <span class="reserved-meta">
                <span class="reserved-count">{{ reservedTypes().length }}</span>
                <span class="reserved-hint" i18n="@@lookups.reserved.hint">
                  Used only when a bank publishes a program that branches by these fields
                </span>
              </span>
            </summary>
            <nav class="type-rail reserved-rail" aria-label="Reserved lookup categories">
              @for (t of reservedTypes(); track t.type) {
                <button
                  type="button"
                  class="type-button reserved"
                  [class.selected]="selectedType() === t.type"
                  (click)="selectType(t.type)"
                >
                  <span class="type-icon" aria-hidden="true">
                    <span nz-icon [nzType]="labelFor(t.type).icon" nzTheme="outline"></span>
                  </span>
                  <span class="type-body">
                    <span class="type-name">{{ labelFor(t.type).en }}</span>
                  </span>
                  <span class="type-counts">
                    <span class="count-active">{{ t.active }}</span>
                  </span>
                </button>
              }
            </nav>
          </details>
        }

        @if (selectedType(); as t) {
          <section class="detail">
            <header class="detail-head">
              <div>
                <h2>{{ labelFor(t).en }}</h2>
                <p class="muted">{{ labelFor(t).description }}</p>
              </div>
              <button nz-button nzType="primary" (click)="openCreate()">
                <span nz-icon nzType="plus" nzTheme="outline"></span>
                <span i18n="@@lookups.addValue">Add value</span>
              </button>
            </header>

            @if (loadingRows()) {
              <app-skeleton-rows [rows]="4" [cols]="[3, 1, 1]" />
            } @else {
              <div class="values-toolbar">
                <div class="values-search">
                  <span nz-icon nzType="search" nzTheme="outline" aria-hidden="true"></span>
                  <input
                    type="text"
                    placeholder="Filter values…"
                    i18n-placeholder="@@lookups.search"
                    [(ngModel)]="valueFilter"
                    (ngModelChange)="onValueFilter($event)"
                  />
                  @if (valueFilter) {
                    <button type="button" class="clear" (click)="clearFilter()" aria-label="Clear">
                      <span nz-icon nzType="close-circle" nzTheme="outline"></span>
                    </button>
                  }
                </div>
                <span class="values-count">
                  {{ filteredRows().activeCount }} active
                  @if (filteredRows().inactiveCount > 0) {
                    · {{ filteredRows().inactiveCount }} inactive
                  }
                  @if (filteredRows().deprecated.length > 0) {
                    · {{ filteredRows().deprecated.length }} deprecated
                  }
                </span>
              </div>

              @if (filteredRows().live.length === 0 && filteredRows().deprecated.length === 0) {
                <div class="empty-card">
                  <span class="empty-icon" nz-icon nzType="flag" nzTheme="outline" aria-hidden="true"></span>
                  <p class="empty-title" i18n="@@lookups.empty.title">No matching values</p>
                  <p class="empty-text" i18n="@@lookups.empty">
                    @if (valueFilter) { Try a different search term. } @else { Click <strong>Add value</strong> to seed the first one. }
                  </p>
                </div>
              } @else {
                <ul class="value-list" role="list">
                  @for (r of filteredRows().live; track r.id) {
                    <li class="value-card" [class.system]="r.systemOnly" [class.muted]="!r.active">
                      <span class="value-main">
                        <span class="value-text">{{ r.labelEn }}</span>
                        @if (r.systemOnly) {
                          <span
                            class="badge system-badge"
                            nz-tooltip
                            nzTooltipTitle="System-managed — labels editable, key locked"
                            i18n-nzTooltipTitle="@@lookups.systemTooltip"
                          >
                            <span nz-icon nzType="lock" nzTheme="outline" aria-hidden="true"></span>
                            <span i18n="@@lookups.system">System</span>
                          </span>
                        }
                      </span>
                      <span class="value-actions">
                        <nz-switch
                          class="row-toggle"
                          [ngModel]="r.active && !r.deprecatedAt"
                          [nzDisabled]="!!r.deprecatedAt || r.systemOnly"
                          (ngModelChange)="toggleActive(r, $event)"
                          nzSize="small"
                        ></nz-switch>
                        <button
                          class="icon-action"
                          type="button"
                          (click)="openEdit(r)"
                          aria-label="Edit"
                          i18n-aria-label="@@lookups.editAria"
                          nz-tooltip
                          nzTooltipTitle="Edit"
                        >
                          <span nz-icon nzType="edit" nzTheme="outline"></span>
                        </button>
                        <button
                          class="icon-action danger"
                          type="button"
                          (click)="deprecate(r)"
                          [disabled]="!!r.deprecatedAt || r.systemOnly"
                          aria-label="Deprecate"
                          i18n-aria-label="@@lookups.deprecateAria"
                          nz-tooltip
                          nzTooltipTitle="Deprecate"
                        >
                          <span nz-icon nzType="minus-circle" nzTheme="outline"></span>
                        </button>
                      </span>
                    </li>
                  }

                  @if (filteredRows().deprecated.length > 0) {
                    <li class="value-divider" aria-hidden="true">
                      <span nz-icon nzType="history" nzTheme="outline"></span>
                      <span i18n="@@lookups.deprecated">Deprecated</span>
                    </li>
                    @for (r of filteredRows().deprecated; track r.id) {
                      <li class="value-card deprecated">
                        <span class="value-main">
                          <span class="value-text">{{ r.labelEn }}</span>
                          <span class="badge dep-badge" i18n="@@lookups.dep">Deprecated</span>
                        </span>
                        <span class="value-actions">
                          <button
                            class="icon-action"
                            type="button"
                            (click)="openEdit(r)"
                            aria-label="Edit"
                          >
                            <span nz-icon nzType="edit" nzTheme="outline"></span>
                          </button>
                        </span>
                      </li>
                    }
                  }
                </ul>
              }
            }
          </section>
        }
      }
    </section>
  `,
  styles: [
    `
      /* ───────────── Banks hero ───────────── */
      .banks-hero {
        position: relative;
        display: flex;
        flex-direction: column;
        background:
          radial-gradient(circle at 0% 0%, rgba(161, 124, 91, 0.10) 0%, transparent 55%),
          var(--bg-surface);
        border: 1px solid var(--border-default);
        border-radius: var(--radius-lg);
        overflow: hidden;
        box-shadow: var(--shadow-sm);
        transition: box-shadow var(--motion-duration-base) var(--motion-easing-standard),
                    transform var(--motion-duration-base) var(--motion-easing-standard);
      }
      .banks-hero:hover {
        box-shadow: var(--shadow-md);
      }
      .banks-hero__accent {
        height: 4px;
        background: linear-gradient(
          90deg,
          var(--azure-600) 0%,
          var(--azure-500) 38%,
          var(--bronze-400) 100%
        );
      }
      .banks-hero__body {
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto auto;
        gap: var(--space-6);
        align-items: center;
        padding: var(--space-5) var(--space-6);
      }
      .banks-hero__intro {
        display: flex;
        flex-direction: column;
        gap: var(--space-1);
        min-inline-size: 0;
      }
      .banks-hero__eyebrow {
        font-size: var(--text-xs);
        font-weight: var(--font-semibold);
        letter-spacing: 0.16em;
        text-transform: uppercase;
        color: var(--bronze-600);
      }
      .banks-hero__title {
        margin: 0;
        font-size: var(--text-2xl);
        font-weight: var(--font-bold);
        letter-spacing: -0.02em;
        color: var(--text-primary);
        line-height: var(--leading-tight);
      }
      .banks-hero__desc {
        margin: var(--space-1) 0 0;
        max-inline-size: 56ch;
        font-size: var(--text-sm);
        line-height: var(--leading-relaxed);
        color: var(--text-secondary);
      }
      .banks-hero__deck {
        display: flex;
        gap: var(--space-3);
        align-items: stretch;
      }
      .banks-hero__metric {
        display: flex;
        align-items: center;
        gap: var(--space-3);
        padding: var(--space-3) var(--space-4);
        background: var(--bg-base);
        border: 1px solid var(--border-default);
        border-radius: var(--radius-md);
        min-inline-size: 132px;
      }
      .banks-hero__metric-icon {
        inline-size: 38px;
        block-size: 38px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        border-radius: var(--radius-md);
        background: rgba(8, 105, 195, 0.08);
        color: var(--azure-600);
        font-size: 18px;
      }
      .banks-hero__metric-icon--bronze {
        background: rgba(161, 124, 91, 0.14);
        color: var(--bronze-600);
      }
      .banks-hero__metric-text {
        display: flex;
        flex-direction: column;
        line-height: 1.1;
      }
      .banks-hero__metric-value {
        font-size: var(--text-2xl);
        font-weight: var(--font-bold);
        color: var(--text-primary);
        letter-spacing: -0.015em;
      }
      .banks-hero__metric-label {
        font-size: var(--text-xs);
        font-weight: var(--font-medium);
        color: var(--text-tertiary);
        text-transform: uppercase;
        letter-spacing: 0.10em;
        margin-block-start: 2px;
      }
      .banks-hero__actions {
        display: flex;
        flex-direction: column;
        gap: var(--space-2);
        align-items: stretch;
        min-inline-size: 220px;
      }
      .banks-hero__cta {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: var(--space-2);
        height: 44px;
        padding-inline: var(--space-5);
        border-radius: var(--radius-md);
        font-size: var(--text-sm);
        font-weight: var(--font-semibold);
        letter-spacing: 0.01em;
        text-decoration: none;
        cursor: pointer;
        transition:
          background var(--motion-duration-fast) var(--motion-easing-standard),
          color var(--motion-duration-fast) var(--motion-easing-standard),
          border-color var(--motion-duration-fast) var(--motion-easing-standard),
          transform var(--motion-duration-fast) var(--motion-easing-standard),
          box-shadow var(--motion-duration-fast) var(--motion-easing-standard);
      }
      .banks-hero__cta--primary {
        background: linear-gradient(135deg, var(--azure-600) 0%, var(--azure-500) 100%);
        color: var(--text-on-primary);
        border: 1px solid transparent;
        box-shadow: 0 1px 2px rgba(8, 105, 195, 0.18);
      }
      .banks-hero__cta--primary:hover {
        transform: translateY(-1px);
        box-shadow: 0 8px 20px -6px rgba(8, 105, 195, 0.35);
        color: var(--text-on-primary);
        text-decoration: none;
      }
      .banks-hero__cta--primary:active {
        transform: translateY(0);
        box-shadow: 0 1px 2px rgba(8, 105, 195, 0.18);
      }
      .banks-hero__cta--primary:focus-visible {
        outline: 2px solid var(--bronze-500);
        outline-offset: 2px;
      }
      .banks-hero__cta--ghost {
        background: transparent;
        color: var(--azure-600);
        border: 1px solid var(--border-default);
      }
      .banks-hero__cta--ghost:hover {
        background: var(--bg-base);
        border-color: var(--bronze-500);
        color: var(--azure-700);
        text-decoration: none;
      }
      .banks-hero__cta--ghost:focus-visible {
        outline: 2px solid var(--azure-600);
        outline-offset: 2px;
      }
      @media (max-width: 1024px) {
        .banks-hero__body {
          grid-template-columns: 1fr;
          gap: var(--space-5);
        }
        .banks-hero__deck {
          display: grid;
          grid-template-columns: 1fr 1fr;
        }
        .banks-hero__actions {
          flex-direction: row;
          min-inline-size: 0;
        }
        .banks-hero__cta {
          flex: 1 1 auto;
        }
      }
      @media (max-width: 560px) {
        .banks-hero__body {
          padding: var(--space-4);
        }
        .banks-hero__deck {
          grid-template-columns: 1fr;
        }
        .banks-hero__actions {
          flex-direction: column;
        }
      }

      .page {
        display: flex;
        flex-direction: column;
        gap: var(--space-6);
        inline-size: 100%;
        max-inline-size: none;
        padding: var(--space-6) var(--space-6);
      }
      @media (max-width: 768px) {
        .page {
          padding: var(--space-4);
          gap: var(--space-5);
        }
      }
      /* ── Innovated value list ─────────────────────────────────────── */
      .values-toolbar {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: var(--space-3);
        padding: var(--space-4) 0 var(--space-6);
      }
      .values-search {
        position: relative;
        display: flex;
        align-items: center;
        flex: 1 1 320px;
        max-inline-size: 480px;
      }
      .values-search [nz-icon]:first-child {
        position: absolute;
        inset-inline-start: var(--space-3);
        color: var(--text-tertiary, var(--color-text-tertiary));
        font-size: 14px;
        pointer-events: none;
      }
      .values-search input {
        inline-size: 100%;
        padding: 8px var(--space-4);
        padding-inline-start: calc(var(--space-3) + 22px);
        padding-inline-end: var(--space-7);
        border: 1px solid var(--border-default, var(--color-border-default));
        border-radius: var(--radius-pill);
        background: var(--bg-surface, var(--color-surface-default));
        font-size: var(--text-sm);
        color: var(--text-primary, var(--color-text-primary));
        transition: border-color 150ms ease, box-shadow 150ms ease;
      }
      .values-search input:focus {
        outline: none;
        border-color: var(--primary, var(--color-brand-primary));
        box-shadow: 0 0 0 3px rgba(8, 105, 195, 0.15);
      }
      .values-search .clear {
        position: absolute;
        inset-inline-end: var(--space-2);
        background: transparent;
        border: none;
        cursor: pointer;
        color: var(--text-tertiary, var(--color-text-tertiary));
        font-size: 16px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        padding: 4px;
        border-radius: 50%;
        transition: background 150ms ease, color 150ms ease;
      }
      .values-search .clear:hover {
        background: var(--bg-muted, var(--color-surface-muted));
        color: var(--text-primary, var(--color-text-primary));
      }
      .values-count {
        font-size: var(--text-xs);
        font-weight: 600;
        color: var(--text-tertiary, var(--color-text-tertiary));
        letter-spacing: 0.04em;
        text-transform: uppercase;
        font-variant-numeric: tabular-nums;
      }
      .value-list {
        list-style: none;
        margin: 0;
        padding: 0;
        display: flex;
        flex-direction: column;
        gap: var(--space-2);
      }
      .value-card {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: var(--space-3);
        padding: var(--space-3) var(--space-4);
        background: var(--bg-surface, var(--color-surface-default));
        border: 1px solid var(--border-default, var(--color-border-default));
        border-radius: var(--radius-md);
        transition: border-color 150ms cubic-bezier(0.4, 0, 0.2, 1),
                    box-shadow 150ms cubic-bezier(0.4, 0, 0.2, 1),
                    transform 150ms cubic-bezier(0.4, 0, 0.2, 1);
      }
      .value-card:hover {
        border-color: var(--primary, var(--color-brand-primary));
        box-shadow: var(--shadow-sm);
      }
      .value-card.deprecated {
        opacity: 0.68;
        background: var(--bg-subtle, var(--color-surface-row-hover));
      }
      .value-card.muted .value-text { color: var(--text-tertiary, var(--color-text-tertiary)); }
      .value-card.system {
        background: linear-gradient(0deg, var(--bg-subtle, var(--color-surface-row-hover)), var(--bg-subtle, var(--color-surface-row-hover)));
      }
      .value-main {
        display: inline-flex;
        align-items: center;
        gap: var(--space-2);
        min-inline-size: 0;
      }
      .value-text {
        font-size: var(--text-sm);
        font-weight: 600;
        color: var(--text-primary, var(--color-text-primary));
        letter-spacing: -0.005em;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .badge {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        padding: 2px 8px;
        border-radius: var(--radius-pill);
        font-size: 11px;
        font-weight: 600;
        letter-spacing: 0.02em;
      }
      .system-badge {
        background: var(--bg-muted, var(--color-surface-muted));
        color: var(--text-tertiary, var(--color-text-tertiary));
      }
      .system-badge [nz-icon] { font-size: 10px; }
      .dep-badge {
        background: rgba(185, 115, 0, 0.12);
        color: var(--warning, var(--color-warning));
      }
      .value-actions {
        display: inline-flex;
        align-items: center;
        gap: 6px;
      }
      .value-divider {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        margin: var(--space-3) 0 var(--space-1);
        padding: 0 var(--space-2);
        font-size: 11px;
        font-weight: 700;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: var(--text-tertiary, var(--color-text-tertiary));
      }
      .empty-card {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: var(--space-2);
        padding: var(--space-9) var(--space-5);
        background: var(--bg-surface, var(--color-surface-default));
        border: 1px dashed var(--border-default, var(--color-border-default));
        border-radius: var(--radius-lg);
        text-align: center;
      }
      .empty-icon {
        font-size: 40px;
        color: var(--border-strong, var(--color-border-strong));
      }
      .empty-title {
        margin: 0;
        font-size: var(--text-md);
        font-weight: 700;
        color: var(--text-primary, var(--color-text-primary));
      }
      .empty-text {
        margin: 0;
        font-size: var(--text-sm);
        color: var(--text-tertiary, var(--color-text-tertiary));
      }
      .icon-action {
        background: transparent;
        border: none;
        cursor: pointer;
        inline-size: 32px;
        block-size: 32px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        border-radius: var(--radius-md);
        color: var(--text-secondary, var(--color-text-secondary));
        transition: background 150ms ease, color 150ms ease;
      }
      .icon-action:hover:not(:disabled) {
        background: var(--bg-subtle, var(--color-surface-row-hover));
        color: var(--primary, var(--color-brand-primary));
      }
      .icon-action.danger:hover:not(:disabled) {
        color: var(--error, var(--color-error));
        background: var(--error-50, rgba(192, 41, 46, 0.08));
      }
      .icon-action:disabled {
        cursor: not-allowed;
        opacity: 0.45;
      }
      @media (prefers-reduced-motion: reduce) {
        .value-card { transition: none; }
      }

      .back-link {
        appearance: none;
        background: transparent;
        border: none;
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        gap: var(--space-2);
        padding: 6px 10px;
        margin-block-end: var(--space-3);
        border-radius: var(--radius-md);
        color: var(--text-secondary, var(--color-text-secondary));
        font-size: var(--text-sm);
        font-weight: 600;
        transition: color 150ms ease, background 150ms ease;
      }
      .back-link:hover {
        color: var(--primary, var(--color-brand-primary));
        background: var(--bg-subtle, var(--color-surface-row-hover));
      }
      .back-link:focus-visible {
        outline: 2px solid var(--primary, var(--color-brand-primary));
        outline-offset: 2px;
      }
      .type-strip {
        display: flex;
        gap: var(--space-2);
        padding: var(--space-2) 0 var(--space-4);
        overflow-x: auto;
        scrollbar-width: thin;
      }
      .type-strip::-webkit-scrollbar { block-size: 6px; }
      .type-strip::-webkit-scrollbar-thumb {
        background: var(--border-default, var(--color-border-default));
        border-radius: var(--radius-pill);
      }
      .type-pill {
        appearance: none;
        flex: 0 0 auto;
        display: inline-flex;
        align-items: center;
        gap: 8px;
        padding: 6px 12px;
        background: var(--bg-surface, var(--color-surface-default));
        border: 1px solid var(--border-default, var(--color-border-default));
        border-radius: var(--radius-pill);
        font-size: 13px;
        font-weight: 600;
        color: var(--text-secondary, var(--color-text-secondary));
        cursor: pointer;
        transition:
          background 150ms cubic-bezier(0.4, 0, 0.2, 1),
          border-color 150ms cubic-bezier(0.4, 0, 0.2, 1),
          color 150ms cubic-bezier(0.4, 0, 0.2, 1);
      }
      .type-pill [nz-icon] {
        color: var(--accent, var(--color-tonal-accent));
        font-size: 14px;
      }
      .type-pill:hover {
        border-color: var(--primary, var(--color-brand-primary));
        color: var(--text-primary, var(--color-text-primary));
      }
      .type-pill:focus-visible {
        outline: 2px solid var(--primary, var(--color-brand-primary));
        outline-offset: 2px;
      }
      .type-pill.selected {
        background: var(--primary, var(--color-brand-primary));
        border-color: var(--primary, var(--color-brand-primary));
        color: var(--text-on-primary, var(--color-text-on-brand));
      }
      .type-pill.selected [nz-icon] {
        color: var(--text-on-primary, var(--color-text-on-brand));
      }
      .type-pill-count {
        padding: 0 6px;
        border-radius: var(--radius-pill);
        background: var(--bg-muted, var(--color-surface-muted));
        color: var(--text-tertiary, var(--color-text-tertiary));
        font-size: 11px;
        font-weight: 700;
        line-height: 1.6;
      }
      .type-pill.selected .type-pill-count {
        background: rgba(255, 255, 255, 0.18);
        color: var(--text-on-primary, var(--color-text-on-brand));
      }
      .loading-row {
        display: flex;
        justify-content: center;
        padding-block: var(--space-4);
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
      .reserved-disclosure {
        margin-block-start: var(--space-2);
        border: 1px dashed var(--color-border-default);
        border-radius: var(--radius-lg);
        background: var(--bg-subtle, var(--color-surface-row-hover));
        padding: var(--space-3) var(--space-4);
      }
      .reserved-disclosure[open] {
        background: var(--color-surface-default);
      }
      .reserved-summary {
        cursor: pointer;
        display: flex;
        align-items: center;
        gap: var(--space-3);
        list-style: none;
      }
      .reserved-summary::-webkit-details-marker { display: none; }
      .reserved-summary::marker { display: none; }
      .reserved-label {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        font-size: 13px;
        font-weight: 700;
        letter-spacing: 0.04em;
        text-transform: uppercase;
        color: var(--text-secondary, var(--color-text-secondary));
      }
      .reserved-lock { color: var(--text-tertiary, var(--color-text-tertiary)); font-size: 14px; }
      .reserved-meta {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        margin-inline-start: auto;
      }
      .reserved-count {
        font-size: 11px;
        font-weight: 700;
        padding: 2px 8px;
        border-radius: var(--radius-pill);
        background: var(--bg-muted, var(--color-surface-muted));
        color: var(--text-tertiary, var(--color-text-tertiary));
      }
      .reserved-hint {
        font-size: 11px;
        color: var(--text-tertiary, var(--color-text-tertiary));
        max-inline-size: 44ch;
      }
      .reserved-rail {
        margin-block-start: var(--space-3);
      }
      .type-button.reserved {
        opacity: 0.85;
        border-style: dashed;
      }
      .type-button.reserved.selected {
        opacity: 1;
        border-style: solid;
      }
      @media (max-width: 720px) {
        .reserved-hint { display: none; }
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
        font-size: 20px;
      }
      .type-button.selected .type-icon {
        background: var(--color-surface-default);
        color: var(--color-brand-primary);
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
        inline-size: 100%;
        background: var(--color-surface-default);
        border: 1px solid var(--color-border-default);
        border-radius: var(--radius-lg);
        overflow: hidden;
      }
      :host ::ng-deep nz-table.lookups-table {
        display: block;
        inline-size: 100%;
      }
      :host ::ng-deep .lookups-table .ant-table-wrapper,
      :host ::ng-deep .lookups-table .ant-table,
      :host ::ng-deep .lookups-table .ant-table-container,
      :host ::ng-deep .lookups-table .ant-table-content,
      :host ::ng-deep .lookups-table table {
        inline-size: 100% !important;
        min-inline-size: 100%;
        max-inline-size: none;
      }
      .system-icon {
        font-size: 16px;
        color: var(--color-text-tertiary);
        margin-inline-start: var(--space-2);
        vertical-align: middle;
      }
      .cell-value {
        padding-block: var(--space-2);
        vertical-align: middle;
      }
      .value-label {
        display: inline-flex;
        align-items: center;
        gap: var(--space-2);
        font-size: var(--text-sm);
        font-weight: var(--font-weight-semibold);
        color: var(--color-text-primary);
        letter-spacing: -0.005em;
        line-height: 1.2;
      }
      :host ::ng-deep .lookups-table .ant-table-cell {
        background: transparent;
        border-block-end: 1px solid var(--color-border-default);
      }
      :host ::ng-deep .lookups-table .ant-table-thead > tr > th {
        background: transparent;
        color: var(--color-text-tertiary);
        font-size: var(--text-xxs);
        font-weight: var(--font-weight-bold);
        letter-spacing: 0.08em;
        text-transform: uppercase;
        padding-inline: var(--space-4);
        padding-block: var(--space-2);
        text-align: start;
      }
      :host ::ng-deep .lookups-table .ant-table-tbody > tr.lookup-row {
        position: relative;
        block-size: 56px;
        background: transparent;
        transition: background var(--motion-duration-fast) var(--motion-easing-standard);
      }
      :host ::ng-deep .lookups-table .ant-table-tbody > tr.lookup-row:hover > td {
        background: var(--color-surface-row-hover);
      }
      :host ::ng-deep .lookups-table .ant-table-tbody > tr.lookup-row > td {
        padding-inline: var(--space-4);
        padding-block: var(--space-3);
        color: var(--color-text-primary);
        font-size: var(--text-sm);
        vertical-align: middle;
      }
      :host ::ng-deep .lookups-table .ant-table-tbody > tr.lookup-row:last-child > td {
        border-block-end: 0;
      }
      @media (prefers-reduced-motion: reduce) {
        .type-button,
        .type-button::before,
        .type-icon,
        :host ::ng-deep .lookups-table .ant-table-tbody > tr.lookup-row {
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
        font-size: 18px;
        transition:
          background var(--motion-duration-fast) var(--motion-easing-standard),
          border-color var(--motion-duration-fast) var(--motion-easing-standard),
          color var(--motion-duration-fast) var(--motion-easing-standard);
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
  private readonly bankApi = inject(BankProgramsApiService);
  private readonly modal = inject(NzModalService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected readonly types = signal<EnumerationTypeSummary[]>([]);
  protected readonly rows = signal<EnumerationRow[]>([]);
  protected readonly loadingTypes = signal(true);
  protected readonly loadingRows = signal(false);
  protected readonly selectedType = signal<string | null>(null);
  protected readonly reservedOpen = signal<boolean>(false);

  protected readonly coreTypes = computed(() =>
    this.types().filter((t) => !RESERVED_TYPES.has(t.type)),
  );
  protected readonly reservedTypes = computed(() =>
    this.types().filter((t) => RESERVED_TYPES.has(t.type)),
  );
  protected readonly banksCount = signal<number>(0);
  protected readonly bankProgramsCount = signal<number>(0);

  protected valueFilter = '';
  protected readonly valueFilterSignal = signal<string>('');
  protected readonly filteredRows = computed(() => {
    const q = this.valueFilterSignal().trim().toLowerCase();
    const all = this.rows();
    const match = (r: EnumerationRow): boolean =>
      !q ||
      r.labelEn.toLowerCase().includes(q) ||
      r.labelAr.toLowerCase().includes(q) ||
      r.key.toLowerCase().includes(q);
    const nonDeprecated = all.filter((r) => !r.deprecatedAt && match(r));
    return {
      live: nonDeprecated,
      activeCount: nonDeprecated.filter((r) => r.active).length,
      inactiveCount: nonDeprecated.filter((r) => !r.active).length,
      deprecated: all.filter((r) => !!r.deprecatedAt && match(r)),
    };
  });

  onValueFilter(value: string): void {
    this.valueFilterSignal.set(value);
  }

  clearFilter(): void {
    this.valueFilter = '';
    this.valueFilterSignal.set('');
  }

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
      {
        label: $localize`:@@lookups.stat.deprecated:Deprecated`,
        value: s.deprecated,
        tone: 'muted',
      },
    ];
  });

  async ngOnInit(): Promise<void> {
    void this.loadBankStats();
    await this.reloadTypes();
    const initial = this.route.snapshot.queryParamMap.get('type');
    const target =
      initial && this.types().some((t) => t.type === initial)
        ? initial
        : this.coreTypes()[0]?.type ?? this.types()[0]?.type ?? null;
    if (target) await this.selectType(target);
  }

  private async loadBankStats(): Promise<void> {
    try {
      const PAGE_SIZE = 100;
      const first = await this.bankApi.list({ pageSize: PAGE_SIZE, page: 1 });
      const collected = [...(first.data ?? [])];
      const total = first.pagination?.total ?? collected.length;
      const pages = Math.ceil(total / PAGE_SIZE);
      for (let p = 2; p <= pages; p++) {
        const next = await this.bankApi.list({ pageSize: PAGE_SIZE, page: p });
        collected.push(...(next.data ?? []));
      }
      this.bankProgramsCount.set(total);
      this.banksCount.set(new Set(collected.map((p) => p.bankName)).size);
    } catch {
      // Stats best-effort; leave at 0.
    }
  }

  protected labelFor(type: string): TypeMeta {
    return (
      TYPE_LABELS[type] ?? {
        en: type,
        ar: type,
        description: '',
        icon: 'unordered-list',
      }
    );
  }

  async selectType(type: string | null): Promise<void> {
    this.selectedType.set(type);
    if (type && RESERVED_TYPES.has(type)) this.reservedOpen.set(true);
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { type: type ?? null },
      queryParamsHandling: 'merge',
    });
    if (type) await this.reloadRows(type);
  }

  protected onReservedToggle(ev: Event): void {
    const t = ev.target as HTMLDetailsElement;
    this.reservedOpen.set(t.open);
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
    // Optimistic local flip — no page spinners.
    this.rows.update((rs) => rs.map((r) => (r.id === row.id ? { ...r, active: checked } : r)));
    try {
      await this.api.update(row.id, { active: checked });
      await this.reloadAfterMutation({ silent: true });
    } catch {
      // Revert on failure; toast surfaced via global error interceptor.
      this.rows.update((rs) => rs.map((r) => (r.id === row.id ? { ...r, active: !checked } : r)));
    }
  }

  async deprecate(row: EnumerationRow): Promise<void> {
    const now = new Date().toISOString();
    this.rows.update((rs) => rs.map((r) => (r.id === row.id ? { ...r, deprecatedAt: now } : r)));
    try {
      await this.api.update(row.id, { deprecate: true });
      await this.reloadAfterMutation({ silent: true });
    } catch {
      this.rows.update((rs) => rs.map((r) => (r.id === row.id ? { ...r, deprecatedAt: null } : r)));
    }
  }

  private openDialog(data: EnumerationEditDialogData): void {
    const ref = this.modal.create<EnumerationEditDialogComponent, EnumerationEditDialogData, boolean>({
      nzContent: EnumerationEditDialogComponent,
      nzData: data,
      nzTitle: data.mode === 'create' ? 'Add value' : 'Edit value',
      nzWidth: 'min(640px, calc(100vw - 48px))',
      nzFooter: null,
      nzMaskClosable: true,
    });
    ref.afterClose.subscribe((saved: boolean | undefined) => {
      if (saved) void this.reloadAfterMutation();
    });
  }

  private async reloadTypes(opts: { silent?: boolean } = {}): Promise<void> {
    if (!opts.silent) this.loadingTypes.set(true);
    try {
      this.types.set(await this.api.listTypes());
    } finally {
      if (!opts.silent) this.loadingTypes.set(false);
    }
  }

  private async reloadRows(type: string, opts: { silent?: boolean } = {}): Promise<void> {
    if (!opts.silent) this.loadingRows.set(true);
    try {
      this.rows.set(await this.api.list(type));
    } finally {
      if (!opts.silent) this.loadingRows.set(false);
    }
  }

  private async reloadAfterMutation(opts: { silent?: boolean } = {}): Promise<void> {
    const type = this.selectedType();
    await this.reloadTypes(opts);
    if (type) await this.reloadRows(type, opts);
  }
}
