import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzIconModule, provideNzIconsPatch } from 'ng-zorro-antd/icon';
import { NzModalRef, NZ_MODAL_DATA } from 'ng-zorro-antd/modal';
import {
  CheckOutline,
  CloseCircleOutline,
  ExclamationCircleOutline,
  InfoCircleOutline,
} from '@ant-design/icons-angular/icons';
import { ErrorCodeService } from '@core/errors/error-code.service';
import type { ErrorCode } from '@core/auth/auth.types';
import {
  INCOME_BASES,
  incomeBasisHint,
  incomeBasisLabel,
  type IncomeBasis,
} from '@core/income-basis';
import { LookupsApiService, type EnumerationRow } from '../lookups.api.service';

/**
 * Enumeration type edited by business name only: the dialog hides the machine-key
 * field and derives the key from the English label. Predefined program names are
 * curated by non-technical staff, and a new one starts offerable under all four
 * loan categories (the server's default) — narrowing that is a separate job on
 * the catalog's "Loan categories" tab.
 *
 * The INCOME BASIS is asked here, though, and nowhere else at create time: it
 * decides which bank programs may ever name this entry, so a name created without
 * it is a name the no-payslip half of the program wizard cannot see. It used to be
 * inferred later, from whether someone ticked a surrogate fact on the detail
 * screen — a screen the person adding the name had no reason to open.
 */
const AUTO_KEY_TYPE = 'program_name';

export interface EnumerationEditDialogData {
  mode: 'create' | 'edit';
  type: string;
  row?: EnumerationRow;
}

