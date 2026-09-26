import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzIconModule, provideNzIconsPatch } from 'ng-zorro-antd/icon';
import { NzDrawerRef, NZ_DRAWER_DATA } from 'ng-zorro-antd/drawer';
import { CloseCircleOutline, TagsOutline } from '@ant-design/icons-angular/icons';
import { FormDrawerComponent } from '@shared/ui';
import { ErrorCodeService } from '@core/errors/error-code.service';
import type { ErrorCode } from '@core/auth/auth.types';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { LookupsApiService, type EnumerationRow } from '@features/lookups/lookups.api.service';
import { EnumerationTypesService } from './enumeration-types.service';
import { slugify, uniqueSlug } from './slug';

/** The I-Score classes lookup — the one type whose rows carry a score range. */
const I_SCORE_CLASS_TYPE = 'i_score_class';
const RANGE_VALIDATORS = [Validators.required, Validators.min(0), Validators.max(1000)];

/**
 * EVERY lookup type is edited by business name only: the machine key is derived
 * from the English label and never typed. Lookups are curated by non-technical
 * staff, who had no way to judge what a key should read, and a key typed by hand
 * is immutable the moment it is saved — a typo there outlived the value itself.
 *
 * Program names are EDITED here, never created: creating one is `/program-catalog/new`, a
 * screen that also offers it under its loan types and sets what their applicants are asked.
 * Edit is the two labels and the sort order — nothing else.
 *
 * NO INCOME BASIS, and no product link (v30.8.0). This sheet used to ask how the income is
 * proved, with a "Which surrogate product?" picker behind the Surrogate answer — so a name
 * made as income proof could be turned into a surrogate one here, which is exactly what the
 * create screen stopped offering. A surrogate program is code: its questions and its equation
 * for the income are written into the platform, and the names that sell one are put in with it
 * by the seeds. What a name is sold against is therefore stated once, where the name comes
 * from, and banks still choose per program (`bank_program.programType`); the catalog board
 * counts what they did.
 */
const PROGRAM_NAME_TYPE = 'program_name';

export interface EnumerationEditDrawerData {
  mode: 'create' | 'edit';
  type: string;
  row?: EnumerationRow;
  /** Overrides the generic sheet title — a screen that edits ONE kind names it. */
  title?: string;
  subtitle?: string;
  /** Same reason: "Add value" under a program-name list names the mechanism, not the thing. */
  submitLabel?: string;
}

