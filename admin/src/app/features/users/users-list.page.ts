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
import { firstValueFrom } from 'rxjs';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { NzModalService } from 'ng-zorro-antd/modal';
import { NzIconModule, provideNzIconsPatch } from 'ng-zorro-antd/icon';
import { NzDropDownModule } from 'ng-zorro-antd/dropdown';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzMessageService } from 'ng-zorro-antd/message';
import {
  UserAddOutline,
  EllipsisOutline,
  TeamOutline,
  CheckCircleOutline,
  SafetyCertificateOutline,
  SolutionOutline,
  CustomerServiceOutline,
} from '@ant-design/icons-angular/icons';
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
    NzButtonModule,
    NzTagModule,
    NzIconModule,
    NzDropDownModule,
    NzTableModule,
    EmptyStateComponent,
    RelativeTimePipe,
    PageHeaderComponent,
    StatStripComponent,
    StatusPillComponent,
    SkeletonRowsComponent,
  ],
  providers: [
    provideNzIconsPatch([
      UserAddOutline,
      EllipsisOutline,
      TeamOutline,
      CheckCircleOutline,
      SafetyCertificateOutline,
      SolutionOutline,
      CustomerServiceOutline,
    ]),
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="page">
      <app-page-header [title]="titleText" [subtitle]="subtitleText()">
        <button nz-button nzType="primary" (click)="openCreate()">
          <span nz-icon nzType="user-add" nzTheme="outline"></span>
          <span i18n="@@users.create">Create user</span>
        </button>
      </app-page-header>

      <app-stat-strip [items]="statItems()" [ariaLabel]="statAriaLabel" />

      <div class="table-panel">
        @if (loading()) {
          <app-skeleton-rows [rows]="5" [cols]="[2, 1, 1, 1, 1]" />
        }

        <nz-table
          #usersTbl
          [nzData]="rows()"
          [nzLoading]="loading()"
          [nzFrontPagination]="false"
          [nzShowPagination]="total() > 0"
          [(nzPageIndex)]="pageIndex"
          [nzPageSize]="pageSize()"
          [nzTotal]="total()"
          [nzPageSizeOptions]="[20, 50, 100]"
          [nzShowSizeChanger]="true"
          (nzPageIndexChange)="onPageIndex($event)"
          (nzPageSizeChange)="onPageSize($event)"
          class="users-table"
        >
          <thead>
            <tr>
              <th i18n="@@users.col.name">Name</th>
              <th i18n="@@users.col.role">Role</th>
              <th i18n="@@users.col.status">Status</th>
              <th i18n="@@users.col.lastLogin">Last sign-in</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            @for (row of usersTbl.data; track row.id) {
              <tr class="users-row">
                <td>
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
                <td>
                  <nz-tag
                    class="role-chip"
                    [class.role-super]="row.role === 'super_admin'"
                    [class.role-manager]="row.role === 'sales_manager'"
                    [class.role-agent]="row.role === 'sales_agent'"
                    [class.role-analyst]="row.role === 'analyst'"
                  >
                    {{ roleLabel(row.role) }}
                  </nz-tag>
                </td>
                <td>
                  <app-status-pill
                    [label]="row.isActive ? activeLabel : inactiveLabel"
                    [tone]="row.isActive ? 'success' : 'neutral'"
                  />
                </td>
                <td class="muted" [title]="row.lastLoginAt ?? ''">
                  {{ row.lastLoginAt | relativeTime }}
                </td>
                <td>
                  <button
                    nz-button
                    nzType="text"
                    nzShape="circle"
                    nz-dropdown
                    [nzDropdownMenu]="rowMenu"
                    nzTrigger="click"
                    nzPlacement="bottomRight"
                    [attr.aria-label]="actionsLabel(row.name)"
                  >
                    <span nz-icon nzType="ellipsis" nzTheme="outline"></span>
                  </button>
                  <nz-dropdown-menu #rowMenu="nzDropdownMenu">
                    <ul nz-menu>
                      <li nz-menu-item (click)="openEdit(row)">
                        <span i18n="@@users.action.edit">Edit</span>
                      </li>
                      <li nz-menu-item (click)="openReset(row)">
                        <span i18n="@@users.action.reset">Reset password</span>
                      </li>
                      <li nz-menu-item (click)="toggleActive(row)">
                        @if (row.isActive) {
                          <span i18n="@@users.action.deactivate">Deactivate</span>
                        } @else {
                          <span i18n="@@users.action.activate">Activate</span>
                        }
                      </li>
                    </ul>
                  </nz-dropdown-menu>
                </td>
              </tr>
            }
          </tbody>
        </nz-table>

        @if (!loading() && total() === 0) {
          <app-empty-state icon="group" [title]="emptyTitle" [subtitle]="emptySubtitle">
            <button nz-button nzType="primary" (click)="openCreate()" i18n="@@users.create">
              Create user
            </button>
          </app-empty-state>
        }
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
      nz-tag.role-chip {
        font-size: 11px;
        font-weight: var(--font-weight-semibold);
        text-transform: uppercase;
        letter-spacing: 0.06em;
      }
      nz-tag.role-super {
        background: transparent;
        color: var(--color-brand-primary);
        box-shadow: inset 0 0 0 1px var(--color-brand-primary);
      }
      nz-tag.role-manager {
        background: var(--color-tonal-accent-bg);
        color: var(--color-tonal-accent);
      }
      nz-tag.role-agent {
        background: color-mix(in srgb, var(--color-tonal-accent) 10%, var(--color-surface-default));
        color: var(--color-tonal-accent);
      }
      nz-tag.role-analyst {
        background: var(--color-surface-muted);
        color: var(--color-text-secondary);
      }
      .users-row {
        transition: background var(--motion-duration-fast) var(--motion-easing-standard);
      }
      .users-row:hover {
        background: var(--color-surface-row-hover);
      }
    `,
  ],
})
export class UsersListPage implements OnInit {
  private readonly api = inject(UsersService);
  private readonly modal = inject(NzModalService);
  private readonly message = inject(NzMessageService);
  private readonly errorCodes = inject(ErrorCodeService);

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
    const shown = r.length;
    const active = r.filter((u) => u.isActive).length;
    const admins = r.filter((u) => u.role === 'super_admin').length;
    const managers = r.filter((u) => u.role === 'sales_manager').length;
    const agents = r.filter((u) => u.role === 'sales_agent').length;
    const livePct = shown > 0 ? Math.round((active / shown) * 100) : 0;
    return [
      {
        label: $localize`:@@users.stat.total:Total`,
        value: this.total(),
        icon: 'team',
        hint: $localize`:@@users.stat.total.hint:staff accounts`,
      },
      {
        label: $localize`:@@users.stat.active:Active`,
        value: active,
        tone: 'success',
        icon: 'check-circle',
        hint: $localize`:@@users.stat.active.hint:${livePct}:pct:% live`,
      },
      {
        label: $localize`:@@users.stat.admins:Super-admins`,
        value: admins,
        tone: 'muted',
        icon: 'safety-certificate',
      },
      {
        label: $localize`:@@users.stat.managers:Managers`,
        value: managers,
        icon: 'solution',
      },
      {
        label: $localize`:@@users.stat.agents:Sales agents`,
        value: agents,
        icon: 'customer-service',
      },
    ];
  });
  protected readonly page = signal<number>(1);
  protected readonly pageSize = signal<number>(20);
  protected readonly loading = signal<boolean>(false);

  // Two-way bound page index for nz-table (1-based — same as our page signal)
  protected pageIndex = 1;

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
    const ref = this.modal.create<UserFormDialog, UserFormDialogData, StaffAccountSummary>({
      nzContent: UserFormDialog,
      nzData: { mode: 'create' },
      nzFooter: null,
      nzWidth: 560,
      nzMaskClosable: true,
    });
    const created = await firstValueFrom(ref.afterClose);
    if (created) {
      this.message.success($localize`:@@users.created:User created.`, { nzDuration: 4000 });
      await this.reload();
    }
  }

  async openEdit(row: StaffAccountSummary): Promise<void> {
    const ref = this.modal.create<UserFormDialog, UserFormDialogData, StaffAccountSummary>({
      nzContent: UserFormDialog,
      nzData: { mode: 'edit', row },
      nzFooter: null,
      nzWidth: 560,
      nzMaskClosable: true,
    });
    const updated = await firstValueFrom(ref.afterClose);
    if (updated) {
      this.message.success($localize`:@@users.updated:User updated.`, { nzDuration: 4000 });
      await this.reload();
    }
  }

  async openReset(row: StaffAccountSummary): Promise<void> {
    const ref = this.modal.create<ResetPasswordDialog, { row: StaffAccountSummary }, boolean>({
      nzContent: ResetPasswordDialog,
      nzData: { row },
      nzFooter: null,
      nzWidth: 420,
      nzMaskClosable: true,
    });
    const ok = await firstValueFrom(ref.afterClose);
    if (ok) {
      this.message.success(
        $localize`:@@users.passwordReset:Password reset. The user must change it on next sign-in.`,
        { nzDuration: 6000 },
      );
    }
  }

  async toggleActive(row: StaffAccountSummary): Promise<void> {
    try {
      await this.api.update(row.id, { isActive: !row.isActive });
      await this.reload();
    } catch (err) {
      this.message.error(this.toMessage(err), { nzDuration: 6000 });
    }
  }

  async onPageIndex(index: number): Promise<void> {
    this.page.set(index);
    this.pageIndex = index;
    await this.reload();
  }

  async onPageSize(size: number): Promise<void> {
    this.pageSize.set(size);
    this.page.set(1);
    this.pageIndex = 1;
    await this.reload();
  }

  private async reload(): Promise<void> {
    this.loading.set(true);
    try {
      const res = await this.api.list(this.page(), this.pageSize());
      this.rows.set(res.rows);
      this.total.set(res.total);
    } catch (err) {
      this.message.error(this.toMessage(err), { nzDuration: 6000 });
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
