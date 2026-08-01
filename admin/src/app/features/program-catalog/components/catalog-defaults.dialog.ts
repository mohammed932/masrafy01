import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCheckboxModule } from 'ng-zorro-antd/checkbox';
import { NzIconModule, provideNzIconsPatch } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzModalRef, NZ_MODAL_DATA } from 'ng-zorro-antd/modal';
import { NzTabsModule } from 'ng-zorro-antd/tabs';
import { NzToolTipModule } from 'ng-zorro-antd/tooltip';
import { InfoCircleOutline, LoadingOutline } from '@ant-design/icons-angular/icons';
import { categoryLabel, isLoanCategory } from '@core/loan-category';
import { DbrBandsEditorComponent } from '@shared/ui';
import type { DbrBand, ProgramDefaults } from '../../bank-programs/bank-programs.types';
import { LookupsApiService } from '../../lookups/lookups.api.service';

export interface CatalogDefaultsDialogData {
  /** `program_name` enumeration key, e.g. `doctor`. */
  key: string;
  labelEn: string;
  labelAr: string;
  /** Loan categories this predefined program serves. One tab each. */
  categories: string[];
}

/**
 * Per-category defaults form model. Every field is a string so an empty input
 * round-trips as "not set" rather than as `0` — a zero rate is a real value and
 * must never be produced by an admin simply skipping the field (FR-003).
 */
interface CategoryForm {
  minMonths: string;
  maxMonths: string;
  minAmount: string;
  maxAmount: string;
  ratePercent: string;
  isVariableRate: boolean;
  ageMin: string;
  ageMax: string;
  minMonthlyIncomeEGP: string;
  dbrCapPercent: string;
  dbrBands: DbrBand[];
  skipDbrCheck: boolean;
  requiresCollateral: boolean;
  adminFeePercent: string;
  stampDutyPercent: string;
  lifeInsurancePercent: string;
}

const EMPTY_FORM: CategoryForm = {
  minMonths: '',
  maxMonths: '',
  minAmount: '',
  maxAmount: '',
  ratePercent: '',
  isVariableRate: false,
  ageMin: '',
  ageMax: '',
  minMonthlyIncomeEGP: '',
  dbrCapPercent: '',
  dbrBands: [],
  skipDbrCheck: false,
  requiresCollateral: false,
  adminFeePercent: '',
  stampDutyPercent: '',
  lifeInsurancePercent: '',
};

/**
 * Catalog defaults editor (FR-001 … FR-004, FR-021a).
 *
 * Sets the reusable lending values a predefined program contributes as PREFILL
 * when an admin creates a bank program under one of its categories. One tab per
 * served category; every field optional.
 *
 * These values are copied into the program on save and never re-resolved
 * (FR-009), so editing them here leaves every already-saved program untouched
 * (FR-007 / SC-008). The dialog says so explicitly, because "will this reprice
 * live programs?" is the first question an operator asks.
 */
