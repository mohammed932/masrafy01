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
import { toSignal } from '@angular/core/rxjs-interop';
import { NzIconModule, provideNzIconsPatch } from 'ng-zorro-antd/icon';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzToolTipModule } from 'ng-zorro-antd/tooltip';
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm';
import { NzModalService } from 'ng-zorro-antd/modal';
import {
  PlusOutline,
  EditOutline,
  MinusCircleOutline,
  SearchOutline,
  HistoryOutline,
  InboxOutline,
  AppstoreOutline,
  CheckCircleOutline,
  PoweroffOutline,
  SlidersOutline,
} from '@ant-design/icons-angular/icons';
import {
  PageHeaderComponent,
  StatStripComponent,
  type StatStripItem,
} from '@shared/ui';
import { LookupsApiService, type EnumerationRow } from '../lookups/lookups.api.service';
import {
  EnumerationEditDialogComponent,
  type EnumerationEditDialogData,
} from '../lookups/components/enumeration-edit.dialog';
import {
  CatalogDefaultsDialogComponent,
  type CatalogDefaultsDialogData,
} from './components/catalog-defaults.dialog';

const ENUM_TYPE = 'program_name';

/**
 * Program catalog — the CRUD board for the predefined loan program names that
 * feed the bank-program builder's "Program name" picker. Names are DATA
 * (Principle II) and CATEGORY-AGNOSTIC: one `program_name` enumeration member
 * ("Doctor Loans", "Pharmacy") is pickable under every loan category, so the
 * board is a single flat list rather than per-category lanes. Only the prefill
 * DEFAULTS behind a name are keyed per category. Super-admin only (route-guarded).
 */
