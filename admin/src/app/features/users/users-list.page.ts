import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatPaginatorModule, type PageEvent } from '@angular/material/paginator';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTableModule } from '@angular/material/table';
import { UsersService } from './users.service';
import { UserFormDialog, type UserFormDialogData } from './user-form.dialog';
import { ResetPasswordDialog } from './reset-password.dialog';
import { ErrorCodeService } from '@core/errors/error-code.service';
import { EmptyStateComponent } from '@shared/empty-state.component';
import { RelativeTimePipe } from '@shared/relative-time.pipe';
import {
  PageHeaderComponent,
  SkeletonRowsComponent,
  StatStripComponent,
  StatusPillComponent,
  type StatStripItem,
} from '@shared/ui';
import type { ErrorCode, ErrorEnvelope, StaffAccountSummary } from '@core/auth/auth.types';

@Component({
  selector: 'app-users-list-page',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatChipsModule,
    MatDialogModule,
    MatIconModule,
    MatMenuModule,
    MatPaginatorModule,
    MatProgressBarModule,
    MatTableModule,
    EmptyStateComponent,
    RelativeTimePipe,
    PageHeaderComponent,
    StatStripComponent,
    StatusPillComponent,
    SkeletonRowsComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="page">
      <app-page-header [title]="titleText" [subtitle]="subtitleText()">
        <button mat-flat-button color="primary" (click)="openCreate()">
          <mat-icon>person_add</mat-icon>
          <span i18n="@@users.create">Create user</span>
        </button>
      </app-page-header>

      <app-stat-strip [items]="statItems()" [ariaLabel]="statAriaLabel" />

      <div class="table-panel">
        @if (loading()) {
          <app-skeleton-rows [rows]="5" [cols]="[2, 1, 1, 1, 1]" />
        }

        <table mat-table [dataSource]="rows()" class="users-table" aria-label="Staff accounts">
          <ng-container matColumnDef="identity">
            <th mat-header-cell *matHeaderCellDef i18n="@@users.col.name">Name</th>
            <td mat-cell *matCellDef="let row">
              <div class="identity">
                <span class="avatar" [attr.data-role]="row.role" aria-hidden="true">{{
                  initials(row.name)
                }}</span>
                <div class="identity-text">
                  <span class="identity-name">{{ row.name }}</span>
                  <span class="identity-email">{{ row.email }}</span>
                </div>
              </div>
            </td>
          </ng-container>

          <ng-container matColumnDef="role">
            <th mat-header-cell *matHeaderCellDef i18n="@@users.col.role">Role</th>
            <td mat-cell *matCellDef="let row">
              <mat-chip
                class="role-chip"
                [class.role-super]="row.role === 'super_admin'"
                [class.role-manager]="row.role === 'sales_manager'"
                [class.role-agent]="row.role === 'sales_agent'"
                [class.role-analyst]="row.role === 'analyst'"
              >
                {{ roleLabel(row.role) }}
              </mat-chip>
            </td>
          </ng-container>

          <ng-container matColumnDef="status">
            <th mat-header-cell *matHeaderCellDef i18n="@@users.col.status">Status</th>
            <td mat-cell *matCellDef="let row">
              <app-status-pill
                [label]="row.isActive ? activeLabel : inactiveLabel"
                [tone]="row.isActive ? 'success' : 'neutral'"
              />
            </td>
          </ng-container>

          <ng-container matColumnDef="lastLogin">
            <th mat-header-cell *matHeaderCellDef i18n="@@users.col.lastLogin">Last sign-in</th>
            <td mat-cell *matCellDef="let row" class="muted" [title]="row.lastLoginAt ?? ''">
              {{ row.lastLoginAt | relativeTime }}
            </td>
          </ng-container>

          <ng-container matColumnDef="actions">
            <th mat-header-cell *matHeaderCellDef></th>
            <td mat-cell *matCellDef="let row">
              <button
                mat-icon-button
                [matMenuTriggerFor]="rowMenu"
                [attr.aria-label]="actionsLabel(row.name)"
              >
                <mat-icon>more_vert</mat-icon>
              </button>
              <mat-menu #rowMenu="matMenu">
                <button
                  mat-menu-item
                  type="button"
                  (click)="openEdit(row)"
                  i18n="@@users.action.edit"
                >
                  Edit
                </button>
                <button
                  mat-menu-item
                  type="button"
                  (click)="openReset(row)"
                  i18n="@@users.action.reset"
                >
                  Reset password
                </button>
                <button mat-menu-item type="button" (click)="toggleActive(row)">
                  @if (row.isActive) {
                    <span i18n="@@users.action.deactivate">Deactivate</span>
                  } @else {
                    <span i18n="@@users.action.activate">Activate</span>
                  }
                </button>
              </mat-menu>
            </td>
          </ng-container>

          <tr mat-header-row *matHeaderRowDef="displayed"></tr>
          <tr mat-row *matRowDef="let row; columns: displayed" class="users-row"></tr>
        </table>

        @if (!loading() && total() === 0) {
          <app-empty-state icon="group" [title]="emptyTitle" [subtitle]="emptySubtitle">
            <button mat-flat-button color="primary" (click)="openCreate()" i18n="@@users.create">
              Create user
            </button>
          </app-empty-state>
        }

        <mat-paginator
          [hidden]="total() === 0"
          [length]="total()"
          [pageSize]="pageSize()"
          [pageSizeOptions]="[20, 50, 100]"
          [pageIndex]="page() - 1"
          (page)="onPage($event)"
        />
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
      @media (prefers-reduced-motion: reduce) {
        .page {
          animation: none;
        }
      }
      .table-panel {
        background: var(--color-surface-default);
        border: 1px solid var(--color-border-default);
        border-radius: var(--radius-md);
        box-shadow: var(--shadow-sm);
        overflow: hidden;
      }
      .users-table {
        width: 100%;
        background: transparent;
      }
      // Header row — bolder, brand-tinted underline
      .users-table .mat-mdc-header-row {
        background: var(--color-surface-elevated);
        border-block-end: 2px solid var(--color-border-default);
      }
      .users-table .mat-mdc-header-cell {
        font-size: var(--text-xs);
        font-weight: var(--font-weight-semibold);
        letter-spacing: 0.06em;
        text-transform: uppercase;
        color: var(--color-text-tertiary);
        padding-block: var(--space-3);
      }
      .users-table .mat-mdc-cell {
        padding-block: var(--space-3);
        border-block-end-color: var(--color-border-default);
        font-size: var(--text-sm);
      }
      .users-row {
        transition: background var(--motion-duration-fast) var(--motion-easing-standard);
      }
      .users-row:hover {
        background: var(--color-surface-row-hover);
      }
      .users-row:last-child .mat-mdc-cell {
        border-block-end: none;
      }
      // Identity column: avatar + name (primary) + email (muted) stacked
      .identity {
        display: inline-flex;
        align-items: center;
        gap: var(--space-3);
      }
      .identity-text {
        display: inline-flex;
        flex-direction: column;
        gap: 2px;
        line-height: 1.2;
      }
      .identity-name {
        font-weight: var(--font-weight-semibold);
        color: var(--color-text-primary);
      }
      .identity-email {
        font-size: var(--text-sm);
        color: var(--color-text-secondary);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        max-inline-size: 28ch;
      }
      .avatar {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 36px;
        height: 36px;
        border-radius: var(--radius-pill);
        background: var(--color-tonal-accent-bg);
        color: var(--color-brand-primary);
        font-size: var(--text-xs);
        font-weight: var(--font-weight-bold);
        letter-spacing: 0.04em;
        flex-shrink: 0;
        box-shadow: inset 0 0 0 1px var(--color-border-default);
      }
      // Super-admin avatar inverted to signal authority
      .avatar[data-role='super_admin'] {
        background: var(--color-brand-primary);
        color: var(--color-text-on-brand);
        box-shadow: inset 0 0 0 1px var(--color-brand-primary-hover);
      }
      .avatar[data-role='sales_manager'] {
        background: var(--color-tonal-accent-bg);
        color: var(--color-tonal-accent);
        box-shadow: inset 0 0 0 1px var(--color-tonal-accent);
      }
      .avatar[data-role='sales_agent'] {
        background: color-mix(in srgb, var(--color-tonal-accent) 10%, var(--color-surface-default));
        color: var(--color-tonal-accent);
        box-shadow: inset 0 0 0 1px var(--color-border-default);
      }
      .avatar[data-role='analyst'] {
        background: var(--color-surface-muted);
        color: var(--color-text-secondary);
        box-shadow: inset 0 0 0 1px var(--color-border-default);
      }
      // Role chips — softer, outlined for super_admin (visual weight comes from avatar)
      mat-chip.role-chip {
        font-size: 11px;
        font-weight: var(--font-weight-semibold);
        text-transform: uppercase;
        letter-spacing: 0.06em;
      }
      mat-chip.role-super {
        background: transparent;
        color: var(--color-brand-primary);
        box-shadow: inset 0 0 0 1px var(--color-brand-primary);
      }
      mat-chip.role-manager {
        background: var(--color-tonal-accent-bg);
        color: var(--color-tonal-accent);
      }
      mat-chip.role-agent {
        background: color-mix(in srgb, var(--color-tonal-accent) 10%, var(--color-surface-default));
        color: var(--color-tonal-accent);
      }
      mat-chip.role-analyst {
        background: var(--color-surface-muted);
        color: var(--color-text-secondary);
      }
      // Status chip with leading dot
      mat-chip.status-chip {
        font-size: var(--text-xs);
        font-weight: var(--font-weight-medium);
      }
      .status-dot {
        display: inline-block;
        width: 8px;
        height: 8px;
        border-radius: var(--radius-pill);
        margin-inline-end: var(--space-2);
        background: currentColor;
      }
      mat-chip.status-chip.active {
        background: var(--color-success-bg);
        color: var(--color-success);
      }
      mat-chip.status-chip.inactive {
        background: var(--color-surface-muted);
        color: var(--color-text-secondary);
      }
      // Paginator divider + tone
      .users-table + mat-paginator,
      .mat-mdc-paginator {
        border-block-start: 1px solid var(--color-border-default);
        background: var(--color-surface-elevated);
      }
    `,
  ],
})
export class UsersListPage implements OnInit {
  private readonly api = inject(UsersService);
  private readonly dialog = inject(MatDialog);
  private readonly snack = inject(MatSnackBar);
  private readonly errorCodes = inject(ErrorCodeService);

  protected readonly displayed = ['identity', 'role', 'status', 'lastLogin', 'actions'];
  protected readonly emptyTitle = $localize`:@@users.empty.title:No staff accounts yet.`;
  protected readonly emptySubtitle = $localize`:@@users.empty.subtitle:Create the first one to start operating the dashboard.`;
  protected readonly titleText = $localize`:@@users.title:Users`;
  protected readonly rows = signal<readonly StaffAccountSummary[]>([]);
  protected readonly total = signal<number>(0);

  protected readonly subtitleText = (): string => {
    const base = $localize`:@@users.subtitle:Internal staff accounts`;
    const t = this.total();
    return t > 0 ? `${base} · ${t}` : base;
  };

  protected readonly statAriaLabel = $localize`:@@users.stat.aria:Staff account totals`;
  protected readonly activeLabel = $localize`:@@users.status.active:Active`;
  protected readonly inactiveLabel = $localize`:@@users.status.inactive:Inactive`;
  protected readonly statItems = computed<StatStripItem[]>(() => {
    const r = this.rows();
    const active = r.filter((u) => u.isActive).length;
    const admins = r.filter((u) => u.role === 'super_admin').length;
    const managers = r.filter((u) => u.role === 'sales_manager').length;
    const agents = r.filter((u) => u.role === 'sales_agent').length;
    return [
      { label: $localize`:@@users.stat.total:Total`, value: this.total() },
      { label: $localize`:@@users.stat.active:Active`, value: active, tone: 'success' },
      { label: $localize`:@@users.stat.admins:Super-admins`, value: admins, tone: 'muted' },
      { label: $localize`:@@users.stat.managers:Managers`, value: managers },
      { label: $localize`:@@users.stat.agents:Sales agents`, value: agents },
    ];
  });
  protected readonly page = signal<number>(1);
  protected readonly pageSize = signal<number>(20);
  protected readonly loading = signal<boolean>(false);

  async ngOnInit(): Promise<void> {
    await this.reload();
  }

  protected actionsLabel(name: string): string {
    return $localize`:@@users.actions.menu:Actions for ${name}`;
  }

  protected roleLabel(role: string): string {
    switch (role) {
      case 'super_admin':
        return $localize`:@@role.super_admin:Super-admin`;
      case 'sales_manager':
        return $localize`:@@role.sales_manager:Sales manager`;
      case 'sales_agent':
        return $localize`:@@role.sales_agent:Sales agent`;
      case 'analyst':
        return $localize`:@@role.analyst:Analyst`;
      default:
        return role;
    }
  }

  protected initials(name: string): string {
    const trimmed = (name ?? '').trim();
    if (!trimmed) return '?';
    const parts = trimmed.split(/\s+/);
    if (parts.length >= 2) {
      return ((parts[0]?.[0] ?? '') + (parts[parts.length - 1]?.[0] ?? '')).toUpperCase();
    }
    return trimmed.slice(0, 2).toUpperCase();
  }

  async openCreate(): Promise<void> {
    const ref = this.dialog.open<UserFormDialog, UserFormDialogData, StaffAccountSummary>(
      UserFormDialog,
      { data: { mode: 'create' } },
    );
    const created = await ref.afterClosed().toPromise();
    if (created) {
      this.snack.open($localize`:@@users.created:User created.`, undefined, { duration: 4000 });
      await this.reload();
    }
  }

  async openEdit(row: StaffAccountSummary): Promise<void> {
    const ref = this.dialog.open<UserFormDialog, UserFormDialogData, StaffAccountSummary>(
      UserFormDialog,
      { data: { mode: 'edit', row } },
    );
    const updated = await ref.afterClosed().toPromise();
    if (updated) {
      this.snack.open($localize`:@@users.updated:User updated.`, undefined, { duration: 4000 });
      await this.reload();
    }
  }

  async openReset(row: StaffAccountSummary): Promise<void> {
    const ref = this.dialog.open(ResetPasswordDialog, { data: { row }, width: '420px' });
    const ok = await ref.afterClosed().toPromise();
    if (ok) {
      this.snack.open(
        $localize`:@@users.passwordReset:Password reset. The user must change it on next sign-in.`,
        undefined,
        { duration: 6000 },
      );
    }
  }

  async toggleActive(row: StaffAccountSummary): Promise<void> {
    try {
      await this.api.update(row.id, { isActive: !row.isActive });
      await this.reload();
    } catch (err) {
      this.snack.open(this.toMessage(err), undefined, { duration: 6000 });
    }
  }

  async onPage(ev: PageEvent): Promise<void> {
    this.page.set(ev.pageIndex + 1);
    this.pageSize.set(ev.pageSize);
    await this.reload();
  }

  private async reload(): Promise<void> {
    this.loading.set(true);
    try {
      const res = await this.api.list(this.page(), this.pageSize());
      this.rows.set(res.rows);
      this.total.set(res.total);
    } catch (err) {
      this.snack.open(this.toMessage(err), undefined, { duration: 6000 });
    } finally {
      this.loading.set(false);
    }
  }

  private toMessage(err: unknown): string {
    if (err instanceof HttpErrorResponse) {
      const body = err.error as ErrorEnvelope | undefined;
      if (body && body.success === false && typeof body.code === 'string') {
        return this.errorCodes.toLocalizedMessage(body.code as ErrorCode, body.meta);
      }
    }
    return this.errorCodes.toLocalizedMessage('INTERNAL_ERROR');
  }
}
