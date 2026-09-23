import {
  ChangeDetectionStrategy,
  Component,
  LOCALE_ID,
  computed,
  inject,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalRef, NZ_MODAL_DATA } from 'ng-zorro-antd/modal';
import { isLoanCategory } from '@core/loan-category';
import { ErrorCodeService } from '../../../core/errors/error-code.service';
import { PlatformEnumerationsService } from '../../../core/platform-enumerations/platform-enumerations.service';
import type { EnumerationMember } from '../../../core/platform-enumerations/platform-enumerations.types';
import { BankProgramsApiService } from '../bank-programs.api.service';
import type { BankProgramResponse } from '../bank-programs.types';

export interface DuplicateProgramDialogData {
  source: BankProgramResponse;
}

/**
 * Duplicate a program under a NAME OF ITS OWN.
 *
 * A bank sells one program per catalog name per loan type (`BANK_PROGRAM_NAME_TAKEN`), and a copy
 * lands at the same bank in the same loan type, so a copy that kept the source's name would be
 * refused. The operator picks the name up front instead, from the names this bank does not sell
 * yet — filed under the same income basis and, for a no-payslip source, quoting off the same
 * product, because the copy carries the source's income rule verbatim.
 *
 * Closes with the new program code, or `undefined` when cancelled.
 */
