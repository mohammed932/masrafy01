import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzIconModule, provideNzIconsPatch } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalService } from 'ng-zorro-antd/modal';
import { NzSwitchModule } from 'ng-zorro-antd/switch';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzToolTipModule } from 'ng-zorro-antd/tooltip';
import { BankOutline, PlusOutline, SearchOutline, EditOutline, DeleteOutline } from '@ant-design/icons-angular/icons';
import { CanDirective } from '../../shared/can.directive';
import { PageHeaderComponent } from '@shared/ui';
import { ErrorCodeService } from '../../core/errors/error-code.service';
import { BanksApiService } from './banks.api.service';
import { BankFormDialog, type BankFormDialogData, type BankFormDialogResult } from './bank-form.dialog';
import type { BankWithProgramCount } from './banks.types';

@Component({
  selector: 'app-banks-list-page',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterLink,
    NzButtonModule,
    NzIconModule,
    NzInputModule,
    NzSwitchModule,
    NzTableModule,
    NzToolTipModule,
    CanDirective,
    PageHeaderComponent,
  ],
  providers: [
    provideNzIconsPatch([BankOutline, PlusOutline, SearchOutline, EditOutline, DeleteOutline]),
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="page">
      <app-page-header
        title="Banks"
        i18n-title="@@banks.list.title"
        subtitle="Manage the bank registry. Programs link to a bank via FK."
        i18n-subtitle="@@banks.list.subtitle"
      >
        <a *can="['super_admin']" nz-button nzType="primary" (click)="openCreate()">
          <span nz-icon nzType="plus" nzTheme="outline" aria-hidden="true"></span>
          <span i18n="@@banks.list.add">Add bank</span>
        </a>
      </app-page-header>

      <div class="toolbar">
        <input
          nz-input
          placeholder="Search by code or name…"
          i18n-placeholder="@@banks.list.search"
          [formControl]="searchControl"
        />
      </div>

      <div class="table-wrap">
        <nz-table
          #t
          [nzData]="rows()"
          [nzLoading]="loading()"
          [nzFrontPagination]="false"
          [nzShowPagination]="false"
        >
          <thead>
            <tr>
              <th style="width: 64px"></th>
              <th i18n="@@banks.col.code">Code</th>
              <th i18n="@@banks.col.name">Name</th>
              <th i18n="@@banks.col.programs">Programs</th>
              <th i18n="@@banks.col.active">Active</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            @for (b of t.data; track b.id) {
              <tr>
                <td>
                  <span class="logo">
                    @if (b.logoS3Key) {
                      <img [src]="logoUrl(b)" alt="" class="logo-img" />
                    } @else {
                      <span class="logo-fallback">{{ initialsOf(b.nameEnglish) }}</span>
                    }
                  </span>
                </td>
                <td><span class="code-chip">{{ b.code }}</span></td>
                <td>
                  <a [routerLink]="['/banks', b.id]" class="row-link">
                    {{ b.nameEnglish }}
                    @if (b.isFeatured) {
                      <span
                        class="featured-chip"
                        nz-tooltip
                        i18n-nzTooltipTitle="@@banks.featured.tooltip"
                        nzTooltipTitle="Featured partner — boosted in mobile ranking ties"
                      >★ Featured</span>
                    }
                  </a>
                  <p class="muted">{{ b.nameArabic }}</p>
                </td>
                <td class="numeric">{{ b.programCount }}</td>
                <td>
                  <nz-switch
                    *can="['super_admin']"
                    [formControl]="rowActiveControl(b)"
                  ></nz-switch>
                  <span *can="['sales_manager', 'sales_agent', 'analyst']">{{ b.isActive ? 'Yes' : 'No' }}</span>
                </td>
                <td class="actions">
                  <button
                    *can="['super_admin']"
                    nz-button
                    nzType="text"
                    nzShape="circle"
                    nz-tooltip
                    nzTooltipTitle="Edit"
                    (click)="openEdit(b)"
                  >
                    <span nz-icon nzType="edit" nzTheme="outline" aria-hidden="true"></span>
                  </button>
                  <button
                    *can="['super_admin']"
                    nz-button
                    nzType="text"
                    nzShape="circle"
                    nz-tooltip
                    nzTooltipTitle="Delete"
                    (click)="onDelete(b)"
                  >
                    <span nz-icon nzType="delete" nzTheme="outline" aria-hidden="true"></span>
                  </button>
                </td>
              </tr>
            } @empty {
              <tr>
                <td colspan="6">
                  <p class="empty" i18n="@@banks.list.empty">No banks yet. Add your first bank.</p>
                </td>
              </tr>
            }
          </tbody>
        </nz-table>
      </div>
    </section>
  `,
  styles: [
    `
      :host { display: block; padding: var(--space-6); max-width: 1200px; margin-inline: auto; }
      .toolbar { margin-block: var(--space-4); display: flex; gap: var(--space-3); }
      .toolbar input { max-inline-size: 360px; }
      .table-wrap {
        background: var(--bg-surface, var(--color-surface-default));
        border: 1px solid var(--border-default, var(--color-border-default));
        border-radius: var(--radius-lg);
        overflow: hidden;
      }
      .logo {
        display: inline-flex; align-items: center; justify-content: center;
        inline-size: 40px; block-size: 40px; border-radius: var(--radius-md);
        background: var(--bg-subtle, var(--color-surface-row-hover));
        overflow: hidden;
      }
      .logo-img { inline-size: 100%; block-size: 100%; object-fit: contain; }
      .logo-fallback {
        font-weight: 700; font-size: 13px;
        color: var(--primary, var(--color-brand-primary));
      }
      .row-link { color: var(--text-primary); font-weight: 600; text-decoration: none; }
      .row-link:hover { color: var(--primary, var(--color-brand-primary)); }
      .muted { margin: 0; font-size: var(--text-xs); color: var(--text-tertiary); }
      .numeric { font-variant-numeric: tabular-nums lining-nums; }
      .actions { white-space: nowrap; }
      .empty { padding: var(--space-6); text-align: center; color: var(--text-tertiary); margin: 0; }
      .code-chip {
        display: inline-block;
        padding: 2px 8px;
        background: var(--bg-muted, var(--color-surface-muted));
        border-radius: var(--radius-sm);
        font-family: var(--font-mono, monospace);
        font-size: 11px;
        font-weight: 700;
        color: var(--text-secondary, var(--color-text-secondary));
        letter-spacing: 0.04em;
      }
      .featured-chip {
        display: inline-block;
        margin-inline-start: 8px;
        padding: 1px 8px;
        background: color-mix(in srgb, var(--color-brand-primary) 12%, transparent);
        color: var(--color-brand-primary);
        border-radius: 999px;
        font-size: 10px;
        font-weight: 700;
        letter-spacing: 0.04em;
        vertical-align: middle;
      }
    `,
  ],
})
export class BanksListPage implements OnInit {
  private readonly api = inject(BanksApiService);
  private readonly modal = inject(NzModalService);
  private readonly message = inject(NzMessageService);
  private readonly router = inject(Router);
  private readonly errors = inject(ErrorCodeService);

  readonly rows = signal<BankWithProgramCount[]>([]);
  readonly loading = signal(false);
  readonly searchControl = new FormControl<string>('', { nonNullable: true });
  private searchDebounce?: ReturnType<typeof setTimeout>;
  private readonly rowActiveControls = new Map<string, FormControl<boolean>>();

  rowActiveControl(b: BankWithProgramCount): FormControl<boolean> {
    let ctrl = this.rowActiveControls.get(b.id);
    if (!ctrl) {
      ctrl = new FormControl<boolean>(b.isActive, { nonNullable: true });
      this.rowActiveControls.set(b.id, ctrl);
      ctrl.valueChanges.subscribe((next) => {
        if (next !== b.isActive) void this.onToggle(b, next);
      });
    } else if (ctrl.value !== b.isActive) {
      ctrl.setValue(b.isActive, { emitEvent: false });
    }
    return ctrl;
  }

  ngOnInit(): void {
    this.searchControl.valueChanges.subscribe(() => {
      if (this.searchDebounce) clearTimeout(this.searchDebounce);
      this.searchDebounce = setTimeout(() => void this.reload(), 250);
    });
    void this.reload();
  }

  async reload(): Promise<void> {
    this.loading.set(true);
    try {
      const res = await this.api.list({ pageSize: 100, search: this.searchControl.value || undefined });
      this.rows.set(res.data);
    } catch (err) {
      this.handleError(err);
    } finally {
      this.loading.set(false);
    }
  }

  openCreate(): void {
    const ref = this.modal.create<BankFormDialog, BankFormDialogData, BankFormDialogResult | undefined>({
      nzContent: BankFormDialog,
      nzData: { mode: 'create' },
      nzWidth: 560,
      nzFooter: null,
      nzAutofocus: null,
    });
    ref.afterClose.subscribe((res) => { if (res?.saved) void this.reload(); });
  }

  openEdit(b: BankWithProgramCount): void {
    const ref = this.modal.create<BankFormDialog, BankFormDialogData, BankFormDialogResult | undefined>({
      nzContent: BankFormDialog,
      nzData: { mode: 'edit', bank: b },
      nzWidth: 560,
      nzFooter: null,
      nzAutofocus: null,
    });
    ref.afterClose.subscribe((res) => { if (res?.saved) void this.reload(); });
  }

  async onToggle(b: BankWithProgramCount, isActive: boolean): Promise<void> {
    try {
      await this.api.toggle(b.id, { version: b.version, isActive });
      this.message.success($localize`:@@banks.toggle.success:Bank updated.`);
      void this.reload();
    } catch (err) {
      this.handleError(err);
      void this.reload();
    }
  }

  async onDelete(b: BankWithProgramCount): Promise<void> {
    if (b.programCount > 0) {
      this.message.warning(
        this.errors.toLocalizedMessage('BANK_HAS_PROGRAMS' as never, { programCount: b.programCount }),
      );
      return;
    }
    this.modal.confirm({
      nzTitle: $localize`:@@banks.delete.title:Delete bank?`,
      nzContent: b.nameEnglish,
      nzOkText: $localize`:@@banks.delete.ok:Delete`,
      nzOkDanger: true,
      nzOnOk: async () => {
        try {
          await this.api.remove(b.id);
          this.message.success($localize`:@@banks.delete.success:Bank deleted.`);
          void this.reload();
        } catch (err) {
          this.handleError(err);
        }
      },
    });
  }

  logoUrl(b: BankWithProgramCount): string {
    return b.logoS3Key ? `/api/admin/banks/${b.id}/logo` : '';
  }

  initialsOf(name: string): string {
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
    return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase();
  }

  private handleError(err: unknown): void {
    const envelope = (err as { error?: { code?: string; meta?: Record<string, unknown> } }).error;
    const code = envelope?.code ?? 'INTERNAL_ERROR';
    this.message.error(this.errors.toLocalizedMessage(code as never, envelope?.meta));
  }
}

