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
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatMenuModule } from '@angular/material/menu';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
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
import { CloneProgramDialog } from '../clone/clone-program.dialog';
import { DeleteProgramDialog } from '../delete/delete-program.dialog';
import type { BankProgramListRow, ListBankProgramsQuery } from '../bank-programs.types';

@Component({
  selector: 'app-bank-programs-list-page',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    MatButtonModule,
    MatChipsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatMenuModule,
    MatPaginatorModule,
    MatProgressSpinnerModule,
    MatSelectModule,
    MatSlideToggleModule,
    MatTableModule,
    MatTooltipModule,
    CanDirective,
    PageHeaderComponent,
    StatStripComponent,
    StatusPillComponent,
    KeyChipComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="page">
      <app-page-header [title]="titleText" [subtitle]="subtitleText">
        <a
          *can="['super_admin', 'sales_manager']"
          mat-flat-button
          color="primary"
          routerLink="/bank-programs/new"
        >
          <mat-icon aria-hidden="true">add</mat-icon>
          <span i18n="@@bank_programs.list.add">Add bank program</span>
        </a>
      </app-page-header>

      <app-stat-strip [items]="statItems()" [ariaLabel]="statAriaLabel" />

      <div class="filters" role="search">
        <mat-form-field appearance="outline" class="search">
          <mat-label i18n="@@bank_programs.filter.search">Search</mat-label>
          <input matInput [(ngModel)]="searchInput" (ngModelChange)="onSearchInput($event)" />
          <mat-icon matPrefix aria-hidden="true">search</mat-icon>
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label i18n="@@bank_programs.filter.bank">Bank</mat-label>
          <input matInput [(ngModel)]="bankFilter" (ngModelChange)="reload()" />
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label i18n="@@bank_programs.filter.status">Status</mat-label>
          <mat-select [(ngModel)]="activeFilter" (ngModelChange)="reload()">
            <mat-option [value]="undefined" i18n="@@bank_programs.filter.any">Any</mat-option>
            <mat-option [value]="true" i18n="@@bank_programs.filter.active">Active</mat-option>
            <mat-option [value]="false" i18n="@@bank_programs.filter.inactive">Inactive</mat-option>
          </mat-select>
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label i18n="@@bank_programs.filter.category">Category</mat-label>
          <mat-select [(ngModel)]="categoryFilter" (ngModelChange)="reload()">
            <mat-option [value]="undefined" i18n="@@bank_programs.filter.any">Any</mat-option>
            <mat-option value="personal">Personal</mat-option>
            <mat-option value="car">Car</mat-option>
            <mat-option value="mortgage">Mortgage</mat-option>
            <mat-option value="wealth">Wealth</mat-option>
            <mat-option value="buyout">Buyout</mat-option>
          </mat-select>
        </mat-form-field>
        <button mat-stroked-button type="button" (click)="clearFilters()" *ngIf="hasFilters()">
          <mat-icon aria-hidden="true">clear</mat-icon>
          <span i18n="@@bank_programs.filter.clear">Clear filters</span>
        </button>
      </div>

      <div class="table-wrap" *ngIf="!loading(); else loadingTpl">
        <table mat-table [dataSource]="rows()" *ngIf="rows().length > 0; else emptyTpl">
          <ng-container matColumnDef="programCode">
            <th mat-header-cell *matHeaderCellDef i18n="@@bank_programs.col.program_code">Code</th>
            <td mat-cell *matCellDef="let row">
              <a [routerLink]="['/bank-programs', row.programCode]" class="row-link">
                <app-key-chip [value]="row.programCode" />
              </a>
              <mat-icon
                *ngIf="row.deprecatedKeyCount > 0"
                class="deprecated-badge"
                matTooltip="One or more tier keys have been deprecated"
                i18n-matTooltip="@@bank_programs.col.deprecated_tip"
                >warning</mat-icon
              >
            </td>
          </ng-container>
          <ng-container matColumnDef="friendlyName">
            <th mat-header-cell *matHeaderCellDef i18n="@@bank_programs.col.friendly_name">
              Friendly name
            </th>
            <td mat-cell *matCellDef="let row">{{ row.friendlyName }}</td>
          </ng-container>
          <ng-container matColumnDef="bankName">
            <th mat-header-cell *matHeaderCellDef i18n="@@bank_programs.col.bank">Bank</th>
            <td mat-cell *matCellDef="let row">{{ row.bankName }}</td>
          </ng-container>
          <ng-container matColumnDef="productCategory">
            <th mat-header-cell *matHeaderCellDef i18n="@@bank_programs.col.category">Category</th>
            <td mat-cell *matCellDef="let row">{{ row.productCategory }}</td>
          </ng-container>
          <ng-container matColumnDef="rate">
            <th mat-header-cell *matHeaderCellDef i18n="@@bank_programs.col.rate">Rate</th>
            <td mat-cell *matCellDef="let row" class="numeric">
              {{ row.currentEffectiveRatePercent ?? row.baseRatePercent ?? '—' }}%
            </td>
          </ng-container>
          <ng-container matColumnDef="active">
            <th mat-header-cell *matHeaderCellDef i18n="@@bank_programs.col.status">Status</th>
            <td mat-cell *matCellDef="let row">
              <mat-slide-toggle
                *can="['super_admin', 'sales_manager']"
                [checked]="row.active"
                (change)="onToggle(row, $event.checked)"
              ></mat-slide-toggle>
              <app-status-pill
                *can="['sales_agent', 'analyst']"
                [label]="row.active ? activeLabel() : inactiveLabel()"
                [tone]="row.active ? 'success' : 'neutral'"
              />
            </td>
          </ng-container>
          <ng-container matColumnDef="actions">
            <th mat-header-cell *matHeaderCellDef></th>
            <td mat-cell *matCellDef="let row">
              <button
                *can="['super_admin', 'sales_manager']"
                mat-icon-button
                [matMenuTriggerFor]="menu"
                type="button"
                aria-label="Row actions"
                i18n-aria-label="@@bank_programs.col.actions_label"
              >
                <mat-icon>more_vert</mat-icon>
              </button>
              <mat-menu #menu="matMenu">
                <a mat-menu-item [routerLink]="['/bank-programs', row.programCode, 'edit']">
                  <mat-icon>edit</mat-icon>
                  <span i18n="@@bank_programs.action.edit">Edit</span>
                </a>
                <button mat-menu-item (click)="openClone(row)">
                  <mat-icon>content_copy</mat-icon>
                  <span i18n="@@bank_programs.action.clone">Clone</span>
                </button>
                <button *can="['super_admin']" mat-menu-item (click)="openDelete(row)">
                  <mat-icon>delete</mat-icon>
                  <span i18n="@@bank_programs.action.delete">Delete</span>
                </button>
              </mat-menu>
            </td>
          </ng-container>

          <tr mat-header-row *matHeaderRowDef="cols"></tr>
          <tr mat-row *matRowDef="let row; columns: cols" class="row"></tr>
        </table>

        <mat-paginator
          [length]="total()"
          [pageSize]="pageSize()"
          [pageIndex]="page() - 1"
          [pageSizeOptions]="[25, 50, 100]"
          (page)="onPage($event)"
        ></mat-paginator>
      </div>

      <ng-template #loadingTpl>
        <div class="loading"><mat-spinner diameter="32"></mat-spinner></div>
      </ng-template>
      <ng-template #emptyTpl>
        <div class="empty-state">
          <mat-icon class="empty-icon" aria-hidden="true">account_balance</mat-icon>
          <p class="empty-text" i18n="@@bank_programs.list.empty">
            No programs match these filters.
          </p>
          <button mat-stroked-button type="button" (click)="clearFilters()" *ngIf="hasFilters()">
            <span i18n="@@bank_programs.filter.clear">Clear filters</span>
          </button>
          <a
            mat-flat-button
            color="primary"
            *can="['super_admin', 'sales_manager']"
            routerLink="/bank-programs/new"
          >
            <span i18n="@@bank_programs.list.add">Add bank program</span>
          </a>
        </div>
      </ng-template>
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
      .filters {
        display: flex;
        flex-wrap: wrap;
        gap: var(--space-3);
        align-items: flex-end;
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
      table {
        width: 100%;
      }
      th.mat-mdc-header-cell,
      td.mat-mdc-cell {
        font-size: var(--text-sm);
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
        color: #b45309;
        font-size: 18px;
        width: 18px;
        height: 18px;
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
        background: #ecfdf5;
        color: #047857;
      }
      .status-chip.inactive {
        background: #f1f5f9;
        color: var(--color-text-tertiary);
      }
      .loading {
        display: flex;
        justify-content: center;
        padding: var(--space-8);
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
        border: 1px solid var(--color-border-default);
        border-radius: var(--radius-lg);
      }
      .empty-icon {
        font-size: 56px;
        width: 56px;
        height: 56px;
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
  private readonly dialog = inject(MatDialog);
  private readonly snack = inject(MatSnackBar);
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

  readonly cols = [
    'programCode',
    'friendlyName',
    'bankName',
    'productCategory',
    'rate',
    'active',
    'actions',
  ];

  readonly rows = signal<BankProgramListRow[]>([]);
  readonly total = signal(0);
  readonly page = signal(1);
  readonly pageSize = signal(25);
  readonly loading = signal(false);

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

  onPage(e: PageEvent): void {
    this.page.set(e.pageIndex + 1);
    this.pageSize.set(e.pageSize);
    this.reload();
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
    const ref = this.dialog.open(CloneProgramDialog, {
      data: { sourceProgramCode: row.programCode, sourceFriendlyName: row.friendlyName },
      width: '440px',
      maxWidth: '95vw',
    });
    ref.afterClosed().subscribe((res) => {
      if (res?.newProgramCode) {
        this.snack.open(
          $localize`:@@bank_programs.clone.success:Program cloned.`,
          $localize`:@@bank_programs.form.dismiss:Dismiss`,
          { duration: 4000 },
        );
        void this.router.navigate(['/bank-programs', res.newProgramCode]);
      }
    });
  }

  openDelete(row: BankProgramListRow): void {
    const ref = this.dialog.open(DeleteProgramDialog, {
      data: { programCode: row.programCode, friendlyName: row.friendlyName },
      width: '480px',
      maxWidth: '95vw',
    });
    ref.afterClosed().subscribe((deleted) => {
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
    this.snack.open(
      this.errors.toLocalizedMessage(code as never, envelope?.meta),
      $localize`:@@bank_programs.form.dismiss:Dismiss`,
      { duration: 6000 },
    );
  }
}
