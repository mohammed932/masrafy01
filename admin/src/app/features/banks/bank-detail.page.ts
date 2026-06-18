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
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCollapseModule } from 'ng-zorro-antd/collapse';
import { NzIconModule, provideNzIconsPatch } from 'ng-zorro-antd/icon';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalService } from 'ng-zorro-antd/modal';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzSwitchModule } from 'ng-zorro-antd/switch';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzToolTipModule } from 'ng-zorro-antd/tooltip';
import {
  ArrowLeftOutline,
  CopyOutline,
  DeleteOutline,
  EditOutline,
  PlusOutline,
  RightOutline,
} from '@ant-design/icons-angular/icons';
import { CanDirective } from '../../shared/can.directive';
import { StatStripComponent, type StatStripItem } from '@shared/ui';
import {
  LOAN_CATEGORIES,
  categoryLabel,
  isLoanCategory,
  type LoanCategory,
} from '@core/loan-category';
import { ErrorCodeService } from '../../core/errors/error-code.service';
import { BankProgramsApiService } from '../bank-programs/bank-programs.api.service';
import {
  CloneProgramDialog,
  type CloneProgramDialogData,
} from '../bank-programs/clone/clone-program.dialog';
import {
  DeleteProgramDialog,
  type DeleteProgramDialogData,
} from '../bank-programs/delete/delete-program.dialog';
import { BanksApiService } from './banks.api.service';
import {
  BankFormDialog,
  type BankFormDialogData,
  type BankFormDialogResult,
} from './bank-form.dialog';
import type { BankProgramSummary, BankWithProgramCount } from './banks.types';

/** One category accordion section on the bank-detail programs list. */
interface ProgramSection {
  cat: LoanCategory | 'other';
  label: string;
  items: BankProgramSummary[];
}

/**
 * Bank detail — drill-down target of the registry (`/banks/:bankId`).
 *
 * Holds the bank's header (logo, names, edit/toggle/delete) + the list of
 * programs belonging to this bank. Programs are reached only by drilling into
 * their bank; there is no flat cross-bank list. Row actions reuse the existing
 * Clone/Delete program dialogs and the bank-program toggle endpoint verbatim.
 */
