import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzDropDownModule } from 'ng-zorro-antd/dropdown';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzIconModule, provideNzIconsPatch } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalService } from 'ng-zorro-antd/modal';
import { NzNotificationService } from 'ng-zorro-antd/notification';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzSwitchModule } from 'ng-zorro-antd/switch';
import { NzTableModule, NzTableQueryParams } from 'ng-zorro-antd/table';
import { NzToolTipModule } from 'ng-zorro-antd/tooltip';
import {
  PlusOutline,
  SearchOutline,
  CloseOutline,
  WarningOutline,
  EllipsisOutline,
  EditOutline,
  CopyOutline,
  DeleteOutline,
  BankOutline,
  AppstoreOutline,
  UnorderedListOutline,
} from '@ant-design/icons-angular/icons';
import { BankAtlasView } from './bank-atlas.view';
import { CanDirective } from '../../../shared/can.directive';
import {
  KeyChipComponent,
  PageHeaderComponent,
  StatStripComponent,
  StatusPillComponent,
  type StatStripItem,
} from '@shared/ui';
import { ErrorCodeService } from '../../../core/errors/error-code.service';
import { BankProgramsApiService } from '../bank-programs.api.service';
import { CloneProgramDialog, type CloneProgramDialogData } from '../clone/clone-program.dialog';
import { DeleteProgramDialog, type DeleteProgramDialogData } from '../delete/delete-program.dialog';
import type { BankProgramListRow, ListBankProgramsQuery } from '../bank-programs.types';

