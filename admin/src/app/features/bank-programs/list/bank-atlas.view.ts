import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Output,
  computed,
  input,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzDropDownModule } from 'ng-zorro-antd/dropdown';
import { NzIconModule, provideNzIconsPatch } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzSwitchModule } from 'ng-zorro-antd/switch';
import { NzToolTipModule } from 'ng-zorro-antd/tooltip';
import {
  BankOutline,
  SearchOutline,
  PlusOutline,
  EllipsisOutline,
  EditOutline,
  CopyOutline,
  DeleteOutline,
  RightOutline,
  WarningOutline,
  CheckCircleOutline,
} from '@ant-design/icons-angular/icons';
import { CanDirective } from '../../../shared/can.directive';
import { KeyChipComponent } from '@shared/ui';
import type { BankProgramListRow } from '../bank-programs.types';

interface BankGroup {
  bankName: string;
  initials: string;
  programs: BankProgramListRow[];
  activeCount: number;
  totalCount: number;
  activeRatio: number;
  categories: ReadonlyArray<{ label: string; count: number }>;
}

@Component({
  selector: 'app-bank-atlas',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    NzButtonModule,
    NzDropDownModule,
    NzIconModule,
    NzInputModule,
    NzSwitchModule,
    NzToolTipModule,
    CanDirective,
    KeyChipComponent,
  ],
  providers: [
    provideNzIconsPatch([
      BankOutline,
      SearchOutline,
      PlusOutline,
      EllipsisOutline,
      EditOutline,
      CopyOutline,
      DeleteOutline,
      RightOutline,
      WarningOutline,
      CheckCircleOutline,
    ]),
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="atlas" role="region" aria-label="Bank atlas">
      <!-- ─── Bank rail ──────────────────────────────────────────────── -->
      <aside class="rail" aria-label="Banks">
        <header class="rail-head">
          <div class="rail-title">
            <span class="rail-eyebrow">Banks</span>
            <span class="rail-count">{{ banks().length }}</span>
          </div>
          <div class="rail-search">
            <span nz-icon nzType="search" nzTheme="outline" aria-hidden="true"></span>
            <input
              type="text"
              placeholder="Filter banks…"
              [(ngModel)]="bankQuery"
              (ngModelChange)="onBankQueryChange()"
              aria-label="Filter banks"
            />
          </div>
        </header>

        @if (filteredBanks().length === 0) {
          <p class="rail-empty">No banks match.</p>
        } @else {
          <ul class="bank-list" role="listbox">
            @for (b of filteredBanks(); track b.bankName) {
              <li>
                <button
                  type="button"
                  class="bank-card"
                  [class.selected]="selected()?.bankName === b.bankName"
                  role="option"
                  [attr.aria-selected]="selected()?.bankName === b.bankName"
                  (click)="select(b)"
                >
                  <span class="bank-avatar" aria-hidden="true">{{ b.initials }}</span>
                  <span class="bank-body">
                    <span class="bank-name">{{ b.bankName }}</span>
                    <span class="bank-meta">
                      {{ b.totalCount }} {{ b.totalCount === 1 ? 'program' : 'programs' }}
                      @if (b.activeCount < b.totalCount) {
                        · {{ b.activeCount }} active
                      }
                    </span>
                    <span class="bank-bar" aria-hidden="true">
                      <span class="bank-bar-fill" [style.inline-size.%]="b.activeRatio * 100"></span>
                    </span>
                  </span>
                  <span class="bank-chevron" nz-icon nzType="right" nzTheme="outline" aria-hidden="true"></span>
                </button>
              </li>
            }
          </ul>
        }
      </aside>

      <!-- ─── Detail pane ────────────────────────────────────────────── -->
      <section class="detail" aria-label="Selected bank programs">
        @if (selected(); as b) {
          <header class="detail-head">
            <div class="detail-identity">
              <span class="detail-avatar" aria-hidden="true">{{ b.initials }}</span>
              <div class="detail-text">
                <h2 class="detail-title">{{ b.bankName }}</h2>
                <p class="detail-sub">
                  <span class="dot active" aria-hidden="true"></span>
                  {{ b.activeCount }} active
                  <span class="sep">·</span>
                  <span class="dot inactive" aria-hidden="true"></span>
                  {{ b.totalCount - b.activeCount }} inactive
                  <span class="sep">·</span>
                  {{ b.totalCount }} total
                </p>
              </div>
            </div>
            <div class="detail-actions">
              <a
                *can="['super_admin', 'sales_manager']"
                nz-button
                nzType="primary"
                [routerLink]="['/bank-programs/new']"
                [queryParams]="{ bank: b.bankName }"
              >
                <span nz-icon nzType="plus" nzTheme="outline" aria-hidden="true"></span>
                <span>Add to {{ b.bankName }}</span>
              </a>
            </div>
          </header>

          @if (b.categories.length > 1) {
            <nav class="cat-rail" aria-label="Category filter">
              <button
                type="button"
                class="cat-chip"
                [class.selected]="categoryFilter() === null"
                (click)="categoryFilter.set(null)"
              >
                All
                <span class="cat-count">{{ b.totalCount }}</span>
              </button>
              @for (c of b.categories; track c.label) {
                <button
                  type="button"
                  class="cat-chip"
                  [class.selected]="categoryFilter() === c.label"
                  (click)="categoryFilter.set(c.label)"
                >
                  {{ c.label }}
                  <span class="cat-count">{{ c.count }}</span>
                </button>
              }
            </nav>
          }

          @if (visiblePrograms().length === 0) {
            <p class="prog-empty">No programs match this filter.</p>
          } @else {
            <ul class="prog-list" role="list">
              @for (row of visiblePrograms(); track row.programCode) {
                <li class="prog-row" [class.inactive]="!row.active">
                  <a class="prog-code" [routerLink]="['/bank-programs', row.programCode]">
                    <app-key-chip [value]="row.programCode" />
                  </a>
                  <div class="prog-main">
                    <a class="prog-name" [routerLink]="['/bank-programs', row.programCode]">
                      {{ row.friendlyName }}
                      @if (row.deprecatedKeyCount > 0) {
                        <span
                          class="prog-warn"
                          nz-icon
                          nzType="warning"
                          nzTheme="outline"
                          nz-tooltip
                          nzTooltipTitle="One or more tier keys deprecated"
                          aria-hidden="true"
                        ></span>
                      }
                    </a>
                    <span class="prog-meta">
                      <span class="prog-cat">{{ row.productCategory }}</span>
                      <span class="sep">·</span>
                      <span class="prog-rate">{{ row.currentEffectiveRatePercent ?? row.baseRatePercent ?? '—' }}%</span>
                    </span>
                  </div>
                  <div class="prog-status">
                    <nz-switch
                      *can="['super_admin', 'sales_manager']"
                      [ngModel]="row.active"
                      (ngModelChange)="toggle.emit({ row, active: $event })"
                      [attr.aria-label]="row.active ? 'Deactivate' : 'Activate'"
                    ></nz-switch>
                  </div>
                  <div class="prog-actions">
                    <button
                      *can="['super_admin', 'sales_manager']"
                      nz-button
                      nzType="text"
                      nzShape="circle"
                      type="button"
                      nz-dropdown
                      [nzDropdownMenu]="rowMenu"
                      aria-label="Row actions"
                    >
                      <span nz-icon nzType="ellipsis" nzTheme="outline" aria-hidden="true"></span>
                    </button>
                    <nz-dropdown-menu #rowMenu="nzDropdownMenu">
                      <ul nz-menu>
                        <li nz-menu-item>
                          <a [routerLink]="['/bank-programs', row.programCode, 'edit']">
                            <span nz-icon nzType="edit" nzTheme="outline" aria-hidden="true"></span>
                            <span>Edit</span>
                          </a>
                        </li>
                        <li nz-menu-item (click)="clone.emit(row)">
                          <span nz-icon nzType="copy" nzTheme="outline" aria-hidden="true"></span>
                          <span>Clone</span>
                        </li>
                        <li *can="['super_admin']" nz-menu-item (click)="remove.emit(row)">
                          <span nz-icon nzType="delete" nzTheme="outline" aria-hidden="true"></span>
                          <span>Delete</span>
                        </li>
                      </ul>
                    </nz-dropdown-menu>
                  </div>
                </li>
              }
            </ul>
          }
        } @else {
          <div class="placeholder">
            <span class="placeholder-icon" nz-icon nzType="bank" nzTheme="outline" aria-hidden="true"></span>
            <p class="placeholder-text">Pick a bank from the left to manage its programs.</p>
          </div>
        }
      </section>
    </div>
  `,
  styles: [
    `
      :host { display: block; }

      .atlas {
        display: grid;
        grid-template-columns: 320px 1fr;
        gap: var(--space-5);
        align-items: start;
        min-block-size: 540px;
      }

      /* ── Rail ─────────────────────────────────────────────────────── */
      .rail {
        background: var(--bg-surface, var(--color-surface-default));
        border: 1px solid var(--border-default, var(--color-border-default));
        border-radius: var(--radius-lg);
        overflow: hidden;
        position: sticky;
        inset-block-start: var(--space-4);
      }
      .rail-head {
        padding: var(--space-4);
        border-block-end: 1px solid var(--border-subtle, var(--color-border-default));
      }
      .rail-title {
        display: flex;
        align-items: baseline;
        justify-content: space-between;
        margin-block-end: var(--space-3);
      }
      .rail-eyebrow {
        font-size: var(--text-xs);
        font-weight: var(--font-semibold, var(--font-weight-semibold));
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: var(--text-secondary, var(--color-text-secondary));
      }
      .rail-count {
        font-size: var(--text-sm);
        font-weight: var(--font-semibold, var(--font-weight-semibold));
        color: var(--text-tertiary, var(--color-text-tertiary));
      }
      .rail-search {
        position: relative;
        display: flex;
        align-items: center;
      }
      .rail-search [nz-icon] {
        position: absolute;
        inset-inline-start: var(--space-3);
        color: var(--text-tertiary, var(--color-text-tertiary));
        font-size: 16px;
      }
      .rail-search input {
        inline-size: 100%;
        padding: var(--space-2) var(--space-3);
        padding-inline-start: calc(var(--space-3) + 22px);
        border: 1px solid var(--border-default, var(--color-border-default));
        border-radius: var(--radius-md);
        background: var(--bg-base, var(--color-surface-page));
        font-size: var(--text-sm);
        color: var(--text-primary, var(--color-text-primary));
        transition: border-color var(--motion-duration-fast) var(--motion-easing-standard);
      }
      .rail-search input:focus {
        outline: none;
        border-color: var(--primary, var(--color-brand-primary));
        box-shadow: var(--shadow-focus-ring);
      }
      .rail-empty {
        padding: var(--space-5);
        color: var(--text-tertiary, var(--color-text-tertiary));
        font-size: var(--text-sm);
        margin: 0;
        text-align: center;
      }
      .bank-list {
        list-style: none;
        margin: 0;
        padding: var(--space-2);
        display: flex;
        flex-direction: column;
        gap: 2px;
        max-block-size: 64vh;
        overflow-y: auto;
      }
      .bank-card {
        position: relative;
        display: grid;
        grid-template-columns: 40px minmax(0, 1fr) 16px;
        align-items: center;
        gap: var(--space-3);
        inline-size: 100%;
        padding: var(--space-3);
        background: transparent;
        border: 1px solid transparent;
        border-radius: var(--radius-md);
        cursor: pointer;
        text-align: start;
        transition:
          background var(--motion-duration-fast) cubic-bezier(0.4, 0, 0.2, 1),
          border-color var(--motion-duration-fast) cubic-bezier(0.4, 0, 0.2, 1);
      }
      .bank-card:hover {
        background: var(--bg-subtle, var(--color-surface-row-hover));
      }
      .bank-card:focus-visible {
        outline: 2px solid var(--primary, var(--color-brand-primary));
        outline-offset: 2px;
      }
      .bank-card.selected {
        background: var(--accent-subtle, var(--color-tonal-accent-bg));
        border-color: var(--primary, var(--color-brand-primary));
      }
      .bank-card.selected::before {
        content: '';
        position: absolute;
        inset-inline-start: -1px;
        inset-block: 10px;
        inline-size: 3px;
        background: var(--primary, var(--color-brand-primary));
        border-radius: 0 var(--radius-sm) var(--radius-sm) 0;
      }
      .bank-avatar {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        inline-size: 40px;
        block-size: 40px;
        border-radius: var(--radius-md);
        background: var(--accent-subtle, var(--color-tonal-accent-bg));
        color: var(--primary, var(--color-brand-primary));
        font-weight: var(--font-bold, var(--font-weight-bold));
        font-size: var(--text-sm);
        letter-spacing: 0.02em;
      }
      .bank-card.selected .bank-avatar {
        background: var(--primary, var(--color-brand-primary));
        color: var(--text-on-primary, var(--color-text-on-brand));
      }
      .bank-body {
        display: flex;
        flex-direction: column;
        gap: 4px;
        min-inline-size: 0;
      }
      .bank-name {
        font-size: var(--text-sm);
        font-weight: var(--font-semibold, var(--font-weight-semibold));
        color: var(--text-primary, var(--color-text-primary));
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        line-height: 1.3;
      }
      .bank-meta {
        font-size: var(--text-xs);
        color: var(--text-tertiary, var(--color-text-tertiary));
        line-height: 1.3;
      }
      .bank-bar {
        position: relative;
        display: block;
        inline-size: 100%;
        block-size: 3px;
        background: var(--bg-muted, var(--color-surface-muted));
        border-radius: var(--radius-pill);
        overflow: hidden;
        margin-block-start: 2px;
      }
      .bank-bar-fill {
        position: absolute;
        inset: 0;
        inset-inline-end: auto;
        background: var(--success, var(--color-success));
        border-radius: inherit;
        transition: inline-size var(--motion-duration-base) cubic-bezier(0.4, 0, 0.2, 1);
      }
      .bank-card.selected .bank-bar-fill {
        background: var(--primary, var(--color-brand-primary));
      }
      .bank-chevron {
        color: var(--text-tertiary, var(--color-text-tertiary));
        font-size: 14px;
        opacity: 0;
        transition: opacity var(--motion-duration-fast) cubic-bezier(0.4, 0, 0.2, 1);
      }
      .bank-card:hover .bank-chevron,
      .bank-card.selected .bank-chevron {
        opacity: 1;
        color: var(--primary, var(--color-brand-primary));
      }

      /* ── Detail pane ──────────────────────────────────────────────── */
      .detail {
        background: var(--bg-surface, var(--color-surface-default));
        border: 1px solid var(--border-default, var(--color-border-default));
        border-radius: var(--radius-lg);
        overflow: hidden;
      }
      .detail-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: var(--space-4);
        padding: var(--space-5);
        border-block-end: 1px solid var(--border-default, var(--color-border-default));
        background:
          radial-gradient(circle at 0% 0%, rgba(92, 6, 50, 0.045) 0%, transparent 60%),
          var(--bg-surface, var(--color-surface-default));
      }
      .detail-identity {
        display: flex;
        align-items: center;
        gap: var(--space-3);
        min-inline-size: 0;
      }
      .detail-avatar {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        inline-size: 52px;
        block-size: 52px;
        border-radius: var(--radius-lg);
        background: var(--primary, var(--color-brand-primary));
        color: var(--text-on-primary, var(--color-text-on-brand));
        font-weight: var(--font-bold, var(--font-weight-bold));
        font-size: var(--text-lg);
        letter-spacing: 0.02em;
      }
      .detail-text { min-inline-size: 0; }
      .detail-title {
        margin: 0 0 4px;
        font-size: var(--text-2xl);
        font-weight: var(--font-bold, var(--font-weight-bold));
        color: var(--text-primary, var(--color-text-primary));
        line-height: var(--leading-tight, var(--line-height-tight));
      }
      .detail-sub {
        margin: 0;
        font-size: var(--text-sm);
        color: var(--text-secondary, var(--color-text-secondary));
        display: inline-flex;
        align-items: center;
        gap: 6px;
      }
      .detail-sub .sep { color: var(--text-tertiary, var(--color-text-tertiary)); }
      .dot {
        display: inline-block;
        inline-size: 8px;
        block-size: 8px;
        border-radius: 50%;
        margin-inline-end: 2px;
      }
      .dot.active { background: var(--success, var(--color-success)); }
      .dot.inactive { background: var(--text-muted, var(--color-text-tertiary)); }

      .cat-rail {
        display: flex;
        flex-wrap: wrap;
        gap: var(--space-2);
        padding: var(--space-3) var(--space-5);
        border-block-end: 1px solid var(--border-subtle, var(--color-border-default));
      }
      .cat-chip {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 6px var(--space-3);
        background: transparent;
        border: 1px solid var(--border-default, var(--color-border-default));
        border-radius: var(--radius-pill);
        font-size: var(--text-xs);
        font-weight: var(--font-medium, var(--font-weight-medium));
        color: var(--text-secondary, var(--color-text-secondary));
        cursor: pointer;
        transition:
          background var(--motion-duration-fast) cubic-bezier(0.4, 0, 0.2, 1),
          color var(--motion-duration-fast) cubic-bezier(0.4, 0, 0.2, 1),
          border-color var(--motion-duration-fast) cubic-bezier(0.4, 0, 0.2, 1);
      }
      .cat-chip:hover {
        border-color: var(--primary, var(--color-brand-primary));
        color: var(--primary, var(--color-brand-primary));
      }
      .cat-chip.selected {
        background: var(--primary, var(--color-brand-primary));
        border-color: var(--primary, var(--color-brand-primary));
        color: var(--text-on-primary, var(--color-text-on-brand));
      }
      .cat-count {
        padding: 0 6px;
        border-radius: var(--radius-pill);
        background: var(--bg-muted, var(--color-surface-muted));
        color: var(--text-tertiary, var(--color-text-tertiary));
        font-size: var(--text-xxs, 11px);
        font-weight: var(--font-semibold, var(--font-weight-semibold));
        line-height: 1.6;
      }
      .cat-chip.selected .cat-count {
        background: rgba(255, 255, 255, 0.18);
        color: var(--text-on-primary, var(--color-text-on-brand));
      }

      .prog-empty {
        padding: var(--space-7) var(--space-5);
        color: var(--text-tertiary, var(--color-text-tertiary));
        font-size: var(--text-sm);
        margin: 0;
        text-align: center;
      }
      .prog-list {
        list-style: none;
        margin: 0;
        padding: 0;
      }
      .prog-row {
        display: grid;
        grid-template-columns: 180px minmax(0, 1fr) auto 40px;
        align-items: center;
        gap: var(--space-4);
        padding: var(--space-3) var(--space-5);
        border-block-end: 1px solid var(--border-subtle, var(--color-border-default));
        transition: background var(--motion-duration-fast) cubic-bezier(0.4, 0, 0.2, 1);
      }
      .prog-row:last-child { border-block-end: 0; }
      .prog-row:hover { background: var(--bg-subtle, var(--color-surface-row-hover)); }
      .prog-row.inactive { opacity: 0.72; }
      .prog-code { text-decoration: none; }
      .prog-name {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        font-size: var(--text-sm);
        font-weight: var(--font-semibold, var(--font-weight-semibold));
        color: var(--text-primary, var(--color-text-primary));
        text-decoration: none;
        line-height: 1.3;
      }
      .prog-name:hover { color: var(--primary, var(--color-brand-primary)); }
      .prog-warn { color: var(--warning, var(--color-warning)); font-size: 14px; }
      .prog-meta {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        font-size: var(--text-xs);
        color: var(--text-tertiary, var(--color-text-tertiary));
        margin-block-start: 2px;
      }
      .prog-cat { text-transform: capitalize; }
      .prog-rate { font-variant-numeric: tabular-nums lining-nums; color: var(--text-secondary, var(--color-text-secondary)); font-weight: var(--font-medium, var(--font-weight-medium)); }
      .prog-status { display: inline-flex; align-items: center; }
      .prog-actions { display: inline-flex; align-items: center; justify-content: end; }

      .placeholder {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: var(--space-3);
        padding: var(--space-9) var(--space-5);
        color: var(--text-tertiary, var(--color-text-tertiary));
        text-align: center;
      }
      .placeholder-icon {
        font-size: 56px;
        color: var(--border-strong, var(--color-border-strong));
      }
      .placeholder-text {
        margin: 0;
        font-size: var(--text-sm);
        max-inline-size: 32ch;
      }

      @media (max-width: 960px) {
        .atlas {
          grid-template-columns: 1fr;
        }
        .rail { position: static; }
        .bank-list { max-block-size: 320px; }
        .prog-row {
          grid-template-columns: 1fr auto;
          row-gap: 6px;
        }
        .prog-code { grid-column: 1 / -1; }
        .prog-main { grid-column: 1 / 2; }
        .prog-status { grid-column: 2 / 3; grid-row: 2; }
        .prog-actions { grid-column: 2 / 3; grid-row: 1; }
      }

      @media (prefers-reduced-motion: reduce) {
        .bank-card,
        .bank-bar-fill,
        .bank-chevron,
        .cat-chip,
        .prog-row { transition: none; }
      }
    `,
  ],
})
export class BankAtlasView {
  readonly rows = input.required<ReadonlyArray<BankProgramListRow>>();

  @Output() readonly toggle = new EventEmitter<{ row: BankProgramListRow; active: boolean }>();
  @Output() readonly clone = new EventEmitter<BankProgramListRow>();
  @Output() readonly remove = new EventEmitter<BankProgramListRow>();

  protected bankQuery = '';
  protected readonly bankQuerySignal = signal('');
  protected readonly selectedBankName = signal<string | null>(null);
  protected readonly categoryFilter = signal<string | null>(null);

  protected readonly banks = computed<ReadonlyArray<BankGroup>>(() => {
    const map = new Map<string, BankProgramListRow[]>();
    for (const r of this.rows()) {
      const list = map.get(r.bankName) ?? [];
      list.push(r);
      map.set(r.bankName, list);
    }
    return Array.from(map.entries())
      .map(([bankName, programs]) => {
        const activeCount = programs.filter((p) => p.active).length;
        const totalCount = programs.length;
        const catMap = new Map<string, number>();
        for (const p of programs) {
          catMap.set(p.productCategory, (catMap.get(p.productCategory) ?? 0) + 1);
        }
        return {
          bankName,
          initials: this.initialsOf(bankName),
          programs,
          activeCount,
          totalCount,
          activeRatio: totalCount === 0 ? 0 : activeCount / totalCount,
          categories: Array.from(catMap.entries())
            .map(([label, count]) => ({ label, count }))
            .sort((a, b) => b.count - a.count),
        };
      })
      .sort((a, b) => b.totalCount - a.totalCount || a.bankName.localeCompare(b.bankName));
  });

  protected readonly filteredBanks = computed<ReadonlyArray<BankGroup>>(() => {
    const q = this.bankQuerySignal().trim().toLowerCase();
    const all = this.banks();
    if (!q) return all;
    return all.filter((b) => b.bankName.toLowerCase().includes(q));
  });

  protected readonly selected = computed<BankGroup | null>(() => {
    const name = this.selectedBankName();
    const all = this.banks();
    if (all.length === 0) return null;
    if (name) {
      const match = all.find((b) => b.bankName === name);
      if (match) return match;
    }
    return all[0] ?? null;
  });

  protected readonly visiblePrograms = computed<ReadonlyArray<BankProgramListRow>>(() => {
    const b = this.selected();
    if (!b) return [];
    const cat = this.categoryFilter();
    const list = cat ? b.programs.filter((p) => p.productCategory === cat) : b.programs;
    return [...list].sort((a, b2) => {
      if (a.active !== b2.active) return a.active ? -1 : 1;
      return a.friendlyName.localeCompare(b2.friendlyName);
    });
  });

  protected select(b: BankGroup): void {
    this.selectedBankName.set(b.bankName);
    this.categoryFilter.set(null);
  }

  protected onBankQueryChange(): void {
    this.bankQuerySignal.set(this.bankQuery);
  }

  private initialsOf(name: string): string {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return '?';
    if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
    return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase();
  }
}