@Component({
  selector: 'app-duplicate-program-dialog',
  standalone: true,
  imports: [ReactiveFormsModule, NzFormModule, NzSelectModule, NzButtonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header class="dialog-header">
      <h2 class="dialog-title" i18n="@@bank_programs.duplicate.title">Duplicate this program</h2>
    </header>
    <div class="dialog-body">
      <p class="lead" i18n="@@bank_programs.duplicate.body">
        The copy is an inactive draft at the same bank and loan type, and needs a program name the
        bank does not sell yet.
      </p>
      <nz-form-item class="full">
        <nz-form-label
          [nzFor]="'duplicateName'"
          nzRequired
          i18n="@@bank_programs.duplicate.name_label"
          >Program name for the copy</nz-form-label
        >
        <nz-form-control>
          <nz-select
            id="duplicateName"
            nzShowSearch
            [formControl]="nameCtrl"
            [nzLoading]="loading()"
            [nzPlaceHolder]="placeholder"
            [nzNotFoundContent]="emptyLabel"
          >
            @for (opt of options(); track opt.value) {
              <nz-option [nzValue]="opt.value" [nzLabel]="opt.label"></nz-option>
            }
          </nz-select>
        </nz-form-control>
      </nz-form-item>
      @if (!loading() && options().length === 0) {
        <p class="empty" role="status" i18n="@@bank_programs.duplicate.none_free">
          This bank already sells every program name this one could be copied under. Edit an
          existing program instead.
        </p>
      }
    </div>
    <footer class="dialog-footer">
      <button
        nz-button
        type="button"
        (click)="cancel()"
        [disabled]="busy()"
        i18n="@@bank_programs.form.cancel"
      >
        Cancel
      </button>
      <button
        nz-button
        nzType="primary"
        type="button"
        (click)="submit()"
        [disabled]="!picked() || busy()"
        [nzLoading]="busy()"
        i18n="@@bank_programs.duplicate.cta"
      >
        Create copy
      </button>
    </footer>
  `,
  styles: [
    `
      .dialog-header {
        padding: var(--space-4) var(--space-4) 0;
      }
      .dialog-title {
        font-size: var(--text-lg);
        font-weight: var(--font-weight-semibold);
        margin: 0;
        color: var(--color-text-primary);
      }
      .dialog-body {
        padding: var(--space-3) var(--space-4) var(--space-4);
      }
      .lead {
        color: var(--color-text-secondary);
        margin-block: 0 var(--space-3);
      }
      .full {
        width: 100%;
        margin-block-end: 0;
      }
      .empty {
        margin-block: var(--space-3) 0;
        color: var(--color-text-secondary);
      }
      .dialog-footer {
        display: flex;
        justify-content: flex-end;
        gap: var(--space-2);
        padding: var(--space-3) var(--space-4);
        border-top: 1px solid var(--color-border-default);
      }
    `,
  ],
})
export class DuplicateProgramDialog {
  private readonly dialogRef = inject(NzModalRef<DuplicateProgramDialog, string | undefined>);
  private readonly api = inject(BankProgramsApiService);
  private readonly errors = inject(ErrorCodeService);
  private readonly message = inject(NzMessageService);
  private readonly isAr = inject(LOCALE_ID).toLowerCase().startsWith('ar');
  private readonly source = inject<DuplicateProgramDialogData>(NZ_MODAL_DATA).source;
  private readonly names = inject(PlatformEnumerationsService).membersFor('program_name');

  protected readonly placeholder = $localize`:@@bank_programs.field.friendly_name.placeholder:Select a program`;
  protected readonly emptyLabel = $localize`:@@bank_programs.duplicate.empty:No free program name`;

  protected readonly nameCtrl = new FormControl<string | null>(null, Validators.required);
  protected readonly picked = toSignal(this.nameCtrl.valueChanges, { initialValue: null });
  protected readonly loading = signal(true);
  protected readonly busy = signal(false);
  /** Names this bank already sells in the source's loan type — the source's own among them. */
  private readonly taken = signal<ReadonlySet<string>>(new Set());

  protected readonly options = computed(() => {
    const cat = this.source.productCategory;
    const noPayslip = this.source.programType === 'income_surrogate';
    const all = this.names();
    const sourceProduct =
      all.find((m) => m.key === this.source.programNameKey)?.surrogateProductKey ?? null;
    const taken = this.taken();
    return all
      .filter((m) => m.active && !m.deprecated && !taken.has(m.key))
      .filter((m) => !isLoanCategory(cat) || (m.categories ?? []).includes(cat))
      .filter((m) => this.sameBasis(m, noPayslip, sourceProduct))
      .map((m) => ({ value: m.key, label: this.isAr ? m.labelAr : m.labelEn }));
  });

  constructor() {
    void this.loadTaken();
  }

  /**
   * Filed under the source's basis for this loan type. A name the catalog has not settled
   * (no basis recorded) is offered either way, as the program form does. A no-payslip copy
   * stays on the product its income rule was built for.
   */
  private sameBasis(
    m: EnumerationMember,
    noPayslip: boolean,
    sourceProduct: string | null,
  ): boolean {
    if (noPayslip && sourceProduct !== null) return m.surrogateProductKey === sourceProduct;
    const cat = this.source.productCategory;
    const bases = isLoanCategory(cat) ? m.incomeBases?.[cat] : undefined;
    if (!bases || bases.length === 0) return true;
    return bases.includes(noPayslip ? 'no_payslip' : 'payslip');
  }

  private async loadTaken(): Promise<void> {
    try {
      const res = await this.api.list({
        bankName: this.source.bankName,
        productCategory: this.source.productCategory,
        pageSize: 100,
      });
      this.taken.set(
        new Set(res.data.flatMap((row) => (row.programNameKey ? [row.programNameKey] : []))),
      );
    } catch {
      // Offer the catalog as is; the API still refuses a taken name on submit.
    } finally {
      this.loading.set(false);
    }
  }

  cancel(): void {
    if (this.busy()) return;
    this.dialogRef.close(undefined);
  }

  async submit(): Promise<void> {
    const key = this.picked();
    if (!key || this.busy()) return;
    const member = this.names().find((m) => m.key === key);
    this.busy.set(true);
    try {
      // The copy takes the picked name's display names, the way the program form seeds them.
      const res = await this.api.duplicate(this.source.programCode, {
        programNameKey: key,
        friendlyName: member?.labelEn ?? key,
        ...(member?.labelAr ? { friendlyNameAr: member.labelAr } : {}),
      });
      this.dialogRef.close(res.data.programCode);
    } catch (err: unknown) {
      const code = (err as { error?: { code?: string } }).error?.code ?? 'INTERNAL_ERROR';
      this.message.error(this.errors.toLocalizedMessage(code as never));
    } finally {
      this.busy.set(false);
    }
  }
}