@Component({
  selector: 'app-enumeration-edit-drawer',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    NzButtonModule,
    NzInputModule,
    NzFormModule,
    NzIconModule,
    NzSelectModule,
    FormDrawerComponent,
  ],
  providers: [provideNzIconsPatch([CloseCircleOutline, TagsOutline])],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-form-drawer
      [title]="drawerTitle"
      [subtitle]="drawerSubtitle"
      [submitLabel]="submitLabel"
      [submitDisabled]="!form.valid"
      [submitting]="submitting()"
      (cancelled)="cancel()"
      (submitted)="save()"
    >
      <span drawerIcon nz-icon nzType="tags" nzTheme="outline"></span>
      <form nz-form nzLayout="vertical" [formGroup]="form" class="form">
        <!-- One name in two locales is ONE decision, so the pair sits on one row:
             stacked, they read as two unrelated fields. -->
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

        @if (isIScoreClass) {
          <!-- The score range this I-Score class covers, inclusive at both ends. A pair on one
               row, like the two labels: one range, two ends. Not on the "No I-Score" class:
               it is the score nobody gave, and has no range to edit. -->
          @if (hasRange) {
            <div class="field-pair">
              <nz-form-item>
                <nz-form-label nzFor="lk-range-from" nzRequired i18n="@@lookups.field.rangeFrom"
                  >Lowest score</nz-form-label
                >
                <nz-form-control [nzErrorTip]="rangeTip">
                  <input
                    nz-input
                    id="lk-range-from"
                    type="number"
                    inputmode="numeric"
                    min="0"
                    max="1000"
                    formControlName="rangeFrom"
                  />
                </nz-form-control>
              </nz-form-item>
              <nz-form-item>
                <nz-form-label nzFor="lk-range-to" nzRequired i18n="@@lookups.field.rangeTo"
                  >Highest score</nz-form-label
                >
                <nz-form-control [nzErrorTip]="rangeTip">
                  <input
                    nz-input
                    id="lk-range-to"
                    type="number"
                    inputmode="numeric"
                    min="0"
                    max="1000"
                    formControlName="rangeTo"
                  />
                </nz-form-control>
              </nz-form-item>
            </div>
          }
          <nz-form-item>
            <nz-form-label nzFor="lk-income-pct" nzRequired i18n="@@lookups.field.incomePercent"
              >Share of the income counted</nz-form-label
            >
            <nz-form-control [nzErrorTip]="percentTip">
              <nz-input-group nzAddOnAfter="%">
                <input
                  nz-input
                  id="lk-income-pct"
                  type="number"
                  inputmode="decimal"
                  min="0"
                  max="300"
                  formControlName="incomePercent"
                />
              </nz-input-group>
              <p class="hint" i18n="@@lookups.field.incomePercent.hint">
                Every bank program that states no I-Score table of its own counts this share of the
                customer's income at this score. 100 counts it in full, 0 counts nothing and the
                program offers no loan.
              </p>
            </nz-form-control>
          </nz-form-item>
          @if (hasRange) {
            <p class="hint" i18n="@@lookups.field.range.hint">
              Both ends count: 701 to 750 means a score of 701 and a score of 750 are both in this
              class. A table already saved on a product or a bank program keeps its own ranges.
            </p>
          }
        }

        @if (parentType !== null) {
          <!-- The CLASS this row is priced in. REQUIRED, and that is a change: an unclassified
               compound is not a smaller offer, it is a compound the customer can pick and no
               bank can price: the derivation that reads it finds no matching row, which stops
               the rule. The server refuses it too, so leaving it optional here only moved the
               refusal from a field to a toast. -->
          <nz-form-item>
            <nz-form-label nzFor="lk-parent" nzRequired i18n="@@lookups.field.parentKey"
              >Filed under</nz-form-label
            >
            <nz-form-control [nzErrorTip]="parentRequiredTip">
              <nz-select
                id="lk-parent"
                formControlName="parentKey"
                [nzPlaceHolder]="parentPlaceholder"
              >
                @for (option of parentOptions(); track option.id) {
                  <nz-option
                    [nzValue]="option.key"
                    [nzLabel]="isAr ? option.labelAr : option.labelEn"
                  ></nz-option>
                }
              </nz-select>
              <p class="hint" i18n="@@lookups.field.parentKey.hint">
                Banks price this list by the class it is filed under. A value with no class gets no
                figures from those banks.
              </p>
            </nz-form-control>
          </nz-form-item>
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
    </app-form-drawer>
  `,
  styles: [
    `
      :host {
        display: block;
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
      .hint {
        margin-block: var(--space-1) 0;
        font-size: var(--text-sm);
        color: var(--text-muted);
      }
    `,
  ],
})
export class EnumerationEditDrawerComponent {
  private readonly api = inject(LookupsApiService);
  // Declared BEFORE `parentType` and the form below: both read it in a field initialiser,
  // and field initialisers run in source order.
  private readonly enumTypes = inject(EnumerationTypesService);
  private readonly errorCodes = inject(ErrorCodeService);
  private readonly drawerRef = inject(NzDrawerRef<EnumerationEditDrawerComponent, boolean>);
  protected readonly data = inject<EnumerationEditDrawerData>(NZ_DRAWER_DATA);

  private readonly isProgramName = this.data.type === PROGRAM_NAME_TYPE;
  /** An I-Score class: the one type whose rows carry a score range. */
  protected readonly isIScoreClass = this.data.type === I_SCORE_CLASS_TYPE;
  /**
   * Every class has a range except the seeded "No I-Score" one (the bureau's N/A). A NEW class
   * always has one — the N/A row is not something this form creates.
   */
  protected readonly hasRange =
    this.data.mode !== 'edit' || this.data.row?.rangeFrom != null || this.data.row?.rangeTo != null;
  protected readonly rangeTip = $localize`:@@lookups.field.range.required:Enter a whole score from 0 to 1000.`;
  protected readonly percentTip = $localize`:@@lookups.field.incomePercent.required:Enter a percentage from 0 to 300.`;
  /**
   * Types whose rows are FILED UNDER another list — the registry's generic single-parent
   * scope, read by a rule's `factParentTable` step.
   *
   * `compound` is the only one today: a customer picks one of hundreds of compounds by name,
   * and the bank keys its cap table by the five CLASSES. Without a class a row is invisible
   * to that derivation — the rule reports `no_matching_row` and the program quotes nothing
   * for whoever picked it — and until now this dialog could not set one, so every compound
   * an operator added was born classless.
   */
  protected readonly parentType: string | null = this.enumTypes.parentTypeOf(this.data.type);
  protected readonly parentOptions = signal<readonly EnumerationRow[]>([]);

  protected readonly parentPlaceholder = $localize`:@@lookups.field.parentKey.pick:Pick a class`;
  protected readonly parentRequiredTip = $localize`:@@lookups.field.parentKey.required:Pick the class this value is priced in.`;
  /** Arabic primary (Principle IV) — the same document read every other registry surface does. */
  protected readonly isAr = document.documentElement.lang.startsWith('ar');
  protected readonly isEdit = this.data.mode === 'edit';
  /** Label length cap — program names must fit the bank_program.friendlyName column (120). */
  protected readonly labelMax = this.isProgramName ? 120 : 160;

  /**
   * Placeholders are EXAMPLES OF THIS TYPE, not restated labels: one dialog serves
   * every enumeration, so "English label" alone never said whether the box wants a
   * governorate, a document type or a catalog product name. The examples live with
   * the type list, next to each type's own description.
   */
  // Stored on the KIND now, not in a per-type map here: a kind an operator invents can
  // carry its own example, and one that carries none falls back to a generic line rather
  // than to another type's example.
  protected readonly labelEnPlaceholder =
    this.enumTypes.example(this.data.type, false) ??
    $localize`:@@lookups.example.fallback.en:e.g. Salaried employee`;
  protected readonly labelArPlaceholder =
    this.enumTypes.example(this.data.type, true) ??
    $localize`:@@lookups.example.fallback.ar:مثال: موظف بمرتب`;

  /**
   * Sheet chrome. Defaults are generic because this form serves every registry list;
   * a screen that edits exactly one kind ("Add program name") passes its own words —
   * the title is the first thing read, and "Add new value" over a program-name list
   * names the mechanism instead of the thing.
   */
  protected readonly drawerTitle =
    this.data.title ??
    (this.isEdit
      ? $localize`:@@lookups.dialog.titleEdit:Edit value`
      : $localize`:@@lookups.dialog.titleCreate:Add new value`);
  protected readonly drawerSubtitle =
    this.data.subtitle ??
    (this.isEdit
      ? $localize`:@@lookups.drawer.subEdit:Renames it everywhere it is already used. Its key never changes.`
      : $localize`:@@lookups.drawer.subCreate:Adds one option to this list, ready to be picked wherever the list is used.`);
  protected readonly submitLabel =
    this.data.submitLabel ??
    (this.isEdit
      ? $localize`:@@lookups.dialog.save:Save`
      : $localize`:@@lookups.drawer.create:Add value`);

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
     * The class this row is priced in. REQUIRED for a type that has the axis, and validated
     * conditionally rather than always: this same dialog creates catalog program names, which
     * are filed under nothing at all, and a blanket `Validators.required` would make every
     * one of those unsavable.
     */
    parentKey: new FormControl<string>(this.data.row?.parentKey ?? '', {
      nonNullable: true,
      validators: this.enumTypes.parentTypeOf(this.data.type) ? [Validators.required] : [],
    }),
    rangeFrom: new FormControl<number | null>(this.data.row?.rangeFrom ?? null, {
      validators: this.isIScoreClass && this.hasRange ? RANGE_VALIDATORS : [],
    }),
    rangeTo: new FormControl<number | null>(this.data.row?.rangeTo ?? null, {
      validators: this.isIScoreClass && this.hasRange ? RANGE_VALIDATORS : [],
    }),
    incomePercent: new FormControl<number | null>(
      this.data.row?.incomePercent == null ? null : Number(this.data.row.incomePercent),
      {
        validators:
          this.data.type === I_SCORE_CLASS_TYPE
            ? [Validators.required, Validators.min(0), Validators.max(300)]
            : [],
      },
    ),
  });

  constructor() {
    // The parent list, loaded once. Only the ACTIVE rows are offered: filing a compound under
    // a retired class would be a save that quotes nothing, which is the failure this control
    // exists to prevent.
    if (this.parentType !== null) {
      void this.api
        .list(this.parentType)
        .then((rows) => this.parentOptions.set(rows.filter((r) => r.active)))
        .catch(() => this.parentOptions.set([]));
    }
  }

  cancel(): void {
    this.drawerRef.close(false);
  }

  async save(): Promise<void> {
    this.errorMessage.set(null);
    this.submitting.set(true);
    try {
      const v = this.form.getRawValue();
      const range = this.rangeOf(v.rangeFrom, v.rangeTo, v.incomePercent);
      if (range === 'invalid') {
        this.fail('VALIDATION_FAILED');
        return;
      }
      if (this.data.mode === 'create') {
        if (!slugify(v.labelEn)) {
          this.fail('VALIDATION_FAILED');
          return;
        }
        const key = await this.uniqueKey(v.labelEn);
        await this.api.create({
          type: this.data.type,
          key,
          labelEn: v.labelEn,
          labelAr: v.labelAr,
          // No income basis and no product link: the only type this form still CREATES
          // that has either axis is `program_name`, and that moved to its own screen.
          // Sent only for a type that HAS a parent axis, and only when one was picked — an
          // empty string is "unfiled", not a key.
          ...(this.parentType !== null && v.parentKey !== '' ? { parentKey: v.parentKey } : {}),
          ...range,
          sortOrder: v.sortOrder,
        });
      } else if (this.data.row) {
        // ONE write. The patch never carries `surrogateProductKey`, so a name's product link —
        // and with it what the name is sold against — is left exactly as the seeds wrote it.
        await this.api.update(this.data.row.id, {
          labelEn: v.labelEn,
          labelAr: v.labelAr,
          ...(this.parentType !== null && v.parentKey !== '' ? { parentKey: v.parentKey } : {}),
          ...range,
          sortOrder: v.sortOrder,
        });
      }
      this.drawerRef.close(true);
    } catch (err) {
      const code = (err as { error?: { code?: string } }).error?.code;
      this.fail(code ?? 'INTERNAL_ERROR');
    } finally {
      this.submitting.set(false);
    }
  }

  /**
   * The range to send: both ends, low to high, on an I-Score class; nothing on any other type.
   * `'invalid'` stops the save before the server refuses it — a range read backwards is a
   * class no score can fall in.
   */
  private rangeOf(
    from: number | null,
    to: number | null,
    percent: number | null,
  ): { rangeFrom?: number; rangeTo?: number; incomePercent?: string } | 'invalid' {
    if (!this.isIScoreClass) return {};
    if (percent === null || !Number.isFinite(percent) || percent < 0 || percent > 300) {
      return 'invalid';
    }
    // Up to four decimals, the column's scale — the server refuses more.
    const incomePercent = String(Math.round(percent * 1e4) / 1e4);
    // The "No I-Score" class: its percentage only, and no range is ever sent for it.
    if (!this.hasRange) return { incomePercent };
    if (from === null || to === null) return 'invalid';
    if (!Number.isInteger(from) || !Number.isInteger(to) || from > to) return 'invalid';
    return { rangeFrom: from, rangeTo: to, incomePercent };
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
  private async uniqueKey(label: string): Promise<string> {
    try {
      const taken = new Set((await this.api.list(this.data.type)).map((r) => r.key));
      return uniqueSlug(label, taken);
    } catch {
      // The list read is a courtesy — the server enforces the unique either way, and refusing
      // to save because a GET failed would be the worse answer.
      return slugify(label);
    }
  }
}