@Component({
  selector: 'app-bank-detail-page',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterLink,
    NzButtonModule,
    NzCollapseModule,
    NzIconModule,
    NzSpinModule,
    NzSwitchModule,
    NzTableModule,
    NzToolTipModule,
    CanDirective,
    StatStripComponent,
  ],
  providers: [
    provideNzIconsPatch([
      ArrowLeftOutline,
      EditOutline,
      DeleteOutline,
      PlusOutline,
      CopyOutline,
      RightOutline,
    ]),
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="page">
      <a routerLink="/banks" class="back">
        <span nz-icon nzType="arrow-left" nzTheme="outline" aria-hidden="true"></span>
        <span i18n="@@bank_detail.back">Banks</span>
      </a>

      @if (loading() && !bank()) {
        <div class="loading" aria-busy="true">
          <nz-spin nzSimple />
        </div>
      } @else {
        @if (bank(); as b) {
          <header class="hero">
            <span class="logo">
              @if (b.logoS3Key) {
                <img [src]="logoUrl(b)" alt="" class="logo-img" />
              } @else {
                <span class="logo-fallback">{{ initialsOf(b.nameEnglish) }}</span>
              }
            </span>

            <div class="hero-text">
              <span class="eyebrow" i18n="@@bank_detail.eyebrow">Bank</span>
              <h1 class="title">
                {{ b.nameEnglish }}
                @if (b.isFeatured) {
                  <span
                    class="featured-chip"
                    nz-tooltip
                    i18n-nzTooltipTitle="@@banks.featured.tooltip"
                    nzTooltipTitle="Featured partner — boosted in mobile ranking ties"
                    >★ Featured</span
                  >
                }
              </h1>
              <p class="sub">{{ b.nameArabic }}</p>
            </div>

            <div class="hero-actions">
              <label *can="['super_admin']" class="active-toggle">
                <nz-switch [formControl]="bankActiveControl"></nz-switch>
                <span i18n="@@bank_detail.active">Active</span>
              </label>
              <span *can="['sales_manager', 'sales_agent', 'analyst']" class="status">
                @if (bank()!.isActive) {
                  <span i18n="@@bank_detail.status.active">Active</span>
                } @else {
                  <span i18n="@@bank_detail.status.inactive">Inactive</span>
                }
              </span>
              <button
                *can="['super_admin']"
                nz-button
                nzType="default"
                (click)="openEditBank(bank()!)"
              >
                <span nz-icon nzType="edit" nzTheme="outline" aria-hidden="true"></span>
                <span i18n="@@bank_detail.edit">Edit bank</span>
              </button>
              <button
                *can="['super_admin']"
                nz-button
                nzType="text"
                nzShape="circle"
                nz-tooltip
                i18n-nzTooltipTitle="@@bank_detail.delete"
                nzTooltipTitle="Delete bank"
                (click)="onDeleteBank(bank()!)"
              >
                <span nz-icon nzType="delete" nzTheme="outline" aria-hidden="true"></span>
              </button>
            </div>
          </header>

          <app-stat-strip
            class="stats"
            [items]="stats()"
            ariaLabel="Bank program statistics"
            i18n-ariaLabel="@@bank_detail.stats.aria"
          />

          <div class="section-head">
            <h2 class="section-title" i18n="@@bank_detail.programs.title">Programs</h2>
          </div>

          @if (loadingPrograms()) {
            <div class="loading"><nz-spin nzSimple></nz-spin></div>
          } @else {
            <nz-collapse class="cat-collapse">
              @for (section of categorySections(); track section.cat) {
                <nz-collapse-panel
                  [nzActive]="section.items.length > 0"
                  [nzHeader]="catHeaderTpl"
                  [nzExtra]="catExtraTpl"
                >
                  <ng-template #catHeaderTpl>
                    <span class="cat-name">{{ section.label }}</span>
                    <span class="cat-count" [class.empty]="section.items.length === 0">{{
                      section.items.length
                    }}</span>
                  </ng-template>

                  <ng-template #catExtraTpl>
                    <a
                      *can="['super_admin', 'sales_manager']"
                      nz-button
                      nzType="link"
                      nzSize="small"
                      [routerLink]="['/banks/programs/new']"
                      [queryParams]="addQueryParams(section.cat)"
                      (click)="$event.stopPropagation()"
                    >
                      <span nz-icon nzType="plus" nzTheme="outline" aria-hidden="true"></span>
                      <span i18n="@@bank_detail.programs.add">Add program</span>
                    </a>
                  </ng-template>

                  @if (section.items.length === 0) {
                    <p class="empty-text" i18n="@@bank_detail.programs.cat_empty">
                      No programs in this category yet.
                    </p>
                  } @else {
                    <nz-table
                      #t
                      [nzData]="section.items"
                      [nzFrontPagination]="false"
                      [nzShowPagination]="false"
                    >
                      <thead>
                        <tr>
                          <th i18n="@@bank_detail.col.name">Name</th>
                          <th i18n="@@bank_detail.col.status">Status</th>
                          <th></th>
                        </tr>
                      </thead>
                      <tbody>
                        @for (p of t.data; track p.programCode) {
                          <tr>
                            <td>
                              <a
                                [routerLink]="['/banks/programs', p.programCode]"
                                class="row-link"
                                >{{ p.friendlyName }}</a
                              >
                            </td>
                            <td>
                              <nz-switch
                                *can="['super_admin', 'sales_manager']"
                                [formControl]="rowActiveControl(p)"
                              ></nz-switch>
                              <span
                                *can="['sales_agent', 'analyst']"
                                class="status-chip"
                                [class.active]="p.active"
                                [class.inactive]="!p.active"
                              >
                                @if (p.active) {
                                  <span i18n="@@bank_detail.status.active">Active</span>
                                } @else {
                                  <span i18n="@@bank_detail.status.inactive">Inactive</span>
                                }
                              </span>
                            </td>
                            <td class="actions">
                              <a
                                *can="['super_admin', 'sales_manager']"
                                nz-button
                                nzType="text"
                                nzShape="circle"
                                nz-tooltip
                                i18n-nzTooltipTitle="@@bank_detail.program.edit"
                                nzTooltipTitle="Edit program"
                                [routerLink]="['/banks/programs', p.programCode, 'edit']"
                              >
                                <span
                                  nz-icon
                                  nzType="edit"
                                  nzTheme="outline"
                                  aria-hidden="true"
                                ></span>
                              </a>
                              <button
                                *can="['super_admin', 'sales_manager']"
                                nz-button
                                nzType="text"
                                nzShape="circle"
                                nz-tooltip
                                i18n-nzTooltipTitle="@@bank_detail.program.clone"
                                nzTooltipTitle="Clone program"
                                (click)="openClone(p)"
                              >
                                <span
                                  nz-icon
                                  nzType="copy"
                                  nzTheme="outline"
                                  aria-hidden="true"
                                ></span>
                              </button>
                              <button
                                *can="['super_admin', 'sales_manager']"
                                nz-button
                                nzType="text"
                                nzShape="circle"
                                nz-tooltip
                                i18n-nzTooltipTitle="@@bank_detail.program.delete"
                                nzTooltipTitle="Delete program"
                                (click)="openDelete(p)"
                              >
                                <span
                                  nz-icon
                                  nzType="delete"
                                  nzTheme="outline"
                                  aria-hidden="true"
                                ></span>
                              </button>
                            </td>
                          </tr>
                        }
                      </tbody>
                    </nz-table>
                  }
                </nz-collapse-panel>
              }
            </nz-collapse>
          }
        } @else {
          <p class="empty-text" i18n="@@bank_detail.not_found">Bank not found.</p>
        }
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
      .back {
        display: inline-flex;
        align-items: center;
        gap: var(--space-2);
        margin-block-end: var(--space-4);
        color: var(--color-text-secondary);
        text-decoration: none;
        font-size: var(--text-sm);
        font-weight: var(--font-weight-medium);
      }
      .back:hover {
        color: var(--color-brand-primary);
      }
      .loading {
        display: flex;
        align-items: center;
        justify-content: center;
        padding: var(--space-10);
      }
      .hero {
        display: flex;
        align-items: center;
        gap: var(--space-4);
        padding-block-end: var(--space-5);
        border-block-end: 1px solid var(--color-border-default);
      }
      .logo {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        inline-size: 56px;
        block-size: 56px;
        flex: none;
        border-radius: var(--radius-lg);
        background: var(--color-surface-row-hover);
        overflow: hidden;
      }
      .logo-img {
        inline-size: 100%;
        block-size: 100%;
        object-fit: contain;
      }
      .logo-fallback {
        font-weight: var(--font-weight-bold);
        font-size: var(--text-lg);
        color: var(--color-brand-primary);
      }
      .hero-text {
        flex: 1 1 auto;
        min-inline-size: 0;
      }
      .eyebrow {
        display: block;
        font-size: var(--text-xs);
        font-weight: var(--font-weight-semibold);
        letter-spacing: 0.06em;
        text-transform: uppercase;
        color: var(--color-text-tertiary);
      }
      .title {
        margin: var(--space-1) 0 0;
        font-size: var(--text-2xl);
        font-weight: var(--font-weight-bold);
        color: var(--color-text-primary);
      }
      .sub {
        margin: var(--space-1) 0 0;
        color: var(--color-text-secondary);
        font-size: var(--text-sm);
      }
      .hero-actions {
        display: inline-flex;
        align-items: center;
        gap: var(--space-3);
        flex: none;
      }
      .active-toggle {
        display: inline-flex;
        align-items: center;
        gap: var(--space-2);
        font-size: var(--text-sm);
        color: var(--color-text-secondary);
        cursor: pointer;
      }
      .status {
        font-size: var(--text-sm);
        color: var(--color-text-secondary);
      }
      .featured-chip {
        display: inline-block;
        margin-inline-start: var(--space-2);
        padding: 1px 8px;
        background: var(--color-tonal-accent-bg);
        color: var(--color-brand-primary);
        border-radius: var(--radius-pill);
        font-size: var(--text-xxs);
        font-weight: var(--font-weight-bold);
        letter-spacing: 0.04em;
        vertical-align: middle;
      }
      .stats {
        display: block;
        margin-block: var(--space-6);
      }
      .section-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: var(--space-3);
        margin-block-end: var(--space-4);
      }
      .section-title {
        margin: 0;
        font-size: var(--text-lg);
        font-weight: var(--font-weight-semibold);
        color: var(--color-text-primary);
      }
      .cat-collapse {
        background: var(--color-surface-default);
      }
      .cat-name {
        font-weight: var(--font-weight-semibold);
        color: var(--color-text-primary);
      }
      .cat-count {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-inline-size: 22px;
        block-size: 20px;
        margin-inline-start: var(--space-2);
        padding-inline: var(--space-2);
        border-radius: var(--radius-pill);
        background: var(--color-tonal-accent-bg);
        color: var(--color-brand-primary);
        font-size: var(--text-xs);
        font-weight: var(--font-weight-bold);
        font-variant-numeric: tabular-nums lining-nums;
      }
      .cat-count.empty {
        background: var(--color-surface-muted);
        color: var(--color-text-tertiary);
      }
      .row-link {
        color: var(--color-text-primary);
        font-weight: var(--font-weight-medium);
        text-decoration: none;
      }
      .row-link:hover {
        color: var(--color-text-link);
      }
      .mono {
        font-family: var(--font-family-mono);
        font-variant-numeric: tabular-nums lining-nums;
        color: var(--color-text-secondary);
      }
      .actions {
        white-space: nowrap;
        text-align: end;
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
      .empty {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: var(--space-3);
        padding: var(--space-9) var(--space-6);
        text-align: center;
      }
      .empty-text {
        margin: 0;
        color: var(--color-text-tertiary);
      }
    `,
  ],
})
export class BankDetailPage implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly banksApi = inject(BanksApiService);
  private readonly programsApi = inject(BankProgramsApiService);
  private readonly modal = inject(NzModalService);
  private readonly message = inject(NzMessageService);
  private readonly errors = inject(ErrorCodeService);

  readonly bank = signal<BankWithProgramCount | null>(null);
  readonly programs = signal<BankProgramSummary[]>([]);
  readonly loading = signal(false);
  readonly loadingPrograms = signal(false);

  readonly bankActiveControl = new FormControl<boolean>(true, { nonNullable: true });
  private readonly rowActiveControls = new Map<string, FormControl<boolean>>();

  private get bankId(): string {
    return this.route.snapshot.paramMap.get('bankId') ?? '';
  }

  /**
   * Programs grouped into the four constitution-locked categories (Principle II),
   * in canonical order. Any program whose category falls outside the four
   * (legacy / unknown) is surfaced in a trailing "Other" section rather than
   * silently hidden.
   */
  readonly categorySections = computed<ProgramSection[]>(() => {
    const ps = this.programs();
    const sections: ProgramSection[] = LOAN_CATEGORIES.map((cat) => ({
      cat,
      label: categoryLabel(cat),
      items: ps.filter((p) => p.productCategory === cat),
    }));
    const others = ps.filter((p) => !isLoanCategory(p.productCategory));
    if (others.length > 0) {
      sections.push({
        cat: 'other',
        label: $localize`:@@bank_detail.cat.other:Other`,
        items: others,
      });
    }
    return sections;
  });

  /** Query params for the per-section "Add program" link (scopes category). */
  addQueryParams(cat: LoanCategory | 'other'): Record<string, string> {
    const bankId = this.bank()?.id ?? '';
    return cat === 'other' ? { bankId } : { bankId, category: cat };
  }

  readonly stats = computed<StatStripItem[]>(() => {
    const ps = this.programs();
    const active = ps.filter((p) => p.active).length;
    const inactive = ps.length - active;
    return [
      { label: $localize`:@@bank_detail.stat.total:Total programs`, value: ps.length },
      { label: $localize`:@@bank_detail.stat.active:Active`, value: active, tone: 'success' },
      {
        label: $localize`:@@bank_detail.stat.inactive:Inactive`,
        value: inactive,
        tone: inactive > 0 ? 'warning' : 'muted',
      },
    ];
  });

  ngOnInit(): void {
    this.bankActiveControl.valueChanges.subscribe((next) => {
      const b = this.bank();
      if (b && next !== b.isActive) void this.onToggleBank(b, next);
    });
    void this.loadBank();
    void this.loadPrograms();
  }

  private async loadBank(): Promise<void> {
    this.loading.set(true);
    try {
      const res = await this.banksApi.getById(this.bankId);
      this.bank.set(res.data);
      this.bankActiveControl.setValue(res.data.isActive, { emitEvent: false });
    } catch (err) {
      this.handleError(err);
    } finally {
      this.loading.set(false);
    }
  }

  private async loadPrograms(): Promise<void> {
    this.loadingPrograms.set(true);
    try {
      const res = await this.banksApi.listPrograms(this.bankId);
      this.programs.set(res.data);
    } catch (err) {
      this.handleError(err);
    } finally {
      this.loadingPrograms.set(false);
    }
  }

  rowActiveControl(p: BankProgramSummary): FormControl<boolean> {
    let ctrl = this.rowActiveControls.get(p.programCode);
    if (!ctrl) {
      ctrl = new FormControl<boolean>(p.active, { nonNullable: true });
      this.rowActiveControls.set(p.programCode, ctrl);
      const code = p.programCode;
      ctrl.valueChanges.subscribe((next) => {
        const current = this.programs().find((r) => r.programCode === code);
        if (current && next !== current.active) void this.onToggleProgram(current, next);
      });
    } else if (ctrl.value !== p.active) {
      ctrl.setValue(p.active, { emitEvent: false });
    }
    return ctrl;
  }

  private async onToggleProgram(p: BankProgramSummary, active: boolean): Promise<void> {
    try {
      await this.programsApi.toggle(p.programCode, { active, version: p.version });
      void this.loadPrograms();
    } catch (err) {
      this.handleError(err);
      void this.loadPrograms();
    }
  }

  openEditBank(b: BankWithProgramCount): void {
    const ref = this.modal.create<
      BankFormDialog,
      BankFormDialogData,
      BankFormDialogResult | undefined
    >({
      nzContent: BankFormDialog,
      nzData: { mode: 'edit', bank: b },
      nzWidth: 560,
      nzFooter: null,
      nzAutofocus: null,
    });
    ref.afterClose.subscribe((res) => {
      if (res?.saved) void this.loadBank();
    });
  }

  async onToggleBank(b: BankWithProgramCount, isActive: boolean): Promise<void> {
    try {
      await this.banksApi.toggle(b.id, { version: b.version, isActive });
      this.message.success($localize`:@@banks.toggle.success:Bank updated.`);
      void this.loadBank();
    } catch (err) {
      this.handleError(err);
      void this.loadBank();
    }
  }

  onDeleteBank(b: BankWithProgramCount): void {
    if (b.programCount > 0) {
      this.message.warning(
        this.errors.toLocalizedMessage('BANK_HAS_PROGRAMS' as never, {
          programCount: b.programCount,
        }),
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
          await this.banksApi.remove(b.id);
          this.message.success($localize`:@@banks.delete.success:Bank deleted.`);
          void this.router.navigate(['/banks']);
        } catch (err) {
          this.handleError(err);
        }
      },
    });
  }

  openClone(p: BankProgramSummary): void {
    const ref = this.modal.create<
      CloneProgramDialog,
      CloneProgramDialogData,
      { newProgramCode?: string } | undefined
    >({
      nzContent: CloneProgramDialog,
      nzData: { sourceProgramCode: p.programCode, sourceFriendlyName: p.friendlyName },
      nzWidth: 440,
      nzFooter: null,
    });
    ref.afterClose.subscribe((res) => {
      if (res?.newProgramCode) {
        this.message.success($localize`:@@bank_programs.clone.success:Program cloned.`);
        void this.router.navigate(['/banks/programs', res.newProgramCode]);
      }
    });
  }

  openDelete(p: BankProgramSummary): void {
    const ref = this.modal.create<
      DeleteProgramDialog,
      DeleteProgramDialogData,
      boolean | undefined
    >({
      nzContent: DeleteProgramDialog,
      nzData: { programCode: p.programCode, friendlyName: p.friendlyName },
      nzWidth: 480,
      nzFooter: null,
    });
    ref.afterClose.subscribe((deleted) => {
      if (deleted) {
        void this.loadBank();
        void this.loadPrograms();
      }
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
