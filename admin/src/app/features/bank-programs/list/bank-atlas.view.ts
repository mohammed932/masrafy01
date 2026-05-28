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
import { FormControl, ReactiveFormsModule } from '@angular/forms';
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
    ReactiveFormsModule,
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
      <!-- ─── Horizontal bank strip ─────────────────────────────────── -->
      <header class="strip">
        <div class="strip-head">
          <span class="strip-eyebrow">Banks · {{ banks().length }}</span>
          <div class="strip-search">
            <span nz-icon nzType="search" nzTheme="outline" aria-hidden="true"></span>
            <input
              type="text"
              placeholder="Filter banks…"
              [formControl]="bankQueryControl"
              aria-label="Filter banks"
            />
          </div>
        </div>
        @if (filteredBanks().length === 0) {
          <p class="rail-empty">No banks match.</p>
        } @else {
          <ul class="bank-strip" role="tablist">
            @for (b of filteredBanks(); track b.bankName) {
              <li>
                <button
                  type="button"
                  class="bank-tab"
                  [class.selected]="selected()?.bankName === b.bankName"
                  role="tab"
                  [attr.aria-selected]="selected()?.bankName === b.bankName"
                  (click)="select(b)"
                >
                  <span class="bank-avatar" aria-hidden="true">{{ b.initials }}</span>
                  <span class="bank-body">
                    <span class="bank-name">{{ b.bankName }}</span>
                  </span>
                </button>
              </li>
            }
          </ul>
        }
      </header>

      <!-- ─── Detail pane (full width) ──────────────────────────────── -->
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
                  <div class="prog-main">
                    <a class="prog-name" [routerLink]="['/bank-programs', row.programCode]">
                      <span class="prog-name-text">{{ row.friendlyName }}</span>
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
                    </span>
                  </div>
                  <div class="prog-rate-col">
                    <span class="prog-rate">{{ row.currentEffectiveRatePercent ?? row.baseRatePercent ?? '—' }}</span>
                    <span class="prog-rate-unit">%</span>
                  </div>
                  <div class="prog-status">
                    <nz-switch
                      *can="['super_admin', 'sales_manager']"
                      [formControl]="rowActiveControl(row)"
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
        display: flex;
        flex-direction: column;
        gap: var(--space-4);
        min-block-size: 540px;
        max-inline-size: 100%;
      }

      /* ── Bank strip (horizontal) ──────────────────────────────────── */
      .strip {
        background: var(--bg-surface, var(--color-surface-default));
        border: 1px solid var(--border-default, var(--color-border-default));
        border-radius: var(--radius-lg);
        padding: var(--space-3) var(--space-4) var(--space-2);
        display: flex;
        flex-direction: column;
        gap: var(--space-3);
      }
      .strip-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: var(--space-3);
      }
      .strip-eyebrow {
        font-size: var(--text-xs);
        font-weight: 700;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: var(--text-secondary, var(--color-text-secondary));
      }
      .strip-search {
        position: relative;
        display: flex;
        align-items: center;
        inline-size: 280px;
        max-inline-size: 50vw;
      }
      .strip-search [nz-icon] {
        position: absolute;
        inset-inline-start: var(--space-3);
        color: var(--text-tertiary, var(--color-text-tertiary));
        font-size: 14px;
      }
      .strip-search input {
        inline-size: 100%;
        padding: 6px var(--space-3);
        padding-inline-start: calc(var(--space-3) + 20px);
        border: 1px solid var(--border-default, var(--color-border-default));
        border-radius: var(--radius-pill);
        background: var(--bg-base, var(--color-surface-page));
        font-size: var(--text-xs);
        color: var(--text-primary, var(--color-text-primary));
      }
      .strip-search input:focus {
        outline: none;
        border-color: var(--primary, var(--color-brand-primary));
        box-shadow: 0 0 0 3px rgba(8, 105, 195, 0.15);
      }
      .rail-empty {
        padding: var(--space-4);
        margin: 0;
        color: var(--text-tertiary, var(--color-text-tertiary));
        font-size: var(--text-sm);
        text-align: center;
      }
      .bank-strip {
        list-style: none;
        margin: 0;
        padding: 0 0 var(--space-1);
        display: flex;
        gap: var(--space-2);
        overflow-x: auto;
        scrollbar-width: thin;
      }
      .bank-strip::-webkit-scrollbar { block-size: 6px; }
      .bank-strip::-webkit-scrollbar-thumb {
        background: var(--border-default, var(--color-border-default));
        border-radius: var(--radius-pill);
      }
      .bank-tab {
        flex: 0 0 auto;
        display: inline-flex;
        align-items: center;
        gap: var(--space-2);
        padding: 6px 10px 6px 6px;
        background: var(--bg-base, var(--color-surface-page));
        border: 1px solid var(--border-default, var(--color-border-default));
        border-radius: var(--radius-pill);
        cursor: pointer;
        transition:
          background var(--motion-duration-fast) cubic-bezier(0.4, 0, 0.2, 1),
          border-color var(--motion-duration-fast) cubic-bezier(0.4, 0, 0.2, 1);
      }
      .bank-tab:hover {
        border-color: var(--primary, var(--color-brand-primary));
        background: var(--bg-subtle, var(--color-surface-row-hover));
      }
      .bank-tab:focus-visible {
        outline: 2px solid var(--primary, var(--color-brand-primary));
        outline-offset: 2px;
      }
      .bank-tab.selected {
        background: var(--accent-subtle, var(--color-tonal-accent-bg));
        border-color: var(--primary, var(--color-brand-primary));
      }
      .bank-avatar {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        inline-size: 30px;
        block-size: 30px;
        border-radius: 50%;
        background: var(--accent-subtle, var(--color-tonal-accent-bg));
        color: var(--primary, var(--color-brand-primary));
        font-weight: 700;
        font-size: 11px;
        letter-spacing: 0.02em;
        flex-shrink: 0;
      }
      .bank-tab.selected .bank-avatar {
        background: var(--primary, var(--color-brand-primary));
        color: var(--text-on-primary, var(--color-text-on-brand));
      }
      .bank-body {
        display: flex;
        flex-direction: column;
        gap: 1px;
        min-inline-size: 0;
      }
      .bank-name {
        font-size: 13px;
        font-weight: 600;
        color: var(--text-primary, var(--color-text-primary));
        white-space: nowrap;
        line-height: 1.2;
      }
      .bank-meta {
        font-size: 10px;
        color: var(--text-tertiary, var(--color-text-tertiary));
        line-height: 1.2;
        font-variant-numeric: tabular-nums;
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
        flex-wrap: wrap;
        gap: var(--space-3) var(--space-4);
        padding: var(--space-5);
        border-block-end: 1px solid var(--border-default, var(--color-border-default));
        background:
          radial-gradient(circle at 0% 0%, rgba(8, 105, 195, 0.045) 0%, transparent 60%),
          var(--bg-surface, var(--color-surface-default));
      }
      .detail-identity { flex: 1 1 240px; }
      .detail-actions { flex: 0 0 auto; }
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
        grid-template-columns: minmax(0, 1fr) 96px 56px 40px;
        align-items: center;
        column-gap: var(--space-4);
        padding: var(--space-3) var(--space-5);
        border-block-end: 1px solid var(--border-subtle, var(--color-border-default));
        transition: background var(--motion-duration-fast) cubic-bezier(0.4, 0, 0.2, 1);
      }
      .prog-row:last-child { border-block-end: 0; }
      .prog-row:hover { background: var(--bg-subtle, var(--color-surface-row-hover)); }
      .prog-row.inactive { opacity: 0.72; }
      .prog-code { text-decoration: none; }
      .prog-main {
        display: flex;
        flex-direction: column;
        gap: 4px;
        min-inline-size: 0;
      }
      .prog-name {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        font-size: var(--text-sm);
        font-weight: var(--font-semibold, var(--font-weight-semibold));
        color: var(--text-primary, var(--color-text-primary));
        text-decoration: none;
        line-height: 1.3;
        min-inline-size: 0;
      }
      .prog-name-text {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        min-inline-size: 0;
      }
      .prog-name:hover .prog-name-text { color: var(--primary, var(--color-brand-primary)); }
      .prog-warn { color: var(--warning, var(--color-warning)); font-size: 14px; flex-shrink: 0; }
      .prog-meta {
        display: inline-flex;
        align-items: center;
        font-size: var(--text-xs);
      }
      .prog-cat {
        display: inline-flex;
        align-items: center;
        padding: 2px 8px;
        background: var(--bg-muted, var(--color-surface-muted));
        border-radius: var(--radius-pill);
        font-size: 11px;
        font-weight: 600;
        letter-spacing: 0.02em;
        color: var(--text-secondary, var(--color-text-secondary));
        text-transform: capitalize;
      }
      .prog-rate-col {
        display: inline-flex;
        align-items: baseline;
        justify-content: flex-end;
        gap: 2px;
        font-variant-numeric: tabular-nums lining-nums;
      }
      .prog-rate {
        font-size: var(--text-sm);
        font-weight: 700;
        color: var(--text-primary, var(--color-text-primary));
        letter-spacing: -0.01em;
      }
      .prog-rate-unit {
        font-size: 11px;
        font-weight: 600;
        color: var(--text-tertiary, var(--color-text-tertiary));
      }
      .prog-status { display: inline-flex; align-items: center; justify-content: center; }
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

      @media (max-width: 1100px) {
        .prog-row {
          grid-template-columns: minmax(0, 1fr) 80px 44px 36px;
          column-gap: var(--space-3);
          padding-inline: var(--space-4);
        }
      }
      @media (max-width: 960px) {
        .strip-search { inline-size: 200px; }
        .prog-row {
          grid-template-columns: minmax(0, 1fr) auto auto;
          row-gap: 6px;
          column-gap: var(--space-3);
        }
        .prog-main { grid-column: 1 / -1; }
        .prog-rate-col { grid-column: 1 / 2; grid-row: 2; justify-content: flex-start; }
        .prog-status { grid-column: 2 / 3; grid-row: 2; }
        .prog-actions { grid-column: 3 / 4; grid-row: 2; }
      }

      @media (prefers-reduced-motion: reduce) {
        .bank-tab,
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

  protected readonly bankQueryControl = new FormControl<string>('', { nonNullable: true });
  protected readonly bankQuerySignal = signal('');
  protected readonly selectedBankName = signal<string | null>(null);
  protected readonly categoryFilter = signal<string | null>(null);
  private readonly rowActiveControls = new Map<string, FormControl<boolean>>();

  constructor() {
    this.bankQueryControl.valueChanges.subscribe((v) => this.bankQuerySignal.set(v));
  }

  protected rowActiveControl(row: BankProgramListRow): FormControl<boolean> {
    let ctrl = this.rowActiveControls.get(row.programCode);
    if (!ctrl) {
      ctrl = new FormControl<boolean>(row.active, { nonNullable: true });
      this.rowActiveControls.set(row.programCode, ctrl);
      ctrl.valueChanges.subscribe((next) => {
        if (next !== row.active) this.toggle.emit({ row, active: next });
      });
    } else if (ctrl.value !== row.active) {
      ctrl.setValue(row.active, { emitEvent: false });
    }
    return ctrl;
  }

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
    // Stable sort by programCode — never reorder on active-toggle (prevents visual
    // illusion that the toggle hit the wrong row when rows jump position).
    return [...list].sort((a, b2) => a.programCode.localeCompare(b2.programCode));
  });

  protected select(b: BankGroup): void {
    this.selectedBankName.set(b.bankName);
    this.categoryFilter.set(null);
  }

  private initialsOf(name: string): string {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return '?';
    if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
    return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase();
  }
}
