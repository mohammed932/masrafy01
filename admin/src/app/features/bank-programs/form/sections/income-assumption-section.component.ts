import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  input,
  model,
  output,
  signal,
  type OnInit,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzIconModule, provideNzIconsPatch } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzModalService } from 'ng-zorro-antd/modal';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { CalculatorOutline, WarningOutline } from '@ant-design/icons-angular/icons';
import { PlatformEnumerationsService } from '@core/platform-enumerations/platform-enumerations.service';
import type { EnumerationType } from '@core/platform-enumerations/platform-enumerations.types';
import {
  INCOME_BAND_UNIT,
  INCOME_KEY_REGISTRY,
  INCOME_METHOD_SHAPE,
  type IncomeAssumptionStrategy,
  type IncomeBand,
  type IncomeKeyTableRow,
  type IncomeMethodShape,
} from '../../bank-programs.types';
import {
  IncomeBandsEditorComponent,
  incomeBandsErrorFor,
} from './income-rule/income-bands-editor.component';
import {
  IncomeKeyTableComponent,
  incomeKeyTableErrorFor,
} from './income-rule/income-key-table.component';
import { incomeRuleHasError } from './income-rule/income-rule.rules';

/**
 * The income-assumption section — the bank's own rule for deriving an income when a
 * payslip is not the operative figure (FR-005 … FR-013).
 *
 * Type-driven: the selected method decides which editor renders. The six TABLE
 * methods used to fall through to a "lands in the next increment" placeholder, which
 * is the defect this feature exists to remove — an admin could select a method and
 * save a program with no configuration behind it, and the engine then resolved
 * nothing for every applicant.
 *
 * One level of nesting inside the existing section rhythm, `section.styles.scss`
 * tokens only, and a visible label on every control (FR-040 … FR-042).
 */