@Component({
  selector: 'app-catalog-defaults-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    NzButtonModule,
    NzCheckboxModule,
    NzIconModule,
    NzInputModule,
    NzTabsModule,
    NzToolTipModule,
    DbrBandsEditorComponent,
  ],
  providers: [provideNzIconsPatch([InfoCircleOutline, LoadingOutline])],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="dialog">
      <header class="dialog__head">
        <h2 class="dialog__title">
          <span i18n="@@catalogDefaults.title">Default lending values</span>
          <span class="dialog__program">{{ data.labelEn }}</span>
        </h2>
        <p class="dialog__note">
          <span nz-icon nzType="info-circle" nzTheme="outline" aria-hidden="true"></span>
          <span i18n="@@catalogDefaults.prefillOnly">
            These are starting values only. They pre-fill a new bank program and are copied into
            it on save — changing them here never alters a program that already exists.
          </span>
        </p>
      </header>

      @if (loading()) {
        <p class="dialog__loading">
          <span nz-icon nzType="loading" nzTheme="outline" aria-hidden="true"></span>
          <span i18n="@@catalogDefaults.loading">Loading defaults…</span>
        </p>
      } @else {
        <nz-tabset [(nzSelectedIndex)]="activeTab" nzSize="small">
          @for (category of data.categories; track category) {
            <nz-tab [nzTitle]="tabTitle(category)">
              @if (formFor(category); as f) {
                <div class="grid">
                  <div class="grid__pair">
                    <label class="field">
                      <span class="field__label" i18n="@@catalogDefaults.rate">Interest rate %</span>
                      <input
                        nz-input
                        type="text"
                        inputmode="decimal"
                        class="field__input field__input--num"
                        placeholder="24.0000"
                        [ngModel]="f.ratePercent"
                        (ngModelChange)="patch(category, { ratePercent: $event })"
                        [ngModelOptions]="{ standalone: true }"
                      />
                    </label>
                    <label class="field field--check">
                      <label
                        nz-checkbox
                        [ngModel]="f.isVariableRate"
                        (ngModelChange)="patch(category, { isVariableRate: $event })"
                        [ngModelOptions]="{ standalone: true }"
                      >
                        <span i18n="@@catalogDefaults.variableRate">Variable rate</span>
                      </label>
                    </label>
                  </div>

                  <fieldset class="range">
                    <legend class="field__label" i18n="@@catalogDefaults.tenor">
                      Tenor (months)
                    </legend>
                    <div class="range__row">
                      <input
                        nz-input
                        type="text"
                        inputmode="numeric"
                        class="field__input field__input--num"
                        placeholder="12"
                        [attr.aria-label]="minLabel"
                        [ngModel]="f.minMonths"
                        (ngModelChange)="patch(category, { minMonths: $event })"
                        [ngModelOptions]="{ standalone: true }"
                      />
                      <span class="range__sep" aria-hidden="true">–</span>
                      <input
                        nz-input
                        type="text"
                        inputmode="numeric"
                        class="field__input field__input--num"
                        placeholder="60"
                        [attr.aria-label]="maxLabel"
                        [ngModel]="f.maxMonths"
                        (ngModelChange)="patch(category, { maxMonths: $event })"
                        [ngModelOptions]="{ standalone: true }"
                      />
                    </div>
                  </fieldset>

                  <fieldset class="range">
                    <legend class="field__label" i18n="@@catalogDefaults.amount">
                      Loan amount (EGP)
                    </legend>
                    <div class="range__row">
                      <input
                        nz-input
                        type="text"
                        inputmode="decimal"
                        class="field__input field__input--num"
                        placeholder="20000.00"
                        [attr.aria-label]="minLabel"
                        [ngModel]="f.minAmount"
                        (ngModelChange)="patch(category, { minAmount: $event })"
                        [ngModelOptions]="{ standalone: true }"
                      />
                      <span class="range__sep" aria-hidden="true">–</span>
                      <input
                        nz-input
                        type="text"
                        inputmode="decimal"
                        class="field__input field__input--num"
                        placeholder="1000000.00"
                        [attr.aria-label]="maxLabel"
                        [ngModel]="f.maxAmount"
                        (ngModelChange)="patch(category, { maxAmount: $event })"
                        [ngModelOptions]="{ standalone: true }"
                      />
                    </div>
                  </fieldset>

                  <fieldset class="range">
                    <legend class="field__label" i18n="@@catalogDefaults.age">Age range</legend>
                    <div class="range__row">
                      <input
                        nz-input
                        type="text"
                        inputmode="numeric"
                        class="field__input field__input--num"
                        placeholder="21"
                        [attr.aria-label]="minLabel"
                        [ngModel]="f.ageMin"
                        (ngModelChange)="patch(category, { ageMin: $event })"
                        [ngModelOptions]="{ standalone: true }"
                      />
                      <span class="range__sep" aria-hidden="true">–</span>
                      <input
                        nz-input
                        type="text"
                        inputmode="numeric"
                        class="field__input field__input--num"
                        placeholder="60"
                        [attr.aria-label]="maxLabel"
                        [ngModel]="f.ageMax"
                        (ngModelChange)="patch(category, { ageMax: $event })"
                        [ngModelOptions]="{ standalone: true }"
                      />
                    </div>
                  </fieldset>

                  <label class="field">
                    <span class="field__label" i18n="@@catalogDefaults.minIncome"
                      >Minimum monthly income (EGP)</span
                    >
                    <input
                      nz-input
                      type="text"
                      inputmode="decimal"
                      class="field__input field__input--num"
                      placeholder="8000.00"
                      [ngModel]="f.minMonthlyIncomeEGP"
                      (ngModelChange)="patch(category, { minMonthlyIncomeEGP: $event })"
                      [ngModelOptions]="{ standalone: true }"
                    />
                  </label>

                  <div class="grid__pair">
                    <label class="field">
                      <span class="field__label" i18n="@@catalogDefaults.dbrCap">DBR cap %</span>
                      <input
                        nz-input
                        type="text"
                        inputmode="decimal"
                        class="field__input field__input--num"
                        placeholder="50.0000"
                        [ngModel]="f.dbrCapPercent"
                        (ngModelChange)="patch(category, { dbrCapPercent: $event })"
                        [ngModelOptions]="{ standalone: true }"
                      />
                    </label>
                    <label class="field field--check">
                      <label
                        nz-checkbox
                        [ngModel]="f.skipDbrCheck"
                        (ngModelChange)="patch(category, { skipDbrCheck: $event })"
                        [ngModelOptions]="{ standalone: true }"
                      >
                        <span i18n="@@catalogDefaults.skipDbr">Skip DBR check</span>
                      </label>
                    </label>
                  </div>

                  <div class="grid__full">
                    <app-dbr-bands-editor
                      [bands]="f.dbrBands"
                      (bandsChange)="patch(category, { dbrBands: $event })"
                      [flatCapPercent]="f.dbrCapPercent || '50.0000'"
                    />
                  </div>

                  <div class="grid__pair">
                    <label class="field">
                      <span class="field__label" i18n="@@catalogDefaults.adminFee"
                        >Admin fee %</span
                      >
                      <input
                        nz-input
                        type="text"
                        inputmode="decimal"
                        class="field__input field__input--num"
                        placeholder="1.0000"
                        [ngModel]="f.adminFeePercent"
                        (ngModelChange)="patch(category, { adminFeePercent: $event })"
                        [ngModelOptions]="{ standalone: true }"
                      />
                    </label>
                    <label class="field">
                      <span class="field__label" i18n="@@catalogDefaults.stampDuty"
                        >Stamp duty %</span
                      >
                      <input
                        nz-input
                        type="text"
                        inputmode="decimal"
                        class="field__input field__input--num"
                        placeholder="0.5000"
                        [ngModel]="f.stampDutyPercent"
                        (ngModelChange)="patch(category, { stampDutyPercent: $event })"
                        [ngModelOptions]="{ standalone: true }"
                      />
                    </label>
                  </div>

                  <div class="grid__pair">
                    <label class="field">
                      <span class="field__label" i18n="@@catalogDefaults.lifeInsurance"
                        >Life insurance %</span
                      >
                      <input
                        nz-input
                        type="text"
                        inputmode="decimal"
                        class="field__input field__input--num"
                        placeholder="0.5000"
                        [ngModel]="f.lifeInsurancePercent"
                        (ngModelChange)="patch(category, { lifeInsurancePercent: $event })"
                        [ngModelOptions]="{ standalone: true }"
                      />
                    </label>
                    <label class="field field--check">
                      <label
                        nz-checkbox
                        [ngModel]="f.requiresCollateral"
                        (ngModelChange)="patch(category, { requiresCollateral: $event })"
                        [ngModelOptions]="{ standalone: true }"
                      >
                        <span i18n="@@catalogDefaults.requiresCollateral"
                          >Requires collateral</span
                        >
                      </label>
                    </label>
                  </div>

                  <div class="grid__full">
                    <button
                      nz-button
                      nzType="text"
                      nzDanger
                      type="button"
                      class="clear"
                      (click)="clearCategory(category)"
                    >
                      <span i18n="@@catalogDefaults.clearCategory"
                        >Clear defaults for this loan type</span
                      >
                    </button>
                  </div>
                </div>
              }
            </nz-tab>
          }
        </nz-tabset>
      }

      <footer class="dialog__foot">
        <button nz-button nzType="default" type="button" (click)="cancel()">
          <span i18n="@@common.cancel">Cancel</span>
        </button>
        <button
          nz-button
          nzType="primary"
          type="button"
          [nzLoading]="saving()"
          [disabled]="loading() || saving()"
          (click)="save()"
        >
          <span i18n="@@catalogDefaults.save">Save defaults</span>
        </button>
      </footer>
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
      }

      .dialog__head {
        margin-block-end: var(--space-4);
      }

      .dialog__title {
        display: flex;
        align-items: baseline;
        gap: var(--space-2);
        margin: 0;
        font-size: var(--text-lg);
        font-weight: var(--font-weight-semibold);
        color: var(--color-text-primary);
      }

      .dialog__program {
        font-size: var(--text-sm);
        font-weight: var(--font-weight-regular);
        color: var(--color-text-tertiary);
      }

      .dialog__note {
        display: flex;
        align-items: flex-start;
        gap: var(--space-2);
        margin: var(--space-3) 0 0;
        padding: var(--space-3);
        border-radius: var(--radius-md);
        background: var(--color-info-bg);
        color: var(--color-text-secondary);
        font-size: var(--text-xs);
        line-height: var(--line-height-base);
      }

      .dialog__note [nz-icon] {
        color: var(--color-info);
        margin-block-start: var(--space-1);
      }

      .dialog__loading {
        display: flex;
        align-items: center;
        gap: var(--space-2);
        padding: var(--space-6) 0;
        color: var(--color-text-tertiary);
        font-size: var(--text-sm);
      }

      .grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: var(--space-4);
        padding-block-start: var(--space-3);
      }

      .grid__pair {
        display: grid;
        grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
        gap: var(--space-3);
        align-items: end;
      }

      .grid__full {
        grid-column: 1 / -1;
      }

      .field {
        display: flex;
        flex-direction: column;
        gap: var(--space-1);
        min-inline-size: 0;
      }

      .field--check {
        justify-content: flex-end;
        padding-block-end: var(--space-2);
      }

      .field__label {
        font-size: var(--text-xs);
        color: var(--color-text-secondary);
      }

      .field__input--num {
        font-variant-numeric: tabular-nums;
        font-feature-settings: var(--font-feature-tabular);
      }

      .range {
        border: 0;
        margin: 0;
        padding: 0;
        min-inline-size: 0;
      }

      .range__row {
        display: flex;
        align-items: center;
        gap: var(--space-2);
        margin-block-start: var(--space-1);
      }

      .range__sep {
        color: var(--color-text-tertiary);
      }

      .clear {
        cursor: pointer;
        padding-inline: 0;
      }

      .dialog__foot {
        display: flex;
        justify-content: flex-end;
        gap: var(--space-2);
        margin-block-start: var(--space-5);
        padding-block-start: var(--space-4);
        border-block-start: 1px solid var(--color-border-default);
      }

      .dialog__foot button {
        cursor: pointer;
      }

      @media (max-width: 767px) {
        .grid,
        .grid__pair {
          grid-template-columns: minmax(0, 1fr);
        }
      }

      @media (prefers-reduced-motion: reduce) {
        :host ::ng-deep .ant-tabs-tabpane {
          transition: none;
        }
      }
    `,
  ],
})
export class CatalogDefaultsDialogComponent {
  private readonly modalRef = inject(NzModalRef);
  private readonly api = inject(LookupsApiService);
  readonly data = inject<CatalogDefaultsDialogData>(NZ_MODAL_DATA);

  readonly loading = signal(true);
  readonly saving = signal(false);
  activeTab = 0;

  /** One form model per served category, keyed by category. */
  private readonly forms = signal<Record<string, CategoryForm>>({});

  /** `categoryLabel` is typed to `LoanCategory`; served categories arrive as plain
   *  strings, so unknown values fall back to the raw key rather than throwing. */
  tabTitle(category: string): string {
    return isLoanCategory(category) ? categoryLabel(category) : category;
  }

  readonly minLabel = $localize`:@@common.min:Minimum`;
  readonly maxLabel = $localize`:@@common.max:Maximum`;

  constructor() {
    void this.load();
  }

  formFor(category: string): CategoryForm | undefined {
    return this.forms()[category];
  }

  patch(category: string, patch: Partial<CategoryForm>): void {
    const current = this.forms()[category];
    if (!current) return;
    this.forms.set({ ...this.forms(), [category]: { ...current, ...patch } });
  }

  clearCategory(category: string): void {
    this.forms.set({ ...this.forms(), [category]: { ...EMPTY_FORM, dbrBands: [] } });
  }

  cancel(): void {
    this.modalRef.close(false);
  }

  async save(): Promise<void> {
    this.saving.set(true);
    try {
      const defaults: Record<string, ProgramDefaults> = {};
      for (const category of this.data.categories) {
        const form = this.forms()[category];
        if (!form) continue;
        const payload = toProgramDefaults(form);
        // An all-empty category is omitted entirely rather than stored as `{}`,
        // so "no defaults" stays indistinguishable from "never configured".
        if (Object.keys(payload).length > 0) defaults[category] = payload;
      }
      await this.api.updateCatalogDefaults(this.data.key, defaults);
      this.modalRef.close(true);
    } finally {
      this.saving.set(false);
    }
  }

  private async load(): Promise<void> {
    try {
      const res = await this.api.getCatalogDefaults(this.data.key);
      const forms: Record<string, CategoryForm> = {};
      for (const category of this.data.categories) {
        forms[category] = fromProgramDefaults(res.defaults[category]);
      }
      this.forms.set(forms);
    } finally {
      this.loading.set(false);
    }
  }
}

// --- Form <-> API shape ----------------------------------------------------

function fromProgramDefaults(defaults: ProgramDefaults | undefined): CategoryForm {
  if (!defaults) return { ...EMPTY_FORM, dbrBands: [] };
  const egp = defaults.loanLimits?.perCurrency?.['EGP'];
  const pricing = defaults.pricing;
  return {
    minMonths: numText(defaults.tenor?.minMonths),
    maxMonths: numText(defaults.tenor?.maxMonths),
    minAmount: egp?.minAmount ?? '',
    maxAmount: egp?.maxAmount ?? '',
    // One rate input either way; which key it lands in is decided by the checkbox.
    ratePercent: pricing?.isVariableRate
      ? (pricing.currentEffectiveRatePercent ?? '')
      : (pricing?.baseRatePercent ?? ''),
    isVariableRate: pricing?.isVariableRate ?? false,
    ageMin: numText(defaults.eligibility?.ageMin),
    ageMax: numText(defaults.eligibility?.ageMax),
    minMonthlyIncomeEGP: defaults.eligibility?.minMonthlyIncomeEGP ?? '',
    dbrCapPercent: defaults.eligibility?.dbrCapPercent ?? '',
    dbrBands: defaults.eligibility?.dbrBands ?? [],
    skipDbrCheck: defaults.eligibility?.skipDbrCheck ?? false,
    requiresCollateral: defaults.eligibility?.requiresCollateral ?? false,
    adminFeePercent: defaults.fees?.adminFeePercent ?? '',
    stampDutyPercent: defaults.fees?.stampDutyPercent ?? '',
    lifeInsurancePercent: defaults.fees?.lifeInsurancePercent ?? '',
  };
}

function toProgramDefaults(form: CategoryForm): ProgramDefaults {
  const out: ProgramDefaults = {};

  const tenor = prune({ minMonths: intOrUndefined(form.minMonths), maxMonths: intOrUndefined(form.maxMonths) });
  if (tenor) out.tenor = tenor;

  const egp = prune({ minAmount: textOrUndefined(form.minAmount), maxAmount: textOrUndefined(form.maxAmount) });
  if (egp) out.loanLimits = { perCurrency: { EGP: egp } };

  const rate = textOrUndefined(form.ratePercent);
  const pricing = prune({
    isVariableRate: rate ? form.isVariableRate : undefined,
    baseRatePercent: rate && !form.isVariableRate ? rate : undefined,
    currentEffectiveRatePercent: rate && form.isVariableRate ? rate : undefined,
  });
  if (pricing) out.pricing = pricing;

  const eligibility = prune({
    ageMin: intOrUndefined(form.ageMin),
    ageMax: intOrUndefined(form.ageMax),
    minMonthlyIncomeEGP: textOrUndefined(form.minMonthlyIncomeEGP),
    dbrCapPercent: textOrUndefined(form.dbrCapPercent),
    dbrBands: form.dbrBands.length > 0 ? form.dbrBands : undefined,
    // Booleans are only meaningful once something else in the block is set,
    // otherwise an untouched category would persist `false` as a "default".
    skipDbrCheck: form.skipDbrCheck || undefined,
    requiresCollateral: form.requiresCollateral || undefined,
  });
  if (eligibility) out.eligibility = eligibility;

  const fees = prune({
    adminFeePercent: textOrUndefined(form.adminFeePercent),
    stampDutyPercent: textOrUndefined(form.stampDutyPercent),
    lifeInsurancePercent: textOrUndefined(form.lifeInsurancePercent),
  });
  if (fees) out.fees = fees;

  return out;
}

function numText(value: number | undefined): string {
  return value === undefined || value === null ? '' : String(value);
}

function textOrUndefined(value: string): string | undefined {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function intOrUndefined(value: string): number | undefined {
  const trimmed = value.trim();
  if (trimmed.length === 0) return undefined;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? Math.trunc(parsed) : undefined;
}

/** Drops undefined keys; returns undefined when nothing survives. */
function prune<T extends Record<string, unknown>>(obj: T): T | undefined {
  const out = {} as T;
  let kept = false;
  for (const [key, value] of Object.entries(obj)) {
    if (value === undefined) continue;
    (out as Record<string, unknown>)[key] = value;
    kept = true;
  }
  return kept ? out : undefined;
}