@Component({
  selector: 'app-program-catalog-page',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    NzIconModule,
    NzButtonModule,
    NzInputModule,
    NzToolTipModule,
    NzPopconfirmModule,
    PageHeaderComponent,
    StatStripComponent,
  ],
  providers: [
    provideNzIconsPatch([
      PlusOutline,
      EditOutline,
      MinusCircleOutline,
      SearchOutline,
      HistoryOutline,
      InboxOutline,
      AppstoreOutline,
      CheckCircleOutline,
      PoweroffOutline,
      SlidersOutline,
    ]),
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="page">
      <app-page-header
        eyebrow="Reference data"
        i18n-eyebrow="@@program_catalog.eyebrow"
        title="Program catalog"
        i18n-title="@@program_catalog.title"
        subtitle="Curated loan program names — Doctor, Military, New Car. Pick these in the bank-program builder instead of free-typing; every name works under any loan type."
        i18n-subtitle="@@program_catalog.subtitle"
      ></app-page-header>

      @if (!loading()) {
        <app-stat-strip
          [items]="stats()"
          ariaLabel="Program catalog statistics"
          i18n-ariaLabel="@@program_catalog.stats.aria"
        />
      }

      <div class="toolbar">
        <nz-input-group [nzPrefix]="searchIcon" class="search">
          <input
            nz-input
            [formControl]="searchControl"
            placeholder="Search program names…"
            i18n-placeholder="@@program_catalog.search"
            aria-label="Search program names"
            i18n-aria-label="@@program_catalog.search"
          />
        </nz-input-group>
        <ng-template #searchIcon>
          <span nz-icon nzType="search" nzTheme="outline" aria-hidden="true"></span>
        </ng-template>
        <span class="toolbar-spacer"></span>
        <button nz-button nzType="primary" class="add-btn" (click)="add()">
          <span nz-icon nzType="plus" nzTheme="outline"></span>
          <span i18n="@@program_catalog.add">Add program</span>
        </button>
      </div>

      @if (loading()) {
        <div class="cards" aria-hidden="true">
          @for (c of skeletonCards; track c) {
            <span class="sk sk-card"></span>
          }
        </div>
      } @else if (live().length === 0 && deprecated().length === 0) {
        @if (search().trim()) {
          <div class="board-empty">
            <span nz-icon nzType="search" nzTheme="outline" aria-hidden="true"></span>
            <p i18n="@@program_catalog.no_matches">No programs match “{{ search() }}”.</p>
          </div>
        } @else {
          <div class="board-empty">
            <span nz-icon nzType="inbox" nzTheme="outline" aria-hidden="true"></span>
            <p i18n="@@program_catalog.empty">No programs here yet — add the first one.</p>
          </div>
        }
      } @else {
        <ul class="cards" role="list">
          @for (r of live(); track r.id) {
            <li class="card" [class.muted]="!r.active">
              <div class="card-main">
                <span class="name-en">{{ r.labelEn }}</span>
                <span class="name-ar" dir="rtl">{{ r.labelAr }}</span>
              </div>
              <div class="card-side">
                <span class="status" [class.inactive]="!r.active">
                  {{ r.active ? activeLabel : inactiveLabel }}
                </span>
                <div class="row-actions">
                  <button
                    class="icon-action"
                    type="button"
                    (click)="edit(r)"
                    nz-tooltip
                    nzTooltipTitle="Edit"
                    i18n-nzTooltipTitle="@@program_catalog.edit"
                    [attr.aria-label]="editLabel"
                  >
                    <span nz-icon nzType="edit" nzTheme="outline"></span>
                  </button>
                  <button
                    class="icon-action"
                    type="button"
                    [class.has-defaults]="hasDefaults(r)"
                    (click)="editDefaults(r)"
                    nz-tooltip
                    [nzTooltipTitle]="hasDefaults(r) ? defaultsSetLabel : defaultsLabel"
                    [attr.aria-label]="hasDefaults(r) ? defaultsSetLabel : defaultsLabel"
                  >
                    <span nz-icon nzType="sliders" nzTheme="outline"></span>
                  </button>
                  <button
                    class="icon-action"
                    type="button"
                    (click)="toggleActive(r, !r.active)"
                    nz-tooltip
                    [nzTooltipTitle]="r.active ? deactivateLabel : activateLabel"
                    [attr.aria-label]="r.active ? deactivateLabel : activateLabel"
                  >
                    <span nz-icon nzType="poweroff" nzTheme="outline"></span>
                  </button>
                  <button
                    class="icon-action danger"
                    type="button"
                    nz-popconfirm
                    nzPopconfirmTitle="Deprecate this program? It stops appearing in the picker."
                    i18n-nzPopconfirmTitle="@@program_catalog.deprecate.confirm"
                    nzPopconfirmPlacement="topRight"
                    (nzOnConfirm)="deprecate(r)"
                    nz-tooltip
                    nzTooltipTitle="Deprecate"
                    i18n-nzTooltipTitle="@@program_catalog.deprecate"
                    [attr.aria-label]="deprecateLabel"
                  >
                    <span nz-icon nzType="minus-circle" nzTheme="outline"></span>
                  </button>
                </div>
              </div>
            </li>
          }

          @if (deprecated().length > 0) {
            <li class="cards-divider" aria-hidden="true">
              <span nz-icon nzType="history" nzTheme="outline"></span>
              <span i18n="@@program_catalog.deprecated">Deprecated</span>
            </li>
            @for (r of deprecated(); track r.id) {
              <li class="card deprecated">
                <div class="card-main">
                  <span class="name-en">{{ r.labelEn }}</span>
                  <span class="name-ar" dir="rtl">{{ r.labelAr }}</span>
                </div>
                <div class="card-side">
                  <span class="status dep">{{ deprecatedLabel }}</span>
                  <div class="row-actions">
                    <button
                      class="icon-action"
                      type="button"
                      (click)="edit(r)"
                      nz-tooltip
                      nzTooltipTitle="Edit"
                      i18n-nzTooltipTitle="@@program_catalog.edit"
                      [attr.aria-label]="editLabel"
                    >
                      <span nz-icon nzType="edit" nzTheme="outline"></span>
                    </button>
                  </div>
                </div>
              </li>
            }
          }
        </ul>
      }
    </section>
  `,
  styles: [
    `
      :host {
        display: block;
      }
      .page {
        display: flex;
        flex-direction: column;
        gap: var(--space-5);
        padding: var(--space-6);
        max-inline-size: 1120px;
        margin-inline: auto;
      }
      .toolbar {
        display: flex;
        align-items: center;
        flex-wrap: wrap;
        gap: var(--space-3);
      }
      .search {
        max-inline-size: 420px;
        inline-size: 100%;
        flex: 1 1 240px;
      }
      .toolbar-spacer {
        flex: 1;
      }
      .add-btn [nz-icon] {
        margin-inline-end: var(--space-1);
      }
      .board-empty {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: var(--space-2);
        padding: var(--space-6);
        color: var(--color-text-tertiary);
        text-align: center;
      }
      .board-empty [nz-icon] {
        font-size: 32px;
        opacity: 0.6;
      }
      .board-empty p {
        margin: 0;
        font-size: var(--text-sm);
      }
      .sk {
        display: block;
        border-radius: var(--radius-sm);
        background: linear-gradient(
          90deg,
          var(--color-surface-elevated) 0%,
          var(--color-surface-muted) 50%,
          var(--color-surface-elevated) 100%
        );
        background-size: 200% 100%;
        animation: catalog-shimmer 1.2s ease-in-out infinite;
      }
      .sk-card {
        block-size: 64px;
        border-radius: var(--radius-md);
      }
      @keyframes catalog-shimmer {
        0% {
          background-position: 200% 0;
        }
        100% {
          background-position: -200% 0;
        }
      }
      @media (prefers-reduced-motion: reduce) {
        .sk {
          animation: none;
          background: var(--color-surface-muted);
        }
      }
      .cards {
        list-style: none;
        margin: 0;
        padding: 0;
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(268px, 1fr));
        gap: var(--space-3);
      }
      .card {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: var(--space-3);
        padding: var(--space-3) var(--space-4);
        background: var(--color-surface-elevated);
        border: 1px solid var(--color-border-default);
        border-radius: var(--radius-md);
        box-shadow: var(--shadow-sm);
        transition:
          transform var(--motion-duration-fast) var(--motion-easing-standard),
          box-shadow var(--motion-duration-fast) var(--motion-easing-standard),
          border-color var(--motion-duration-fast) var(--motion-easing-standard);
      }
      .card:hover {
        transform: translateY(-2px);
        box-shadow: var(--shadow-md);
        border-color: var(--color-brand-primary);
      }
      .card.muted {
        opacity: 0.7;
      }
      .card.deprecated {
        box-shadow: none;
        background: var(--color-surface-default);
        border-style: dashed;
      }
      .card-main {
        display: flex;
        flex-direction: column;
        gap: 2px;
        min-inline-size: 0;
      }
      .name-en {
        font-size: var(--text-base);
        font-weight: var(--font-weight-semibold);
        color: var(--color-text-primary);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .name-ar {
        font-size: var(--text-xs);
        color: var(--color-text-tertiary);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .card-side {
        display: flex;
        align-items: center;
        gap: var(--space-2);
        flex-shrink: 0;
      }
      .status {
        font-size: var(--text-xxs);
        font-weight: var(--font-weight-semibold);
        letter-spacing: 0.04em;
        text-transform: uppercase;
        padding-inline: 8px;
        padding-block: 2px;
        border-radius: var(--radius-pill);
        background: var(--color-tonal-accent-bg);
        color: var(--color-brand-primary);
        white-space: nowrap;
      }
      .status.inactive {
        background: var(--color-surface-muted);
        color: var(--color-text-tertiary);
      }
      .status.dep {
        background: color-mix(in srgb, var(--color-warning) 14%, transparent);
        color: var(--color-warning);
      }
      .row-actions {
        display: inline-flex;
        align-items: center;
        gap: 2px;
        opacity: 0;
        transition: opacity var(--motion-duration-fast) var(--motion-easing-standard);
      }
      .card:hover .row-actions,
      .card:focus-within .row-actions {
        opacity: 1;
      }
      .icon-action {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        inline-size: 30px;
        block-size: 30px;
        border: none;
        border-radius: var(--radius-sm);
        background: transparent;
        color: var(--color-text-secondary);
        cursor: pointer;
        transition:
          background var(--motion-duration-fast) var(--motion-easing-standard),
          color var(--motion-duration-fast) var(--motion-easing-standard);
      }
      .icon-action:hover {
        background: var(--color-surface-row-hover);
        color: var(--color-text-primary);
      }
      .icon-action.danger:hover {
        color: var(--color-error);
      }
      /* Tinted only when this program actually contributes prefill, so the board
         shows at a glance which archetypes are configured. */
      .icon-action.has-defaults {
        color: var(--color-info);
        background: var(--color-info-bg);
      }
      .icon-action:active {
        background: var(--color-tonal-accent-bg);
      }
      .icon-action:focus-visible {
        outline: 2px solid var(--color-brand-primary);
        outline-offset: 1px;
      }
      .cards-divider {
        grid-column: 1 / -1;
        display: flex;
        align-items: center;
        gap: var(--space-2);
        margin-block-start: var(--space-2);
        font-size: var(--text-xxs);
        font-weight: var(--font-weight-semibold);
        letter-spacing: 0.06em;
        text-transform: uppercase;
        color: var(--color-text-tertiary);
      }
      @media (hover: none) {
        .row-actions {
          opacity: 1;
        }
        .icon-action {
          inline-size: 40px;
          block-size: 40px;
        }
      }
      @media (prefers-reduced-motion: reduce) {
        .card,
        .row-actions {
          transition: none;
        }
        .card:hover {
          transform: none;
        }
      }
      @media (max-width: 720px) {
        .page {
          padding: var(--space-4);
        }
        .cards {
          grid-template-columns: 1fr;
        }
      }
    `,
  ],
})
export class ProgramCatalogPage implements OnInit {
  private readonly api = inject(LookupsApiService);
  private readonly modal = inject(NzModalService);

  protected readonly loading = signal(true);
  private readonly rows = signal<EnumerationRow[]>([]);

  /** Fixed-length placeholders for the shape-matched loading skeleton. */
  protected readonly skeletonCards = [0, 1, 2, 3, 4, 5];

  protected readonly searchControl = new FormControl<string>('', { nonNullable: true });
  protected readonly search = toSignal(this.searchControl.valueChanges, { initialValue: '' });

  // Localized action labels reused across tooltips + aria.
  protected readonly activeLabel = $localize`:@@program_catalog.status.active:Active`;
  protected readonly inactiveLabel = $localize`:@@program_catalog.status.inactive:Inactive`;
  protected readonly deprecatedLabel = $localize`:@@program_catalog.status.deprecated:Deprecated`;
  protected readonly editLabel = $localize`:@@program_catalog.edit:Edit`;
  protected readonly activateLabel = $localize`:@@program_catalog.activate:Activate`;
  protected readonly deactivateLabel = $localize`:@@program_catalog.deactivate:Deactivate`;
  protected readonly deprecateLabel = $localize`:@@program_catalog.deprecate:Deprecate`;
  protected readonly defaultsLabel = $localize`:@@program_catalog.defaults:Set default lending values`;
  protected readonly defaultsSetLabel = $localize`:@@program_catalog.defaults.set:Edit default lending values (set)`;

  /** Search-filtered rows — one flat list, since a program name belongs to no
   *  single loan type. Deprecated names sit in their own tail section. */
  private readonly filtered = computed<EnumerationRow[]>(() => {
    const q = this.search().trim().toLowerCase();
    if (!q) return this.rows();
    return this.rows().filter(
      (r) =>
        r.labelEn.toLowerCase().includes(q) ||
        r.labelAr.toLowerCase().includes(q) ||
        r.key.toLowerCase().includes(q),
    );
  });

  protected readonly live = computed(() => this.filtered().filter((r) => !r.deprecatedAt));
  protected readonly deprecated = computed(() => this.filtered().filter((r) => r.deprecatedAt));

  protected readonly stats = computed<StatStripItem[]>(() => {
    const all = this.rows();
    const active = all.filter((r) => r.active && !r.deprecatedAt).length;
    const deprecated = all.filter((r) => r.deprecatedAt).length;
    return [
      {
        label: $localize`:@@program_catalog.stat.total:Programs`,
        value: all.length,
        icon: 'appstore',
        hint: $localize`:@@program_catalog.stat.total.hint:across all loan types`,
      },
      {
        label: $localize`:@@program_catalog.stat.active:Active`,
        value: active,
        tone: 'success',
        icon: 'check-circle',
      },
      {
        label: $localize`:@@program_catalog.stat.deprecated:Deprecated`,
        value: deprecated,
        tone: 'warning',
        icon: 'history',
      },
    ];
  });

  ngOnInit(): void {
    void this.reload();
  }

  add(): void {
    this.openDialog({ mode: 'create', type: ENUM_TYPE });
  }

  edit(row: EnumerationRow): void {
    this.openDialog({ mode: 'edit', type: ENUM_TYPE, row });
  }

  /** True once this predefined program contributes prefill for at least one category. */
  hasDefaults(row: EnumerationRow): boolean {
    return Object.keys(row.defaults ?? {}).length > 0;
  }

  /**
   * Per-category default lending values (FR-001). Prefill only — saved bank
   * programs are never touched by an edit here (FR-007 / SC-008).
   */
  editDefaults(row: EnumerationRow): void {
    const ref = this.modal.create<
      CatalogDefaultsDialogComponent,
      CatalogDefaultsDialogData,
      boolean
    >({
      nzContent: CatalogDefaultsDialogComponent,
      nzData: {
        key: row.key,
        labelEn: row.labelEn,
        labelAr: row.labelAr,
      },
      nzWidth: 'min(760px, calc(100vw - 48px))',
      nzFooter: null,
      nzMaskClosable: false,
    });
    ref.afterClose.subscribe((saved: boolean | undefined) => {
      if (saved) void this.reload({ silent: true });
    });
  }

  async toggleActive(row: EnumerationRow, next: boolean): Promise<void> {
    this.patchRow(row.id, { active: next });
    try {
      await this.api.update(row.id, { active: next });
    } catch {
      this.patchRow(row.id, { active: !next });
    }
  }

  async deprecate(row: EnumerationRow): Promise<void> {
    const stampedAt = new Date().toISOString();
    this.patchRow(row.id, { deprecatedAt: stampedAt, active: false });
    try {
      await this.api.update(row.id, { deprecate: true });
    } catch {
      this.patchRow(row.id, { deprecatedAt: null });
    }
  }

  private patchRow(id: string, patch: Partial<EnumerationRow>): void {
    this.rows.update((list) => list.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  private openDialog(data: EnumerationEditDialogData): void {
    const ref = this.modal.create<EnumerationEditDialogComponent, EnumerationEditDialogData, boolean>(
      {
        nzContent: EnumerationEditDialogComponent,
        nzData: data,
        nzTitle:
          data.mode === 'create'
            ? $localize`:@@program_catalog.dialog.add:Add program name`
            : $localize`:@@program_catalog.dialog.edit:Edit program name`,
        nzWidth: 'min(640px, calc(100vw - 48px))',
        nzFooter: null,
        nzMaskClosable: true,
      },
    );
    ref.afterClose.subscribe((saved: boolean | undefined) => {
      if (saved) void this.reload({ silent: true });
    });
  }

  /** Silent reload keeps the board on screen (no skeleton flash) after a save. */
  private async reload(opts: { silent?: boolean } = {}): Promise<void> {
    if (!opts.silent) this.loading.set(true);
    try {
      this.rows.set(await this.api.list(ENUM_TYPE));
    } finally {
      if (!opts.silent) this.loading.set(false);
    }
  }
}
