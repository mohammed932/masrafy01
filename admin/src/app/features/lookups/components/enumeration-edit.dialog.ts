import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
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
  MinusOutline,
} from '@ant-design/icons-angular/icons';
import { ErrorCodeService } from '@core/errors/error-code.service';
import type { ErrorCode } from '@core/auth/auth.types';
import {
  INCOME_BASES,
  incomeBasisHint,
  incomeBasisLabel,
  type IncomeBasis,
} from '@core/income-basis';
import { categoryLabel, type LoanCategory } from '@core/loan-category';
import { LookupsApiService, type EnumerationRow } from '../lookups.api.service';
import { lookupExample } from '../lookups.constants';

/**
 * EVERY lookup type is edited by business name only: the machine key is derived
 * from the English label and never typed. Lookups are curated by non-technical
 * staff, who had no way to judge what a key should read, and a key typed by hand
 * is immutable the moment it is saved — a typo there outlived the value itself.
 *
 * Program names carry two extras. A new one starts offerable under all four loan
 * categories (the server's default) — narrowing that is a separate job on the
 * catalog's "Loan categories" tab. And the INCOME BASIS is asked here, nowhere
 * else at create time: it decides which bank programs may ever name this entry,
 * so a name created without it is a name the no-payslip half of the program
 * wizard cannot see. It used to be inferred later, from whether someone ticked a
 * surrogate fact on the detail screen — a screen the person adding the name had
 * no reason to open.
 */