@Component({
  selector: 'app-enumeration-edit-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    NzButtonModule,
    NzInputModule,
    NzFormModule,
    NzIconModule,
  ],
  providers: [
    provideNzIconsPatch([
      CheckOutline,
      CloseCircleOutline,
      ExclamationCircleOutline,
      InfoCircleOutline,
    ]),
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="dialog-body">
      <form nz-form nzLayout="vertical" [formGroup]="form" class="form">
        @if (!autoKey) {
          <nz-form-item>
            <nz-form-label nzFor="lk-key" nzRequired i18n="@@lookups.field.key"
              >Key (machine-readable)</nz-form-label
            >
            <nz-form-control [nzErrorTip]="keyErrTpl" [nzExtra]="keyHintTpl">
              <input nz-input id="lk-key" formControlName="key" [readOnly]="data.mode === 'edit'" />
              <ng-template #keyErrTpl let-control>
                @if (control.errors?.['required']) {
                  <span i18n="@@lookups.field.key.required">Required</span>
                } @else if (control.errors?.['pattern']) {
                  <span i18n="@@lookups.field.key.pattern">Invalid format</span>
                }
              </ng-template>
              <ng-template #keyHintTpl>
                <span i18n="@@lookups.field.keyHint"
                  >letters, digits, underscore or hyphen only — used in API + database</span
                >
              </ng-template>
            </nz-form-control>
          </nz-form-item>
        }

        <!-- One name in two locales is ONE decision, so the pair sits on one row:
             stacked, they read as two unrelated fields and pushed the only real
             choice on this form (the basis) below the fold. -->
        <div class="field-pair">
          <nz-form-item>
            <nz-form-label nzFor="lk-label" nzRequired i18n="@@lookups.field.labelEnglish"
              >English label</nz-form-label
            >
            <nz-form-control [nzErrorTip]="labelErrTpl">
              <input nz-input id="lk-label" formControlName="labelEn" [attr.maxlength]="labelMax" />
              <ng-template #labelErrTpl let-control>
                @if (control.errors?.['required']) {
                  <span i18n="@@lookups.field.label.required">Required</span>
                }
              </ng-template>
            </nz-form-control>
          </nz-form-item>

          <nz-form-item>
            <nz-form-label nzFor="lk-label-ar" nzRequired i18n="@@lookups.field.labelAr"
              >Arabic label</nz-form-label
            >
            <nz-form-control [nzErrorTip]="labelArErrTpl">
              <input
                nz-input
                id="lk-label-ar"
                formControlName="labelAr"
                dir="rtl"
                [attr.maxlength]="labelMax"
              />
              <ng-template #labelArErrTpl let-control>
                @if (control.errors?.['required']) {
                  <span i18n="@@lookups.field.labelAr.required">Required</span>
                }
              </ng-template>
            </nz-form-control>
          </nz-form-item>
        </div>

        @if (asksBasis) {
          <!-- Two tickable rows, not a select and not radios: a name can be sold BOTH
               ways (one bank reads a payslip, another works the income out), which is
               the reason the platform has no separate no-payslip product. A radio pair
               would force whoever adds the name to pick a side the business has not
               taken. -->
          <section class="basis" role="group" aria-labelledby="lk-basis-heading">
            <h3 class="basis-heading" id="lk-basis-heading" i18n="@@lookups.field.incomeBasis">
              How do banks prove the income?
            </h3>
            <div class="basis-rows">
              @for (b of incomeBases; track b) {
                <!-- The accent is keyed off the basis itself, not the row's position:
                     the plum belongs to the no-payslip concept board-wide, and a
                     position-based rule would hand it to whatever lands there next. -->
                <label class="basis-row" [attr.data-basis]="b" [class.is-on]="isBasisOn(b)">
                  <input
                    type="checkbox"
                    class="sr-only"
                    [checked]="isBasisOn(b)"
                    (change)="toggleBasis(b)"
                  />
                  <span class="basis-tick" aria-hidden="true">
                    @if (isBasisOn(b)) {
                      <span nz-icon nzType="check" nzTheme="outline"></span>
                    }
                  </span>
                  <span class="basis-text">
                    <span class="basis-title">{{ basisLabel(b) }}</span>
                    <span class="basis-hint">{{ basisHint(b) }}</span>
                  </span>
                </label>
              }
            </div>
            @if (form.controls.incomeBases.touched && !form.controls.incomeBases.valid) {
              <p class="basis-error" role="alert">
                <span
                  nz-icon
                  nzType="exclamation-circle"
                  nzTheme="outline"
                  aria-hidden="true"
                ></span>
                <span i18n="@@lookups.field.incomeBasis.required"
                  >Pick at least one — a name banks cannot sell either way is a name no program can
                  use.</span
                >
              </p>
            } @else {
              <p class="basis-note">
                <span nz-icon nzType="info-circle" nzTheme="outline" aria-hidden="true"></span>
                <span i18n="@@lookups.field.incomeBasis.note"
                  >Applies to every loan type this name starts under. Change it per loan type later,
                  on the name's own page.</span
                >
              </p>
            }
          </section>
        }

        <nz-form-item class="sort-item">
          <nz-form-label nzFor="lk-sort" i18n="@@lookups.field.sortOrder">Sort order</nz-form-label>
          <nz-form-control [nzExtra]="sortHintTpl">
            <input nz-input id="lk-sort" type="number" formControlName="sortOrder" min="0" />
            <ng-template #sortHintTpl>
              <span i18n="@@lookups.field.sortOrderHint">controls the order in dropdowns</span>
            </ng-template>
          </nz-form-control>
        </nz-form-item>

        @if (errorMessage(); as message) {
          <p class="error" role="alert">
            <span nz-icon nzType="close-circle" nzTheme="outline" aria-hidden="true"></span>
            <span>{{ message }}</span>
          </p>
        }
      </form>

      <div class="dialog-actions">
        <button
          nz-button
          nzType="default"
          type="button"
          (click)="cancel()"
          i18n="@@lookups.dialog.cancel"
        >
          Cancel
        </button>
        <button
          nz-button
          nzType="primary"
          type="button"
          (click)="save()"
          [disabled]="!form.valid || submitting()"
          [nzLoading]="submitting()"
          i18n="@@lookups.dialog.save"
        >
          Save
        </button>
      </div>
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
      }
      .dialog-body {
        display: flex;
        flex-direction: column;
        gap: var(--space-5);
      }
      /* ONE rhythm for the whole form. antd ships every nz-form-item with its own
         24px bottom margin, which stacked against the section margins and left a
         different gap above and below each block. Zero them, own the gap here. */
      .form {
        display: grid;
        gap: var(--space-5);
        margin: 0;
      }
      .form nz-form-item {
        margin-block-end: 0;
      }
      .field-pair {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
        gap: var(--space-4);
        align-items: start;
      }
      /* A sort order is one or two digits; a 560px-wide box for it made the least
         important field on the form the widest thing on it. */
      .sort-item {
        max-inline-size: 240px;
      }
      /* Visually hidden, still focusable + announced — the real control behind each
         tickable row. */
      .sr-only {
        position: absolute;
        inline-size: 1px;
        block-size: 1px;
        padding: 0;
        margin: -1px;
        overflow: hidden;
        clip-path: inset(50%);
        white-space: nowrap;
        border: 0;
      }
      /* The income basis is the one product decision on this form — the two label
         fields above it are transcription. Weight comes from the tiles and the
         heading, not from rules: this was a fieldset, and a <legend> renders INSIDE
         the top border, so the border ran off to the right of the question like a
         stray hairline. No divider survives in the body. */
      .basis {
        display: grid;
        gap: var(--space-3);
        min-inline-size: 0;
      }
      .basis-heading {
        margin: 0;
        font-size: var(--text-sm);
        font-weight: var(--font-weight-semibold);
        line-height: var(--line-height-tight);
        letter-spacing: var(--tracking-tight);
        color: var(--color-text-primary);
      }
      .basis-rows {
        display: grid;
        gap: var(--space-2);
      }
      .basis-row {
        display: flex;
        align-items: flex-start;
        gap: var(--space-3);
        padding: var(--space-3) var(--space-4);
        border: 1px solid var(--color-border-default);
        border-radius: var(--radius-lg);
        /* Filled like the inputs above it — on the dialog's near-white body an
           unfilled tile reads as a caption block, not something you can tick. */
        background: var(--color-surface-elevated);
        cursor: pointer;
        transition:
          border-color var(--motion-duration-fast) var(--motion-easing-standard),
          background-color var(--motion-duration-fast) var(--motion-easing-standard),
          box-shadow var(--motion-duration-fast) var(--motion-easing-standard);
      }
      .basis-row:hover:not(.is-on) {
        border-color: var(--color-border-strong);
        background: var(--color-surface-default);
      }
      /* On the LABEL: the visible row is what the operator perceives as focused,
         the input inside it is 1px and hidden. */
      .basis-row:focus-within {
        outline: var(--focus-ring-width) solid var(--color-border-focus);
        outline-offset: var(--focus-ring-offset);
      }
      /* Selected: accent edge doubled by an inset ring rather than a 2px border —
         a thicker border would reflow the text by a pixel on every tick. */
      .basis-row.is-on {
        border-color: var(--basis-accent, var(--color-brand-primary));
        background: color-mix(
          in srgb,
          var(--basis-accent, var(--color-brand-primary)) 6%,
          var(--color-surface-default)
        );
        box-shadow: inset 0 0 0 1px
          color-mix(in srgb, var(--basis-accent, var(--color-brand-primary)) 45%, transparent);
      }
      /* The no-payslip row carries the colour this concept owns board-wide, so the
         choice made here matches the chip on the catalog and in the program wizard. */
      .basis-row[data-basis='no_payslip'] {
        --basis-accent: var(--color-income-surrogate);
      }
      .basis-tick {
        flex: none;
        display: grid;
        place-items: center;
        inline-size: 20px;
        block-size: 20px;
        /* Optical centring on the title's cap height, not on its line box. */
        margin-block-start: 1px;
        border: 1.5px solid var(--color-border-strong);
        border-radius: var(--radius-sm);
        font-size: var(--text-xs);
        color: var(--text-inverse);
        transition:
          border-color var(--motion-duration-fast) var(--motion-easing-standard),
          background-color var(--motion-duration-fast) var(--motion-easing-standard);
      }
      .basis-row.is-on .basis-tick {
        border-color: var(--basis-accent, var(--color-brand-primary));
        background: var(--basis-accent, var(--color-brand-primary));
      }
      .basis-text {
        display: flex;
        flex-direction: column;
        gap: var(--space-1);
      }
      .basis-title {
        font-size: var(--text-sm);
        font-weight: var(--font-weight-semibold);
        line-height: var(--line-height-tight);
        color: var(--color-text-primary);
      }
      .basis-hint {
        font-size: var(--text-xs);
        line-height: var(--line-height-base);
        color: var(--color-text-secondary);
        /* Measure cap: the no-payslip hint ran the full 560px dialog width, ~95
           characters a line, and read as a paragraph instead of a caption. */
        max-inline-size: 58ch;
      }
      .basis-note,
      .basis-error {
        display: flex;
        align-items: flex-start;
        gap: var(--space-2);
        margin: 0;
        font-size: var(--text-xs);
        line-height: var(--line-height-base);
        max-inline-size: 62ch;
      }
      .basis-note {
        color: var(--color-text-tertiary);
      }
      .basis-error {
        color: var(--color-error);
      }
      .basis-note [nz-icon],
      .basis-error [nz-icon] {
        flex: none;
        margin-block-start: 2px;
      }
      @media (prefers-reduced-motion: reduce) {
        .basis-row,
        .basis-tick {
          transition: none;
        }
      }
      .error {
        background: var(--color-error-bg);
        color: var(--color-error);
        border-radius: var(--radius-md);
        padding: var(--space-2) var(--space-3);
        margin: 0;
        display: inline-flex;
        gap: var(--space-2);
        align-items: center;
        font-size: var(--text-sm);
      }
      .dialog-actions {
        display: flex;
        justify-content: flex-end;
        gap: var(--space-2);
        padding-block-start: var(--space-4);
        border-block-start: 1px solid var(--border-subtle);
      }
    `,
  ],
})
export class EnumerationEditDialogComponent {
  private readonly api = inject(LookupsApiService);
  private readonly errorCodes = inject(ErrorCodeService);
  private readonly dialogRef = inject(NzModalRef<EnumerationEditDialogComponent, boolean>);
  protected readonly data = inject<EnumerationEditDialogData>(NZ_MODAL_DATA);

  /** True for program names: no machine-key field, key derived from the English label. */
  protected readonly autoKey = this.data.type === AUTO_KEY_TYPE;
  /**
   * Only on CREATE. Editing a name reaches this dialog from the catalog list to fix
   * a label or a sort order; the basis by then is per loan type, and one control
   * here could only overwrite all four tabs with a single answer.
   */
  protected readonly asksBasis = this.autoKey && this.data.mode === 'create';
  protected readonly incomeBases = INCOME_BASES;
  /** Label length cap — program names must fit the bank_program.friendlyName column (120). */
  protected readonly labelMax = this.autoKey ? 120 : 160;

  protected readonly submitting = signal(false);
  /** Localized failure text — mapping goes through ErrorCodeService (Principle III, A22). */
  protected readonly errorMessage = signal<string | null>(null);

  protected readonly form = new FormGroup({
    key: new FormControl<string>(this.data.row?.key ?? '', {
      nonNullable: true,
      validators: this.autoKey
        ? []
        : [Validators.required, Validators.pattern(/^[A-Za-z0-9][A-Za-z0-9_-]*$/)],
    }),
    labelEn: new FormControl<string>(this.data.row?.labelEn ?? '', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(this.labelMax)],
    }),
    labelAr: new FormControl<string>(this.data.row?.labelAr ?? '', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(this.labelMax)],
    }),
    sortOrder: new FormControl<number>(this.data.row?.sortOrder ?? 0, {
      nonNullable: true,
      validators: [Validators.min(0)],
    }),
    /**
     * Defaults to "reads a payslip" — the ordinary case, and what every name meant
     * before the basis was recorded, so an operator who does not touch this row
     * creates the name they used to create. `Validators.required` rejects `[]` on
     * an array control, which is the only invalid state here.
     */
    incomeBases: new FormControl<IncomeBasis[]>(['payslip'], {
      nonNullable: true,
      validators: this.asksBasis ? [Validators.required] : [],
    }),
  });

  protected basisLabel(basis: IncomeBasis): string {
    return incomeBasisLabel(basis);
  }

  protected basisHint(basis: IncomeBasis): string {
    return incomeBasisHint(basis);
  }

  protected isBasisOn(basis: IncomeBasis): boolean {
    return this.form.controls.incomeBases.value.includes(basis);
  }

  /**
   * Toggle one basis. Unticking the last one is ALLOWED and leaves the form
   * invalid, rather than being silently refused: a control that ignores a click
   * reads as broken, and the error line under the rows says what to do instead.
   */
  protected toggleBasis(basis: IncomeBasis): void {
    const control = this.form.controls.incomeBases;
    const current = control.value;
    const next = current.includes(basis)
      ? current.filter((b) => b !== basis)
      : // Kept in INCOME_BASES order so the value does not depend on click order.
        INCOME_BASES.filter((b) => b === basis || current.includes(b));
    control.setValue([...next]);
    control.markAsTouched();
  }

  cancel(): void {
    this.dialogRef.close(false);
  }

  async save(): Promise<void> {
    this.errorMessage.set(null);
    this.submitting.set(true);
    try {
      const v = this.form.getRawValue();
      if (this.data.mode === 'create') {
        const key = this.autoKey ? this.slugify(v.labelEn) : v.key;
        if (!key) {
          this.fail('VALIDATION_FAILED');
          return;
        }
        await this.api.create({
          type: this.data.type,
          key,
          labelEn: v.labelEn,
          labelAr: v.labelAr,
          // Sent only where it means something. On the other ten enumeration types
          // the server drops it, and sending it anyway would put a field in the
          // request that the type has no axis for.
          ...(this.asksBasis ? { incomeBases: v.incomeBases } : {}),
          sortOrder: v.sortOrder,
        });
      } else if (this.data.row) {
        await this.api.update(this.data.row.id, {
          labelEn: v.labelEn,
          labelAr: v.labelAr,
          sortOrder: v.sortOrder,
        });
      }
      this.dialogRef.close(true);
    } catch (err) {
      const code = (err as { error?: { code?: string } }).error?.code;
      this.fail(code ?? 'INTERNAL_ERROR');
    } finally {
      this.submitting.set(false);
    }
  }

  private fail(code: string): void {
    this.errorMessage.set(this.errorCodes.toLocalizedMessage(code as ErrorCode));
  }

  /** Machine key derived from an English label — lowercase, non-alnum → `_`, trimmed, ≤64. */
  private slugify(s: string): string {
    return s
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 64);
  }
}