@Component({
  selector: 'app-bank-programs-list-page',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    NzButtonModule,
    NzDropDownModule,
    NzFormModule,
    NzIconModule,
    NzInputModule,
    NzSelectModule,
    NzSpinModule,
    NzSwitchModule,
    NzTableModule,
    NzToolTipModule,
    CanDirective,
    PageHeaderComponent,
    StatStripComponent,
    StatusPillComponent,
    KeyChipComponent,
    BankAtlasView,
  ],
  providers: [
    provideNzIconsPatch([
      PlusOutline,
      SearchOutline,
      CloseOutline,
      WarningOutline,
      EllipsisOutline,
      EditOutline,
      CopyOutline,
      DeleteOutline,
      BankOutline,
      AppstoreOutline,
      UnorderedListOutline,
    ]),
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="page">
      <app-page-header [title]="titleText" [subtitle]="subtitleText">
        <div class="header-actions">
          <div class="view-toggle" role="tablist" aria-label="View mode">
            <button
              type="button"
              role="tab"
              [attr.aria-selected]="viewMode() === 'atlas'"
              [class.active]="viewMode() === 'atlas'"
              (click)="viewMode.set('atlas')"
            >
              <span nz-icon nzType="appstore" nzTheme="outline" aria-hidden="true"></span>
              <span>Atlas</span>
            </button>
            <button
              type="button"
              role="tab"
              [attr.aria-selected]="viewMode() === 'table'"
              [class.active]="viewMode() === 'table'"
              (click)="viewMode.set('table')"
            >
              <span nz-icon nzType="unordered-list" nzTheme="outline" aria-hidden="true"></span>
              <span>Table</span>
            </button>
          </div>
          <a
            *can="['super_admin', 'sales_manager']"
            nz-button
            nzType="primary"
            routerLink="/bank-programs/new"
          >
            <span nz-icon nzType="plus" nzTheme="outline" aria-hidden="true"></span>
            <span i18n="@@bank_programs.list.add">Add bank program</span>
          </a>
        </div>
      </app-page-header>

      <app-stat-strip [items]="statItems()" [ariaLabel]="statAriaLabel" />

      @if (viewMode() === 'atlas') {
        @if (loading() && rows().length === 0) {
          <div class="atlas-loading" aria-busy="true">
            <nz-spin nzSimple />
          </div>
        } @else {
          <app-bank-atlas
            [rows]="rows()"
            (toggle)="onToggle($event.row, $event.active)"
            (clone)="openClone($event)"
            (remove)="openDelete($event)"
          />
        }
      } @else {

      <div class="filters" role="search">
        <nz-form-item class="search">
          <nz-form-label
            [nzFor]="'searchInput'"
            i18n="@@bank_programs.filter.search"
            >Search</nz-form-label
          >
          <nz-form-control>
            <nz-input-group [nzPrefix]="searchPrefix">
              <input
                nz-input
                id="searchInput"
                [(ngModel)]="searchInput"
                (ngModelChange)="onSearchInput($event)"
              />
            </nz-input-group>
            <ng-template #searchPrefix>
              <span nz-icon nzType="search" nzTheme="outline" aria-hidden="true"></span>
            </ng-template>
          </nz-form-control>
        </nz-form-item>
        <nz-form-item>
          <nz-form-label [nzFor]="'bankFilter'" i18n="@@bank_programs.filter.bank"
            >Bank</nz-form-label
          >
          <nz-form-control>
            <input
              nz-input
              id="bankFilter"
              [(ngModel)]="bankFilter"
              (ngModelChange)="reload()"
            />
          </nz-form-control>
        </nz-form-item>
        <nz-form-item>
          <nz-form-label [nzFor]="'activeFilter'" i18n="@@bank_programs.filter.status"
            >Status</nz-form-label
          >
          <nz-form-control>
            <nz-select
              id="activeFilter"
              [(ngModel)]="activeFilter"
              (ngModelChange)="reload()"
              nzAllowClear
            >
              <nz-option
                [nzValue]="undefined"
                nzLabel="Any"
                i18n-nzLabel="@@bank_programs.filter.any"
              ></nz-option>
              <nz-option
                [nzValue]="true"
                nzLabel="Active"
                i18n-nzLabel="@@bank_programs.filter.active"
              ></nz-option>
              <nz-option
                [nzValue]="false"
                nzLabel="Inactive"
                i18n-nzLabel="@@bank_programs.filter.inactive"
              ></nz-option>
            </nz-select>
          </nz-form-control>
        </nz-form-item>
        <nz-form-item>
          <nz-form-label [nzFor]="'categoryFilter'" i18n="@@bank_programs.filter.category"
            >Category</nz-form-label
          >
          <nz-form-control>
            <nz-select
              id="categoryFilter"
              [(ngModel)]="categoryFilter"
              (ngModelChange)="reload()"
              nzAllowClear
            >
              <nz-option
                [nzValue]="undefined"
                nzLabel="Any"
                i18n-nzLabel="@@bank_programs.filter.any"
              ></nz-option>
              <nz-option nzValue="personal" nzLabel="Personal"></nz-option>
              <nz-option nzValue="car" nzLabel="Car"></nz-option>
              <nz-option nzValue="mortgage" nzLabel="Mortgage"></nz-option>
              <nz-option nzValue="wealth" nzLabel="Wealth"></nz-option>
              <nz-option nzValue="buyout" nzLabel="Buyout"></nz-option>
            </nz-select>
          </nz-form-control>
        </nz-form-item>
        <button nz-button type="button" (click)="clearFilters()" *ngIf="hasFilters()">
          <span nz-icon nzType="close" nzTheme="outline" aria-hidden="true"></span>
          <span i18n="@@bank_programs.filter.clear">Clear filters</span>
        </button>
      </div>

      <div class="table-wrap">
        @if (rows().length === 0 && !loading()) {
          <div class="empty-state">
            <span class="empty-icon" nz-icon nzType="bank" nzTheme="outline" aria-hidden="true"></span>
            <p class="empty-text" i18n="@@bank_programs.list.empty">
              No programs match these filters.
            </p>
            <button nz-button type="button" (click)="clearFilters()" *ngIf="hasFilters()">
              <span i18n="@@bank_programs.filter.clear">Clear filters</span>
            </button>
            <a
              nz-button
              nzType="primary"
              *can="['super_admin', 'sales_manager']"
              routerLink="/bank-programs/new"
            >
              <span i18n="@@bank_programs.list.add">Add bank program</span>
            </a>
          </div>
        } @else {
          <nz-table
            #t
            [nzData]="rows()"
            [nzLoading]="loading()"
            [nzFrontPagination]="false"
            [nzTotal]="total()"
            [nzPageSize]="pageSize()"
            [nzPageIndex]="page()"
            [nzPageSizeOptions]="[25, 50, 100]"
            [nzShowSizeChanger]="true"
            (nzQueryParams)="onQueryParams($event)"
          >
            <thead>
              <tr>
                <th i18n="@@bank_programs.col.program_code">Code</th>
                <th i18n="@@bank_programs.col.friendly_name">Friendly name</th>
                <th i18n="@@bank_programs.col.bank">Bank</th>
                <th i18n="@@bank_programs.col.category">Category</th>
                <th i18n="@@bank_programs.col.rate">Rate</th>
                <th i18n="@@bank_programs.col.status">Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              @for (row of t.data; track row.programCode) {
                <tr class="row">
                  <td>
                    <a [routerLink]="['/bank-programs', row.programCode]" class="row-link">
                      <app-key-chip [value]="row.programCode" />
                    </a>
                    <span
                      *ngIf="row.deprecatedKeyCount > 0"
                      class="deprecated-badge"
                      nz-icon
                      nzType="warning"
                      nzTheme="outline"
                      nz-tooltip
                      nzTooltipTitle="One or more tier keys have been deprecated"
                      i18n-nzTooltipTitle="@@bank_programs.col.deprecated_tip"
                      aria-hidden="true"
                    ></span>
                  </td>
                  <td>{{ row.friendlyName }}</td>
                  <td>{{ row.bankName }}</td>
                  <td>{{ row.productCategory }}</td>
                  <td class="numeric">
                    {{ row.currentEffectiveRatePercent ?? row.baseRatePercent ?? '—' }}%
                  </td>
                  <td>
                    <nz-switch
                      *can="['super_admin', 'sales_manager']"
                      [ngModel]="row.active"
                      (ngModelChange)="onToggle(row, $event)"
                    ></nz-switch>
                    <app-status-pill
                      *can="['sales_agent', 'analyst']"
                      [label]="row.active ? activeLabel() : inactiveLabel()"
                      [tone]="row.active ? 'success' : 'neutral'"
                    />
                  </td>
                  <td>
                    <button
                      *can="['super_admin', 'sales_manager']"
                      nz-button
                      nzType="text"
                      nzShape="circle"
                      type="button"
                      nz-dropdown
                      [nzDropdownMenu]="rowMenu"
                      aria-label="Row actions"
                      i18n-aria-label="@@bank_programs.col.actions_label"
                    >
                      <span nz-icon nzType="ellipsis" nzTheme="outline" aria-hidden="true"></span>
                    </button>
                    <nz-dropdown-menu #rowMenu="nzDropdownMenu">
                      <ul nz-menu>
                        <li nz-menu-item>
                          <a [routerLink]="['/bank-programs', row.programCode, 'edit']">
                            <span nz-icon nzType="edit" nzTheme="outline" aria-hidden="true"></span>
                            <span i18n="@@bank_programs.action.edit">Edit</span>
                          </a>
                        </li>
                        <li nz-menu-item (click)="openClone(row)">
                          <span nz-icon nzType="copy" nzTheme="outline" aria-hidden="true"></span>
                          <span i18n="@@bank_programs.action.clone">Clone</span>
                        </li>
                        <li *can="['super_admin']" nz-menu-item (click)="openDelete(row)">
                          <span nz-icon nzType="delete" nzTheme="outline" aria-hidden="true"></span>
                          <span i18n="@@bank_programs.action.delete">Delete</span>
                        </li>
                      </ul>
                    </nz-dropdown-menu>
                  </td>
                </tr>
              }
            </tbody>
          </nz-table>
        }
      </div>
      }
    </section>
  `,
  styles: [
    `
      :host {
        display: block;
        padding: var(--space-6);
        max-width: var(--content-max-width);
        margin-inline: auto;
      }
      .header-actions {
        display: inline-flex;
        align-items: center;
        gap: var(--space-3);
      }
      .view-toggle {
        display: inline-flex;
        padding: 3px;
        background: var(--bg-muted, var(--color-surface-muted));
        border-radius: var(--radius-pill);
        gap: 2px;
      }
      .view-toggle button {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 6px 14px;
        border-radius: var(--radius-pill);
        background: transparent;
        border: none;
        font-size: var(--text-xs);
        font-weight: var(--font-semibold, var(--font-weight-semibold));
        color: var(--text-secondary, var(--color-text-secondary));
        cursor: pointer;
        transition:
          background var(--motion-duration-fast) cubic-bezier(0.4, 0, 0.2, 1),
          color var(--motion-duration-fast) cubic-bezier(0.4, 0, 0.2, 1);
      }
      .view-toggle button:hover {
        color: var(--text-primary, var(--color-text-primary));
      }
      .view-toggle button.active {
        background: var(--bg-surface, var(--color-surface-default));
        color: var(--primary, var(--color-brand-primary));
        box-shadow: var(--shadow-sm);
      }
      .view-toggle button:focus-visible {
        outline: 2px solid var(--primary, var(--color-brand-primary));
        outline-offset: 2px;
      }
      .atlas-loading {
        display: flex;
        align-items: center;
        justify-content: center;
        padding: var(--space-9);
      }
      .filters {
        display: flex;
        flex-wrap: wrap;
        gap: var(--space-3);
        align-items: flex-end;
        margin-block-start: var(--space-5);
        margin-block-end: var(--space-4);
      }
      .filters .search {
        flex: 1 1 280px;
        min-width: 240px;
      }
      .table-wrap {
        background: var(--color-surface);
        border: 1px solid var(--color-border-default);
        border-radius: var(--radius-lg);
        overflow: hidden;
      }
      .row-link {
        color: var(--color-text-primary);
        font-weight: var(--font-weight-medium);
        text-decoration: none;
        font-variant-numeric: tabular-nums lining-nums;
      }
      .row-link:hover {
        color: var(--color-text-link);
      }
      .deprecated-badge {
        color: var(--color-warning);
        font-size: var(--text-lg);
        margin-inline-start: var(--space-1);
        vertical-align: middle;
      }
      .numeric {
        font-variant-numeric: tabular-nums lining-nums;
      }
      .status-chip {
        display: inline-block;
        padding: 2px 8px;
        border-radius: var(--radius-sm);
        font-size: var(--text-xs);
      }
      .status-chip.active {
        background: var(--color-success-bg);
        color: var(--color-success);
      }
      .status-chip.inactive {
        background: var(--color-surface-muted);
        color: var(--color-text-tertiary);
      }
      .empty-state {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: var(--space-10) var(--space-6);
        gap: var(--space-3);
        text-align: center;
        background: var(--color-surface);
        border-radius: var(--radius-lg);
      }
      .empty-icon {
        font-size: 56px;
        color: var(--color-text-tertiary);
      }
      .empty-text {
        margin: 0;
        color: var(--color-text-primary);
        font-size: var(--text-md);
      }
    `,
  ],
})
export class BankProgramsListPage implements OnInit {
  private readonly api = inject(BankProgramsApiService);
  private readonly modal = inject(NzModalService);
  private readonly message = inject(NzMessageService);
  private readonly notification = inject(NzNotificationService);
  private readonly router = inject(Router);
  private readonly errors = inject(ErrorCodeService);

  protected readonly titleText = $localize`:@@bank_programs.list.title:Bank programs`;
  protected readonly subtitleText = $localize`:@@bank_programs.list.subtitle:Configure and manage all loan programs the matching engine consumes.`;
  protected readonly statAriaLabel = $localize`:@@bank_programs.stat.aria:Program totals`;
  protected readonly statItems = computed<StatStripItem[]>(() => {
    const r = this.rows();
    const active = r.filter((p) => p.active).length;
    const inactive = r.filter((p) => !p.active).length;
    const banks = new Set(r.map((p) => p.bankName)).size;
    return [
      { label: $localize`:@@bank_programs.stat.total:Total programs`, value: this.total() },
      { label: $localize`:@@bank_programs.stat.active:Active`, value: active, tone: 'success' },
      { label: $localize`:@@bank_programs.stat.inactive:Inactive`, value: inactive, tone: 'muted' },
      { label: $localize`:@@bank_programs.stat.banks:Banks`, value: banks },
    ];
  });

  readonly rows = signal<BankProgramListRow[]>([]);
  readonly total = signal(0);
  readonly page = signal(1);
  readonly pageSize = signal(100);
  readonly loading = signal(false);
  readonly viewMode = signal<'atlas' | 'table'>('atlas');

  searchInput = '';
  private searchDebounce?: ReturnType<typeof setTimeout>;
  bankFilter?: string;
  activeFilter?: boolean;
  categoryFilter?: string;

  readonly activeLabel = signal($localize`:@@bank_programs.col.active:Active`);
  readonly inactiveLabel = signal($localize`:@@bank_programs.col.inactive:Inactive`);

  readonly hasFilters = computed(() =>
    Boolean(
      this.searchInput || this.bankFilter || this.activeFilter !== undefined || this.categoryFilter,
    ),
  );

  ngOnInit(): void {
    this.reload();
  }

  onSearchInput(_value: string): void {
    if (this.searchDebounce) clearTimeout(this.searchDebounce);
    this.searchDebounce = setTimeout(() => this.reload(), 250);
  }

  clearFilters(): void {
    this.searchInput = '';
    this.bankFilter = undefined;
    this.activeFilter = undefined;
    this.categoryFilter = undefined;
    this.reload();
  }

  onQueryParams(params: NzTableQueryParams): void {
    let changed = false;
    if (params.pageIndex !== this.page()) {
      this.page.set(params.pageIndex);
      changed = true;
    }
    if (params.pageSize !== this.pageSize()) {
      this.pageSize.set(params.pageSize);
      changed = true;
    }
    if (changed) this.reload();
  }

  async reload(): Promise<void> {
    this.loading.set(true);
    try {
      const query: ListBankProgramsQuery = {
        page: this.page(),
        pageSize: this.pageSize(),
        search: this.searchInput || undefined,
        bankName: this.bankFilter || undefined,
        active: this.activeFilter,
        productCategory: this.categoryFilter || undefined,
      };
      const res = await this.api.list(query);
      this.rows.set(res.data);
      this.total.set(res.pagination.total);
    } catch (err: unknown) {
      this.handleError(err);
    } finally {
      this.loading.set(false);
    }
  }

  openClone(row: BankProgramListRow): void {
    const ref = this.modal.create<
      CloneProgramDialog,
      CloneProgramDialogData,
      { newProgramCode?: string } | undefined
    >({
      nzContent: CloneProgramDialog,
      nzData: { sourceProgramCode: row.programCode, sourceFriendlyName: row.friendlyName },
      nzWidth: 440,
      nzFooter: null,
    });
    ref.afterClose.subscribe((res) => {
      if (res?.newProgramCode) {
        this.message.success($localize`:@@bank_programs.clone.success:Program cloned.`, {
          nzDuration: 4000,
        });
        void this.router.navigate(['/bank-programs', res.newProgramCode]);
      }
    });
  }

  openDelete(row: BankProgramListRow): void {
    const ref = this.modal.create<DeleteProgramDialog, DeleteProgramDialogData, boolean | undefined>({
      nzContent: DeleteProgramDialog,
      nzData: { programCode: row.programCode, friendlyName: row.friendlyName },
      nzWidth: 480,
      nzFooter: null,
    });
    ref.afterClose.subscribe((deleted) => {
      if (deleted) this.reload();
    });
  }

  async onToggle(row: BankProgramListRow, active: boolean): Promise<void> {
    try {
      await this.api.toggle(row.programCode, { active, version: row.version });
      this.reload();
    } catch (err: unknown) {
      this.handleError(err);
      this.reload();
    }
  }

  private handleError(err: unknown): void {
    const envelope = (err as { error?: { code?: string; meta?: Record<string, unknown> } }).error;
    const code = envelope?.code ?? 'INTERNAL_ERROR';
    this.notification.error(
      $localize`:@@bank_programs.form.dismiss:Dismiss`,
      this.errors.toLocalizedMessage(code as never, envelope?.meta),
    );
  }
}