const PROGRAM_NAME_TYPE = 'program_name';

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
      MinusOutline,
    ]),
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="dialog-body">
      <form nz-form nzLayout="vertical" [formGroup]="form" class="form">
        <!-- One name in two locales is ONE decision, so the pair sits on one row:
             stacked, they read as two unrelated fields and pushed the only real
             choice on this form (the basis) below the fold. -->
        <div class="field-pair">
          <nz-form-item>
            <nz-form-label nzFor="lk-label" nzRequired i18n="@@lookups.field.labelEnglish"
              >English label</nz-form-label
            >
            <nz-form-control [nzErrorTip]="labelErrTpl">
              <input
                nz-input
                id="lk-label"
                formControlName="labelEn"
                dir="ltr"
                [attr.maxlength]="labelMax"
                [placeholder]="labelEnPlaceholder"
              />
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
                [placeholder]="labelArPlaceholder"
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
               taken.

               The SAME two rows on edit, over the stored per-loan-type map. They were
               create-only, which meant the one product decision on this form could be
               made but never corrected here — and the operator who opened "Edit" to
               fix it found a label and a sort order. -->
          <section class="basis" role="group" aria-labelledby="lk-basis-heading">
            <h3 class="basis-heading" id="lk-basis-heading" i18n="@@lookups.field.incomeBasis">
              How do banks prove the income?
            </h3>
            <div class="basis-rows">
              @for (b of incomeBases; track b) {
                <!-- The accent is keyed off the basis itself, not the row's position:
                     the plum belongs to the no-payslip concept board-wide, and a
                     position-based rule would hand it to whatever lands there next. -->
                @let state = basisState(b);
                <label
                  class="basis-row"
                  [attr.data-basis]="b"
                  [class.is-on]="state === 'on'"
                  [class.is-mixed]="state === 'mixed'"
                >
                  <input
                    type="checkbox"
                    class="sr-only"
                    [checked]="state === 'on'"
                    [attr.aria-checked]="state === 'mixed' ? 'mixed' : state === 'on'"
                    (change)="toggleBasis(b)"
                  />
                  <span class="basis-tick" aria-hidden="true">
                    @if (state === 'on') {
                      <span nz-icon nzType="check" nzTheme="outline"></span>
                    } @else if (state === 'mixed') {
                      <span nz-icon nzType="minus" nzTheme="outline"></span>
                    }
                  </span>
                  <span class="basis-text">
                    <span class="basis-title">{{ basisLabel(b) }}</span>
                    <span class="basis-hint">{{ basisHint(b) }}</span>
                    <!-- A half-set row has to say WHICH loan types, or the dash is
                         just an unexplained third state. Ticking it turns the rest on. -->
                    @if (state === 'mixed') {
                      <span class="basis-mixed" i18n="@@lookups.field.incomeBasis.mixed"
                        >Set on {{ mixedCategoryNames(b) }} only — tick to set it everywhere.</span
                      >
                    }
                  </span>
                </label>
              }
            </div>
            @if (basisInvalid()) {
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
            } @else if (isEdit) {
              <p class="basis-note">
                <span nz-icon nzType="info-circle" nzTheme="outline" aria-hidden="true"></span>
                <span i18n="@@lookups.field.incomeBasis.noteEdit"
                  >Applies to every loan type this name is offered under ({{
                    assignedCategoryNames
                  }}). To set them apart, use the name’s own page.</span
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
        } @else if (isParkedName) {
          <!-- Not silence: the block is missing for a reason the operator can act on,
               and the basis is stored per loan type, so there is nowhere to put an
               answer until this name is offered somewhere. -->
          <p class="basis-note">
            <span nz-icon nzType="info-circle" nzTheme="outline" aria-hidden="true"></span>
            <span i18n="@@lookups.field.incomeBasis.parked"
              >This name isn’t offered under any loan type yet, so there’s nothing to sell it
              against. Pick its loan types on the name’s own page first.</span
            >
          </p>
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
          [disabled]="!form.valid || !canSave()"
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
      .basis-row.is-on .basis-tick,
      .basis-row.is-mixed .basis-tick {
        border-color: var(--basis-accent, var(--color-brand-primary));
        background: var(--basis-accent, var(--color-brand-primary));
      }
      /* Mixed borrows the accent edge but NOT the tinted fill: it is a state to
         resolve, not a state to rest in, and matching "on" exactly would let a
         half-set row read as done at a glance. */
      .basis-row.is-mixed {
        border-color: color-mix(
          in srgb,
          var(--basis-accent, var(--color-brand-primary)) 55%,
          var(--color-border-default)
        );
      }
      .basis-mixed {
        font-size: var(--text-xs);
        line-height: var(--line-height-base);
        font-weight: var(--font-weight-medium);
        color: var(--basis-accent, var(--color-brand-primary));
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

  private readonly isProgramName = this.data.type === PROGRAM_NAME_TYPE;
  protected readonly isEdit = this.data.mode === 'edit';
  /**
   * The loan types this name is currently offered under — the axis the basis is
   * actually stored on. `undefined` (a backend without the assignment endpoints)
   * is NOT the same as `[]` (parked, offered nowhere): the first means the screen
   * cannot know, the second that there is nothing to sell against.
   */
  private readonly categoriesKnown = this.data.row?.categories !== undefined;
  private readonly assignedCategories: LoanCategory[] = this.data.row?.categories ?? [];
  /**
   * Parked names still open this dialog — the operator gets a line saying why the
   * basis is missing rather than a block that silently is not there. Requires the
   * assignment to be KNOWN: against a backend without the endpoints every name
   * would otherwise be reported as parked.
   */
  protected readonly isParkedName =
    this.isProgramName && this.isEdit && this.categoriesKnown && this.assignedCategories.length === 0;
  /**
   * On CREATE one answer applies to every loan type the name starts under. On EDIT
   * the basis is already per loan type, so the same two rows read the stored map
   * and can land in a THIRD state — set on some loan types and not others — which
   * is why the row below is tri-state instead of a checkbox.
   */
  protected readonly asksBasis = this.isProgramName && !this.isParkedName;
  /** The CREATE-time single answer — the only mode where the form control is read. */
  private readonly asksFlatBasis = this.asksBasis && !this.isEdit;
  protected readonly incomeBases = INCOME_BASES;
  /** Names the loan types in the note, so "every loan type" is not an abstraction. */
  protected readonly assignedCategoryNames = this.assignedCategories
    .map((c) => categoryLabel(c))
    .join(this.listSeparator());

  /**
   * EDIT only — the working per-category map, seeded from the row and written back
   * one category at a time on save. Kept beside the form rather than inside it: the
   * form models one flat answer (what CREATE sends) and this models the real shape
   * of the stored data, and collapsing them would make the flat one authoritative.
   */
  private readonly initialBasisMap: Partial<Record<LoanCategory, IncomeBasis[]>> =
    Object.fromEntries(
      this.assignedCategories.map((c) => [
        c,
        // An assigned category always carries at least one basis server-side; the
        // fallback is for a row read from a backend that predates the column.
        [...(this.data.row?.incomeBasesByCategory?.[c] ?? ['payslip'])],
      ]),
    );
  protected readonly basisMap = signal<Partial<Record<LoanCategory, IncomeBasis[]>>>({
    ...this.initialBasisMap,
  });
  /** Label length cap — program names must fit the bank_program.friendlyName column (120). */
  protected readonly labelMax = this.isProgramName ? 120 : 160;

  /**
   * Placeholders are EXAMPLES OF THIS TYPE, not restated labels: one dialog serves
   * every enumeration, so "English label" alone never said whether the box wants a
   * governorate, a document type or a catalog product name. The examples live with
   * the type list, next to each type's own description.
   */
  private readonly example = lookupExample(this.data.type);
  protected readonly labelEnPlaceholder = this.example.en;
  protected readonly labelArPlaceholder = this.example.ar;

  protected readonly submitting = signal(false);
  /** Localized failure text — mapping goes through ErrorCodeService (Principle III, A22). */
  protected readonly errorMessage = signal<string | null>(null);

  protected readonly form = new FormGroup({
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
      validators: this.asksFlatBasis ? [Validators.required] : [],
    }),
  });

  /** EDIT only — the rows have been touched, so an empty basis may be reported. */
  private readonly basisTouched = signal(false);
  /**
   * EDIT only. Every offered loan type must keep at least one basis: a pair offered
   * under none is one no bank program could name, and the API refuses it.
   */
  private readonly basisMapValid = computed(() =>
    this.assignedCategories.every((c) => (this.basisMap()[c] ?? []).length > 0),
  );
  /**
   * A method, not a `computed`: the CREATE branch reads `touched`/`valid` off a
   * reactive-form control, which is not a signal, so a computed would latch the
   * first answer and the "pick at least one" line would never appear.
   */
  protected basisInvalid(): boolean {
    return this.isEdit
      ? this.basisTouched() && !this.basisMapValid()
      : this.form.controls.incomeBases.touched && !this.form.controls.incomeBases.valid;
  }
  /** Gates the primary alongside the reactive form, which does not model the map. */
  protected readonly canSave = computed(
    () => !this.submitting() && (!this.isEdit || !this.asksBasis || this.basisMapValid()),
  );

  protected basisLabel(basis: IncomeBasis): string {
    return incomeBasisLabel(basis);
  }

  protected basisHint(basis: IncomeBasis): string {
    return incomeBasisHint(basis);
  }

  /**
   * Tri-state. `mixed` exists only on EDIT and only because the basis is genuinely
   * stored per loan type — collapsing it to a plain tick would make the row lie
   * about a name sold one way as a personal loan and another as a car loan.
   */
  protected basisState(basis: IncomeBasis): 'on' | 'mixed' | 'off' {
    if (!this.isEdit) {
      return this.form.controls.incomeBases.value.includes(basis) ? 'on' : 'off';
    }
    const count = this.categoriesWith(basis).length;
    if (count === 0) return 'off';
    return count === this.assignedCategories.length ? 'on' : 'mixed';
  }

  /** Names the loan types a partly-set row IS on, so `mixed` says which ones. */
  protected mixedCategoryNames(basis: IncomeBasis): string {
    return this.categoriesWith(basis)
      .map((c) => categoryLabel(c))
      .join(this.listSeparator());
  }

  /**
   * Toggle one basis. Unticking the last one is ALLOWED and leaves the form
   * invalid, rather than being silently refused: a control that ignores a click
   * reads as broken, and the error line under the rows says what to do instead.
   *
   * On EDIT a `mixed` row resolves UP to "on everywhere". The other reading —
   * clearing it — would drop the loan types that already had it, which is the one
   * outcome an operator clicking a half-set row is certainly not asking for.
   */
  protected toggleBasis(basis: IncomeBasis): void {
    if (!this.isEdit) {
      const control = this.form.controls.incomeBases;
      const current = control.value;
      const next = current.includes(basis)
        ? current.filter((b) => b !== basis)
        : // Kept in INCOME_BASES order so the value does not depend on click order.
          INCOME_BASES.filter((b) => b === basis || current.includes(b));
      control.setValue([...next]);
      control.markAsTouched();
      return;
    }
    const turnOn = this.basisState(basis) !== 'on';
    this.basisMap.update((map) => {
      const next: Partial<Record<LoanCategory, IncomeBasis[]>> = { ...map };
      for (const category of this.assignedCategories) {
        const current = next[category] ?? [];
        next[category] = turnOn
          ? INCOME_BASES.filter((b) => b === basis || current.includes(b))
          : current.filter((b) => b !== basis);
      }
      return next;
    });
    this.basisTouched.set(true);
  }

  private categoriesWith(basis: IncomeBasis): LoanCategory[] {
    const map = this.basisMap();
    return this.assignedCategories.filter((c) => (map[c] ?? []).includes(basis));
  }

  /** Arabic separates a list with its own comma; a hardcoded ", " reads as Latin. */
  private listSeparator(): string {
    return $localize`:@@lookups.list.separator:, `;
  }

  /**
   * One PUT per loan type whose basis set moved. Sequential, not parallel: each is
   * a separate row the server validates on its own, and a rejected one should stop
   * the rest rather than race them into a partly-applied name.
   */
  private async saveBasisChanges(id: string): Promise<void> {
    if (!this.asksBasis || !this.isEdit) return;
    const map = this.basisMap();
    for (const category of this.assignedCategories) {
      const next = map[category] ?? [];
      // Both sides are held in INCOME_BASES order, so the join is a set compare.
      if (next.join('|') === (this.initialBasisMap[category] ?? []).join('|')) continue;
      await this.api.setIncomeBasis(id, category, next);
    }
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
        const base = this.slugify(v.labelEn);
        if (!base) {
          this.fail('VALIDATION_FAILED');
          return;
        }
        const key = await this.uniqueKey(base);
        await this.api.create({
          type: this.data.type,
          key,
          labelEn: v.labelEn,
          labelAr: v.labelAr,
          // Sent only where it means something. On the other ten enumeration types
          // the server drops it, and sending it anyway would put a field in the
          // request that the type has no axis for.
          ...(this.asksFlatBasis ? { incomeBases: v.incomeBases } : {}),
          sortOrder: v.sortOrder,
        });
      } else if (this.data.row) {
        // Basis FIRST, and only for the loan types whose set actually moved. It is
        // the write the server can refuse (an unoffered pair, an empty set), so
        // failing here leaves the row exactly as it was rather than half-saved with
        // a new label. Untouched rows send nothing at all, which is what keeps
        // editing a label from flattening a per-loan-type basis someone set on the
        // name's own page.
        await this.saveBasisChanges(this.data.row.id);
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

  /**
   * Free key for a derived slug: `salaried`, else `salaried_2`, `salaried_3`…
   *
   * Two values may legitimately share an English label (a renamed one, a
   * deprecated one), and the key is no longer typeable — so a raw
   * `ENUMERATION_KEY_DUPLICATE` here would name a field the operator never saw
   * and cannot edit. The server still enforces uniqueness; this only keeps the
   * ordinary case from surfacing as an unactionable error.
   */
  private async uniqueKey(base: string): Promise<string> {
    let taken: ReadonlySet<string>;
    try {
      taken = new Set((await this.api.list(this.data.type)).map((r) => r.key));
    } catch {
      return base;
    }
    if (!taken.has(base)) return base;
    for (let n = 2; n < 100; n++) {
      const suffix = `_${n}`;
      const candidate = `${base.slice(0, 64 - suffix.length)}${suffix}`;
      if (!taken.has(candidate)) return candidate;
    }
    return base;
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