@Component({
  selector: 'app-income-assumption-section',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    NzFormModule,
    NzInputModule,
    NzSelectModule,
    NzIconModule,
    IncomeKeyTableComponent,
    IncomeBandsEditorComponent,
  ],
  providers: [provideNzIconsPatch([CalculatorOutline, WarningOutline])],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="section" [formGroup]="group()" id="income-assumption">
      <header class="section-header">
        <span
          class="section-icon"
          nz-icon
          nzType="calculator"
          nzTheme="outline"
          aria-hidden="true"
        ></span>
        <div>
          <h3 class="section-title" i18n="@@bank_programs.section.income_assumption">
            Income assumption
          </h3>
          <p class="section-sub" i18n="@@bank_programs.section.income_assumption_sub">
            How this bank works out a monthly income when a payslip is not the figure it lends
            against. Switching method clears the previous table — you are asked first.
          </p>
        </div>
      </header>

      <div class="grid">
        <nz-form-item class="span-2">
          <nz-form-label [nzFor]="'strategy'" i18n="@@bank_programs.field.strategy"
            >Method</nz-form-label
          >
          <nz-form-control>
            <nz-select id="strategy" formControlName="strategy">
              <nz-option
                nzValue="declared"
                i18n-nzLabel="@@bank_programs.strategy.declared"
                nzLabel="Declared (applicant-provided)"
              ></nz-option>
              <nz-option
                nzValue="byYearsInJob"
                i18n-nzLabel="@@bank_programs.strategy.years_job"
                nzLabel="By years in job"
              ></nz-option>
              <nz-option
                nzValue="byYearsInPractice"
                i18n-nzLabel="@@bank_programs.strategy.years_practice"
                nzLabel="By years in practice"
              ></nz-option>
              <nz-option
                nzValue="byProfessorRank"
                i18n-nzLabel="@@bank_programs.strategy.professor_rank"
                nzLabel="By academic rank"
              ></nz-option>
              <nz-option
                nzValue="byMilitaryGrade"
                i18n-nzLabel="@@bank_programs.strategy.military_grade"
                nzLabel="By military grade"
              ></nz-option>
              <nz-option
                nzValue="byCDValue"
                i18n-nzLabel="@@bank_programs.strategy.cd_value"
                nzLabel="By certificate value"
              ></nz-option>
              <nz-option
                nzValue="byTotalDeposits"
                i18n-nzLabel="@@bank_programs.strategy.total_deposits"
                nzLabel="By total deposits"
              ></nz-option>
              <nz-option
                nzValue="byCarInstallment"
                i18n-nzLabel="@@bank_programs.strategy.car_installment"
                nzLabel="By car installment"
              ></nz-option>
              <nz-option
                nzValue="byCarLoanAmount"
                i18n-nzLabel="@@bank_programs.strategy.car_loan_amount"
                nzLabel="By car loan amount"
              ></nz-option>
              <nz-option
                nzValue="byCreditCardLimit"
                i18n-nzLabel="@@bank_programs.strategy.credit_card_limit"
                nzLabel="By credit card limit"
              ></nz-option>
              <nz-option
                nzValue="byBankStatementPercent"
                i18n-nzLabel="@@bank_programs.strategy.bank_statement"
                nzLabel="By bank statement percent"
              ></nz-option>
            </nz-select>
          </nz-form-control>
        </nz-form-item>

        <!-- ── The method's own configuration ───────────────────────────────── -->
        @switch (shape()) {
          @case ('keyTable') {
            <div class="span-2 rule-block">
              <h4 class="rule-title" i18n="@@bank_programs.income.key_table_title">
                The bank's table
              </h4>
              <app-income-key-table
                [rows]="keyTable()"
                (rowsChange)="keyTable.set($event)"
                [enumerationType]="keyRegistry()!"
                [estimatedKeys]="estimatedKeys()"
                (estimatedKeysChange)="estimatedKeyChange.emit($event)"
                (keyStructureChange)="keyStructureChange.emit($event)"
              ></app-income-key-table>
            </div>
          }
          @case ('bands') {
            <div class="span-2 rule-block">
              <h4 class="rule-title" i18n="@@bank_programs.income.bands_title">The bank's bands</h4>
              <app-income-bands-editor
                [bands]="bands()"
                (bandsChange)="bands.set($event)"
                [unit]="bandUnit()"
                [estimatedIndexes]="estimatedBandIndexes()"
                (estimatedIndexesChange)="estimatedBandChange.emit($event)"
                (structureChange)="bandStructureChange.emit($event)"
              ></app-income-bands-editor>
              @if (legacyScalarShown()) {
                <p class="rule-hint" i18n="@@bank_programs.income.legacy_scalar_hint">
                  This program still derives income from the single percentage below. Adding bands
                  replaces it; leaving the table empty keeps the current behaviour unchanged.
                </p>
                <nz-form-item class="numeric" formGroupName="scalar">
                  <nz-form-label
                    [nzFor]="'legacyScalarValue'"
                    i18n="@@bank_programs.income.legacy_scalar_label"
                    >Current percentage of value</nz-form-label
                  >
                  <nz-form-control>
                    <input
                      nz-input
                      id="legacyScalarValue"
                      formControlName="value"
                      inputmode="decimal"
                      (blur)="touchScalar()"
                    />
                  </nz-form-control>
                </nz-form-item>
              }
            </div>
          }
          @case ('scalar') {
            <div class="span-2 rule-block" formGroupName="scalar">
              <h4 class="rule-title" i18n="@@bank_programs.income.scalar_title">
                The bank's figure
              </h4>
              <nz-form-item class="numeric">
                <nz-form-label [nzFor]="'scalarValue'">{{ scalarLabel() }}</nz-form-label>
                <nz-form-control>
                  <input
                    nz-input
                    id="scalarValue"
                    formControlName="value"
                    inputmode="decimal"
                    [attr.aria-describedby]="scalarError() ? 'scalarValueError' : null"
                    (blur)="touchScalar()"
                  />
                </nz-form-control>
              </nz-form-item>
              @if (scalarError()) {
                <p
                  class="rule-error"
                  id="scalarValueError"
                  role="alert"
                  i18n="@@bank_programs.income.err_scalar_invalid"
                >
                  This figure must be greater than zero.
                </p>
              }
            </div>
          }
          @default {
            <div class="span-2">
              <p class="rule-hint" i18n="@@bank_programs.income.declared_hint">
                The applicant's stated monthly income is used as-is. No table is needed.
              </p>
            </div>
          }
        }

        <!-- ── Policy on top of the method ──────────────────────────────────── -->
        @if (shape() !== 'none') {
          <nz-form-item class="numeric">
            <nz-form-label
              [nzFor]="'dbrCapPercentOverride'"
              i18n="@@bank_programs.income.dbr_override_label"
              >Debt-burden cap for this rule (%)</nz-form-label
            >
            <nz-form-control>
              <input
                nz-input
                id="dbrCapPercentOverride"
                formControlName="dbrCapPercentOverride"
                inputmode="decimal"
                [attr.aria-describedby]="'dbrOverrideHint'"
                (blur)="touchOverride()"
              />
              <p
                class="rule-hint"
                id="dbrOverrideHint"
                i18n="@@bank_programs.income.dbr_override_hint"
              >
                Applied only when the income came from this rule. Leave empty to use the program's
                own cap.
              </p>
              @if (overrideError()) {
                <p class="rule-error" role="alert" i18n="@@bank_programs.income.err_dbr_override">
                  The cap must be greater than 0 and at most 100.
                </p>
              }
            </nz-form-control>
          </nz-form-item>

          <nz-form-item>
            <nz-form-label
              [nzFor]="'combinationRule'"
              i18n="@@bank_programs.income.combination_label"
              >When the applicant also states a salary</nz-form-label
            >
            <nz-form-control>
              <nz-select id="combinationRule" formControlName="combinationRule">
                <nz-option
                  [nzValue]="null"
                  i18n-nzLabel="@@bank_programs.income.combination_replace"
                  nzLabel="Use this rule's figure instead"
                ></nz-option>
                <nz-option
                  nzValue="greater_of"
                  i18n-nzLabel="@@bank_programs.income.combination_greater"
                  nzLabel="Use whichever is higher"
                ></nz-option>
                <nz-option
                  nzValue="lesser_of"
                  i18n-nzLabel="@@bank_programs.income.combination_lesser"
                  nzLabel="Use whichever is lower"
                ></nz-option>
              </nz-select>
            </nz-form-control>
          </nz-form-item>

          <nz-form-item class="span-2">
            <nz-form-label
              [nzFor]="'ruleRequiredDocuments'"
              i18n="@@bank_programs.income.required_docs_label"
              >Documents this method needs</nz-form-label
            >
            <nz-form-control>
              <nz-select
                id="ruleRequiredDocuments"
                nzMode="multiple"
                formControlName="requiredDocuments"
                [nzPlaceHolder]="documentsPlaceholder"
              >
                @for (doc of documentMembers(); track doc.key) {
                  <nz-option [nzValue]="doc.key" [nzLabel]="doc.labelEn"></nz-option>
                }
              </nz-select>
              <p class="rule-hint" i18n="@@bank_programs.income.required_docs_hint">
                Checked against the program's own document list on save. A gap is reported, never
                blocked.
              </p>
            </nz-form-control>
          </nz-form-item>
        }
      </div>

      <!-- The check panel is hosted by the form page directly below this section, in
           the same tab order (US3) — it is not nested here, so an unsaved draft can be
           read from the page's own signals. -->
      <ng-content></ng-content>
    </section>
  `,
  styleUrls: ['./section.styles.scss'],
  styles: [
    `
      /* One level of nesting inside the section rhythm — a bordered block, not a
         second card, so the rule reads as part of the method choice above it. */
      .rule-block {
        display: flex;
        flex-direction: column;
        gap: var(--space-3);
        padding: var(--space-3);
        border: 1px solid var(--color-border-default);
        border-radius: var(--radius-md);
        background: var(--color-surface-elevated);
      }

      .rule-title {
        margin: 0;
        font-size: var(--text-sm);
        font-weight: var(--font-semibold);
        color: var(--color-text-primary);
      }

      .rule-hint {
        margin: var(--space-1) 0 0;
        max-inline-size: 68ch;
        font-size: var(--text-xs);
        color: var(--color-text-tertiary);
      }

      .rule-error {
        margin: var(--space-1) 0 0;
        font-size: var(--text-xs);
        color: var(--color-error);
      }
    `,
  ],
})
export class IncomeAssumptionSectionComponent implements OnInit {
  private readonly modal = inject(NzModalService);
  private readonly enums = inject(PlatformEnumerationsService);
  private readonly destroyRef = inject(DestroyRef);

  /** The `incomeAssumption` form group: strategy, scalar, override, combination, docs. */
  readonly group = input.required<FormGroup>();

  /**
   * The two TABLE shapes are signals, not form controls — the same pattern
   * `dbrBands` already uses on this form. A `FormArray` of row groups would give the
   * band linkage two owners (the array and the relink), which is how a gap appears.
   */
  readonly keyTable = model<IncomeKeyTableRow[]>([]);
  readonly bands = model<IncomeBand[]>([]);

  /**
   * Feature 011 — which incomes are team-estimated. Passed straight through to the
   * editors and straight back out: the section does not own the marker map, because
   * the same map covers pricing and fees on other steps and one owner is the only way
   * the payload stays a single sparse object (FR-032).
   */
  readonly estimatedKeys = input<ReadonlySet<string>>(new Set());
  readonly estimatedKeyChange = output<{ key: string; estimated: boolean }>();
  readonly estimatedBandIndexes = input<ReadonlySet<number>>(new Set());
  readonly estimatedBandChange = output<{ index: number; estimated: boolean }>();

  /**
   * Structural band edits, forwarded so the owner of the path map can move its
   * index-keyed markers with the rows. Re-emitted rather than handled here for the
   * same reason the markers themselves pass through: this section does not own the
   * map, and a second owner is how the two disagree.
   */
  readonly bandStructureChange = output<{ kind: 'remove'; index: number } | { kind: 'reset' }>();

  /** The key table's equivalent — its paths are keyed by the registry key, not a position. */
  readonly keyStructureChange = output<
    | { kind: 'rename'; from: string; to: string }
    | { kind: 'remove'; key: string }
    | { kind: 'reset' }
  >();

  readonly documentsPlaceholder = $localize`:@@bank_programs.income.docs_placeholder:Pick the documents`;

  /**
   * The selected method, as a SIGNAL.
   *
   * A `computed()` over `group().get('strategy')?.value` looks equivalent and is not:
   * a `FormControl` is not a signal, so the only dependency is the stable `group()`
   * input and the computed caches its first answer forever. The method select moved,
   * `shape()` did not, and the editor for the newly-picked method never rendered —
   * the rule could not be configured at all. Everything derived from a control's
   * value or touched state on this component reads `revision()` for the same reason.
   */
  private readonly strategyValue = signal<IncomeAssumptionStrategy>('declared');
  readonly strategy = this.strategyValue.asReadonly();

  /**
   * Bumped on every value change and on the blurs this section listens for, so the
   * error computeds below re-run. Reactive Forms publish through observables; this is
   * the one bridge into the signal graph, kept in ONE place rather than sprinkled as
   * per-control signals that would each have to be wired and unwired.
   */
  private readonly revision = signal(0);
  private bump(): void {
    this.revision.update((n) => n + 1);
  }

  readonly shape = computed<IncomeMethodShape>(
    () => INCOME_METHOD_SHAPE[this.strategy()] ?? 'none',
  );

  readonly keyRegistry = computed<EnumerationType | null>(
    () => INCOME_KEY_REGISTRY[this.strategy()] ?? null,
  );

  readonly bandUnit = computed<string | null>(() => INCOME_BAND_UNIT[this.strategy()] ?? null);

  readonly documentMembers = computed(() => this.enums.membersFor('required_document')());

  /**
   * The two value methods accept a legacy percent instead of bands (FR-015), so the
   * single number stays visible while the band table is empty. Hiding it would leave
   * an admin looking at an empty editor over a program that IS deriving income, with
   * no way to see or change the figure doing it.
   */
  readonly legacyScalarShown = computed(
    () =>
      (this.strategy() === 'byCDValue' || this.strategy() === 'byTotalDeposits') &&
      this.bands().length === 0,
  );

  readonly scalarLabel = computed(() => {
    switch (this.strategy()) {
      case 'byCarInstallment':
        return $localize`:@@bank_programs.income.scalar_car_installment:Multiple of the car installment`;
      case 'byCarLoanAmount':
        return $localize`:@@bank_programs.income.scalar_car_loan:Percent of the car loan amount`;
      case 'byCreditCardLimit':
        return $localize`:@@bank_programs.income.scalar_card_limit:Multiple of the card limit`;
      case 'byBankStatementPercent':
        return $localize`:@@bank_programs.income.scalar_bank_statement:Percent of the statement balance`;
      default:
        return $localize`:@@bank_programs.income.scalar_generic:Figure`;
    }
  });

  // ── Row-level validation, surfaced on BLUR rather than only on save (FR-043) ──
  //
  // Every message maps through the shared error-code vocabulary the two editors
  // already own (`incomeKeyTableErrorFor` / `incomeBandsErrorFor`), so there is no
  // per-component English string for a code the backend also reports (A22).

  readonly keyTableError = computed(() => incomeKeyTableErrorFor(this.keyTable()));
  readonly bandsError = computed(() => incomeBandsErrorFor(this.bands()));

  readonly scalarError = computed(() => {
    this.revision();
    const control = this.group().get('scalar.value');
    if (!control || (!control.touched && !control.dirty)) return false;
    const raw = control.value as string | null;
    if (raw === null || raw === '') return this.shape() === 'scalar';
    const value = Number(raw);
    return !Number.isFinite(value) || value <= 0;
  });

  readonly overrideError = computed(() => {
    this.revision();
    const control = this.group().get('dbrCapPercentOverride');
    if (!control || (!control.touched && !control.dirty)) return false;
    const raw = control.value as string | null;
    // Empty is legal — it means "use the program's own cap".
    if (raw === null || raw === '') return false;
    const value = Number(raw);
    return !Number.isFinite(value) || value <= 0 || value > 100;
  });

  /**
   * The section's verdict, through the SAME shared function the form page's save gate
   * calls (`incomeRuleHasError`). One implementation: a second copy here would be the
   * one that disagrees with the gate, and the admin would face a Save button that is
   * live over a rule the wizard refuses.
   */
  readonly hasError = computed(() => {
    this.revision();
    return incomeRuleHasError({
      shape: this.shape(),
      keyTable: this.keyTable(),
      bands: this.bands(),
      scalarValue: this.group().get('scalar.value')?.value as string | null,
      isValueMethod: this.strategy() === 'byCDValue' || this.strategy() === 'byTotalDeposits',
    });
  });

  touchScalar(): void {
    this.group().get('scalar.value')?.markAsTouched();
    this.bump();
  }

  touchOverride(): void {
    this.group().get('dbrCapPercentOverride')?.markAsTouched();
    this.bump();
  }

  ngOnInit(): void {
    void this.enums.preload(['required_document', 'professor_rank', 'military_grade']);

    // Typing in a control does not mark it touched, but it does dirty it — and both
    // states gate the messages below, so the form's own stream drives the tick.
    this.group()
      .valueChanges.pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.bump());

    const strategyControl = this.group().get('strategy');
    if (!strategyControl) return;

    this.strategyValue.set((strategyControl.value as IncomeAssumptionStrategy) ?? 'declared');

    let previous = strategyControl.value as IncomeAssumptionStrategy;

    /**
     * FR-011 — confirm BEFORE the previous method's table is discarded.
     *
     * A grade table is 10–15 rows an admin typed off a bank's PDF; losing it to a
     * mis-click on the method select is not a recoverable mistake, because nothing
     * on screen would show what was there. `NzModalService` renders at the document
     * root — a `position: fixed` scrim inside this section would be trapped by
     * `section.page`'s `app-page-rise` transform and dim only the panel (A34).
     */
    const onStrategyPicked = (next: IncomeAssumptionStrategy): void => {
      if (next === previous) return;
      // Mirrored into the signal BEFORE the confirm, so the newly-picked method's
      // editor renders while the question is on screen — and put back below if the
      // admin keeps the old table.
      this.strategyValue.set(next);

      const previousShape = INCOME_METHOD_SHAPE[previous] ?? 'none';
      const nextShape = INCOME_METHOD_SHAPE[next] ?? 'none';
      const losing =
        (previousShape === 'keyTable' && this.keyTable().length > 0 && nextShape !== 'keyTable') ||
        (previousShape === 'bands' && this.bands().length > 0 && nextShape !== 'bands');

      if (!losing) {
        previous = next;
        this.clearForeignShape(nextShape);
        return;
      }

      const revertTo = previous;
      this.modal.confirm({
        nzTitle: $localize`:@@bank_programs.income.switch_confirm_title:Discard this method's table?`,
        nzContent: $localize`:@@bank_programs.income.switch_confirm_body:The rows you entered for the previous method will be removed. This cannot be undone from here.`,
        nzOkText: $localize`:@@bank_programs.income.switch_confirm_ok:Discard and switch`,
        nzCancelText: $localize`:@@bank_programs.income.switch_confirm_cancel:Keep the table`,
        nzOkDanger: true,
        nzOnOk: () => {
          previous = next;
          this.clearForeignShape(nextShape);
        },
        // Cancel puts the select back where it was, so the control never disagrees
        // with the table beneath it. `emitEvent: false` means this subscription does
        // not re-fire, so the signal is reverted by hand.
        nzOnCancel: () => {
          strategyControl.setValue(revertTo, { emitEvent: false });
          this.strategyValue.set(revertTo);
        },
      });
    };

    strategyControl.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(onStrategyPicked);
  }

  /** Drop whatever the newly-selected method cannot use (FR-011). */
  private clearForeignShape(nextShape: IncomeMethodShape): void {
    // BOTH tables clear their markers, not just the bands. Clearing the key table
    // without them left `incomeAssumption.keyTable.<key>.incomeEGP` in the payload
    // over a rule that no longer has a key table — 422 `VALUE_SOURCE_PATH_UNKNOWN` on
    // create, with the key-table editor gone from the screen, so nothing the admin
    // could click would clear it.
    if (nextShape !== 'keyTable' && this.keyTable().length > 0) {
      this.keyTable.set([]);
      this.keyStructureChange.emit({ kind: 'reset' });
    }
    if (nextShape !== 'bands' && this.bands().length > 0) {
      this.bands.set([]);
      // The rows those markers described are gone with the method, so the markers go
      // too — an index-keyed marker over an empty table names nothing.
      this.bandStructureChange.emit({ kind: 'reset' });
    }
    if (nextShape !== 'scalar' && nextShape !== 'bands') {
      this.group().get('scalar')?.reset({ value: null, unit: 'percent' }, { emitEvent: false });
    }
    if (nextShape === 'none') {
      this.group().patchValue(
        { dbrCapPercentOverride: null, combinationRule: null, requiredDocuments: [] },
        { emitEvent: false },
      );
    }
  }
}
