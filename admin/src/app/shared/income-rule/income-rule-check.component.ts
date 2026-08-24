import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzIconModule, provideNzIconsPatch } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { ExperimentOutline } from '@ant-design/icons-angular/icons';
import { MoneyInputDirective } from '@core/directives/money-input.directive';
import { ErrorCodeService } from '@core/errors/error-code.service';
import { PlatformEnumerationsService } from '@core/platform-enumerations/platform-enumerations.service';
import { BankProgramsApiService } from '@features/bank-programs/bank-programs.api.service';
import {
  INCOME_KEY_REGISTRY,
  factKeyOf,
  factKeysReadBy,
  factKeyOptions,
  incomeMethodShape,
  registryFacts,
  type BuiltinIncomeStrategy,
  type IncomeAssumptionConfig,
  type IncomeRuleCheckResult,
  type IncomeRuleDraftProgram,
  type RuleGate,
  type RuleStep,
} from '@features/bank-programs/bank-programs.types';
import { BANK_RELATIONSHIP_FACT_KEY } from '@core/surrogate-facts';

/**
 * "Check this rule before anyone else sees it" (FR-026 – FR-031).
 *
 * Sits directly below the table, inside the same section and the SAME tab order, and
 * renders its result IN PLACE — no navigation, no modal, no full-screen blocking state
 * (FR-029, FR-047). A modal here would also be A34: a `position: fixed` scrim inside
 * `section.page`'s transform dims only the panel.
 *
 * It sends the ON-SCREEN draft, including unsaved edits (FR-028), so an admin can
 * mistype an income, see the wrong figure, and fix it without ever having saved it.
 *
 * **"No row matched" is stated where the income would be — never a zero** (FR-031). A
 * zero in that slot claims the bank assessed this applicant as earning nothing, which
 * is a different and false statement.
 *
 * The DBR percentage is always shown WITH its source, because "45%" is ambiguous
 * between the program's own cap and this rule's override, and those are edited on
 * different controls (FR-027).
 */
@Component({
  selector: 'app-income-rule-check',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    FormsModule,
    NzButtonModule,
    NzFormModule,
    NzIconModule,
    NzInputModule,
    NzSelectModule,
    MoneyInputDirective,
  ],
  providers: [provideNzIconsPatch([ExperimentOutline])],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="chk" [formGroup]="form">
      <header class="chk__head">
        <span nz-icon nzType="experiment" nzTheme="outline" aria-hidden="true"></span>
        <div>
          <h4 class="chk__title" i18n="@@bank_programs.income.check_title">
            Check this rule before anyone else sees it
          </h4>
          <p class="chk__sub" i18n="@@bank_programs.income.check_sub">
            Runs a sample applicant against what is on screen right now, including edits you have
            not saved. Nothing is stored.
          </p>
        </div>
      </header>

      <div class="chk__grid">
        <!-- The fact the selected method reads. Only the relevant one is asked for:
             showing all ten would bury it. -->
        <!-- Gated on the SHAPE plus a list to pick from, not on the enumeration: a
             registry fact's keys come from its bound question's options, so keying off
             the enumeration would leave a fact rule with no way to enter a sample
             answer. -->
        @if (shape() === 'keyTable' && keyMembers().length > 0) {
          <nz-form-item>
            <nz-form-label [nzFor]="'sampleKey'">{{ keyLabel() }}</nz-form-label>
            <nz-form-control>
              <nz-select
                id="sampleKey"
                formControlName="factKey"
                [nzPlaceHolder]="anyKeyPlaceholder"
              >
                @for (m of keyMembers(); track m.key) {
                  <nz-option [nzValue]="m.key" [nzLabel]="m.labelEn"></nz-option>
                }
              </nz-select>
            </nz-form-control>
          </nz-form-item>
        } @else if (shape() === 'bands' || shape() === 'scalar') {
          <nz-form-item class="numeric">
            <nz-form-label [nzFor]="'sampleValue'">{{ valueLabel() }}</nz-form-label>
            <nz-form-control>
              <input
                nz-input
                appMoneyInput
                id="sampleValue"
                formControlName="factValue"
                inputmode="decimal"
              />
            </nz-form-control>
          </nz-form-item>
        }

        @if (shape() === 'steps') {
          @for (fact of pipelineFacts(); track fact.key) {
            <nz-form-item class="span-2">
              <nz-form-label [nzFor]="'sampleFact-' + fact.key">{{ fact.label }}</nz-form-label>
              <nz-form-control>
                @if (fact.options.length > 0) {
                  <nz-select
                    [id]="'sampleFact-' + fact.key"
                    [ngModel]="sampleFactFor(fact.key)"
                    (ngModelChange)="setSampleFact(fact.key, $event)"
                    [ngModelOptions]="{ standalone: true }"
                    nzAllowClear
                    [nzPlaceHolder]="anyKeyPlaceholder"
                  >
                    @for (option of fact.options; track option.code) {
                      <nz-option
                        [nzValue]="option.code"
                        [nzLabel]="isAr() ? option.labelAr : option.labelEn"
                      ></nz-option>
                    }
                  </nz-select>
                } @else {
                  <input
                    nz-input
                    [id]="'sampleFact-' + fact.key"
                    inputmode="decimal"
                    [value]="sampleFactFor(fact.key)"
                    (input)="setSampleFact(fact.key, $any($event.target).value)"
                  />
                }
              </nz-form-control>
            </nz-form-item>
          }
        }

        <nz-form-item class="numeric">
          <nz-form-label [nzFor]="'sampleAge'" i18n="@@bank_programs.income.check_age"
            >Age</nz-form-label
          >
          <nz-form-control>
            <input nz-input id="sampleAge" formControlName="age" inputmode="numeric" />
          </nz-form-control>
        </nz-form-item>

        <nz-form-item class="numeric">
          <nz-form-label [nzFor]="'sampleSalary'" i18n="@@bank_programs.income.check_salary"
            >Declared salary (EGP)</nz-form-label
          >
          <nz-form-control>
            <input
              nz-input
              appMoneyInput
              id="sampleSalary"
              formControlName="declaredMonthlySalaryEGP"
              inputmode="decimal"
            />
          </nz-form-control>
        </nz-form-item>

        <nz-form-item class="numeric">
          <nz-form-label
            [nzFor]="'sampleObligations'"
            i18n="@@bank_programs.income.check_obligations"
            >Current monthly payments (EGP)</nz-form-label
          >
          <nz-form-control>
            <input
              nz-input
              appMoneyInput
              id="sampleObligations"
              formControlName="existingMonthlyObligationsEGP"
              inputmode="decimal"
            />
          </nz-form-control>
        </nz-form-item>

        <nz-form-item class="numeric">
          <nz-form-label [nzFor]="'sampleAmount'" i18n="@@bank_programs.income.check_amount"
            >Amount asked for (EGP)</nz-form-label
          >
          <nz-form-control>
            <input
              nz-input
              appMoneyInput
              id="sampleAmount"
              formControlName="requestedAmountEGP"
              inputmode="decimal"
            />
          </nz-form-control>
        </nz-form-item>

        <nz-form-item class="numeric">
          <nz-form-label [nzFor]="'sampleTenor'" i18n="@@bank_programs.income.check_tenor"
            >Term (months)</nz-form-label
          >
          <nz-form-control>
            <input nz-input id="sampleTenor" formControlName="tenorMonths" inputmode="numeric" />
          </nz-form-control>
        </nz-form-item>
      </div>

      <div class="chk__actions">
        <button
          nz-button
          nzType="primary"
          type="button"
          [nzLoading]="pending()"
          [disabled]="form.invalid || pending() || !canRun()"
          (click)="run()"
        >
          <span i18n="@@bank_programs.income.check_run">Check</span>
        </button>
        @if (!canRun()) {
          <!-- Only reachable on a create whose earlier steps are not filled in yet. It used
               to read "save the program first", which was the truth about the old
               implementation rather than about what the operator has to do. -->
          <span class="chk__hint" i18n="@@bank_programs.income.check_needs_pricing">
            Fill the Terms and Pricing steps first — the check needs a rate and a term to work out
            an installment.
          </span>
        }
      </div>

      <!-- Result, in place. No navigation, no overlay (FR-029). -->
      @if (error(); as err) {
        <p class="chk__error" role="alert">{{ err }}</p>
      }
      <!-- Separate @if rather than @else if: the "as" alias binds only on a PRIMARY
           @if block (NG5002), and the result needs one. Error and result are mutually
           exclusive by construction anyway - run() clears each before setting the
           other. No backticks in this comment: one would terminate the template
           literal and the errors would point somewhere else entirely. -->
      @if (!error() && result(); as r) {
        <div class="chk__result" role="status">
          <div class="chk__row">
            <span class="chk__label" i18n="@@bank_programs.income.check_income"
              >Recognised income</span
            >
            @if (r.resolvedIncomeEGP; as income) {
              <span class="chk__value">{{ income }}</span>
            } @else {
              <!-- Never a zero (FR-031). -->
              <span class="chk__value chk__value--none">{{ unresolvedLabel(r) }}</span>
            }
          </div>

          <div class="chk__row">
            <span class="chk__label" i18n="@@bank_programs.income.check_dbr"
              >Debt-burden cap applied</span
            >
            <span class="chk__value">
              {{ r.dbrCapPercent }}%
              <span class="chk__source">
                @if (r.dbrCapSource === 'rule_override') {
                  <span i18n="@@bank_programs.income.check_dbr_rule">from this rule</span>
                } @else {
                  <span i18n="@@bank_programs.income.check_dbr_program">from the program</span>
                }
              </span>
            </span>
          </div>

          <div class="chk__row">
            <span class="chk__label" i18n="@@bank_programs.income.check_installment"
              >Affordable installment</span
            >
            <span class="chk__value">{{ r.affordableInstallmentEGP ?? dash }}</span>
          </div>

          <div class="chk__row">
            <span class="chk__label" i18n="@@bank_programs.income.check_loan">Estimated loan</span>
            <span class="chk__value">{{ r.estimatedLoanAmountEGP ?? dash }}</span>
          </div>

          <div class="chk__row">
            <span class="chk__label" i18n="@@bank_programs.income.check_qualifies"
              >Covers the amount asked for</span
            >
            <span class="chk__value">
              @if (r.qualifies) {
                <span i18n="@@bank_programs.income.check_yes">Yes</span>
              } @else {
                <span i18n="@@bank_programs.income.check_no">No</span>
              }
            </span>
          </div>

          @if (matchedRowLabel(r); as row) {
            <p class="chk__trace" i18n="@@bank_programs.income.check_traced">
              Traced to {{ row }}.
            </p>
          }
        </div>
      }
    </section>
  `,
  styles: [
    `
      :host {
        display: block;
        margin-block-start: var(--space-4);
      }

      .chk {
        display: flex;
        flex-direction: column;
        gap: var(--space-3);
        padding: var(--space-4);
        border: 1px solid var(--color-border-default);
        border-radius: var(--radius-md);
        background: var(--color-surface-elevated);
      }

      .chk__head {
        display: flex;
        align-items: flex-start;
        gap: var(--space-3);
        color: var(--color-tonal-accent);
      }

      .chk__title {
        margin: 0;
        font-size: var(--text-sm);
        font-weight: var(--font-semibold);
        color: var(--color-text-primary);
      }

      .chk__sub {
        margin: var(--space-1) 0 0;
        max-inline-size: 68ch;
        font-size: var(--text-xs);
        color: var(--color-text-secondary);
      }

      .chk__grid {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: var(--space-2) var(--space-3);
        align-items: start;
      }

      .chk__actions {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: var(--space-3);
      }

      .chk__hint {
        font-size: var(--text-xs);
        color: var(--color-text-tertiary);
      }

      .chk__result {
        display: flex;
        flex-direction: column;
        gap: var(--space-2);
        padding: var(--space-3);
        border-radius: var(--radius-sm);
        background: var(--color-surface-default);
        border: 1px solid var(--color-border-default);
        /* Brief and DIRECTIONAL: the result appears where the eye already is. */
        animation: chk-in var(--motion-duration-base) var(--motion-easing-standard);
      }

      @keyframes chk-in {
        from {
          opacity: 0;
          transform: translateY(2px);
        }
        to {
          opacity: 1;
          transform: none;
        }
      }

      /* FR-048 — suppressed entirely, not merely shortened. */
      @media (prefers-reduced-motion: reduce) {
        .chk__result {
          animation: none;
        }
      }

      .chk__row {
        display: flex;
        flex-wrap: wrap;
        align-items: baseline;
        justify-content: space-between;
        gap: var(--space-2);
        font-size: var(--text-sm);
      }

      .chk__label {
        color: var(--color-text-secondary);
      }

      .chk__value {
        font-weight: var(--font-semibold);
        color: var(--color-text-primary);
        font-variant-numeric: tabular-nums;
        font-feature-settings: var(--font-feature-tabular);
      }

      /* The "no row matched" sentence. Deliberately NOT an error colour: the rule is
         working correctly, it simply does not cover this applicant. */
      .chk__value--none {
        font-weight: var(--font-normal);
        color: var(--color-text-secondary);
        font-variant-numeric: normal;
      }

      .chk__source {
        margin-inline-start: var(--space-1);
        font-size: var(--text-xs);
        font-weight: var(--font-normal);
        color: var(--color-text-tertiary);
      }

      .chk__trace {
        margin: 0;
        font-size: var(--text-xs);
        color: var(--color-text-tertiary);
      }

      .chk__error {
        margin: 0;
        font-size: var(--text-sm);
        color: var(--color-error);
      }

      /* Two columns before one. Six money inputs across three columns crowd well
         above the mobile breakpoint, and a cramped money field is where a mistyped
         figure comes from. */
      @media (max-width: 1100px) {
        .chk__grid {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }
      }

      @media (max-width: 767px) {
        .chk__grid {
          grid-template-columns: minmax(0, 1fr);
        }
      }
    `,
  ],
})
export class IncomeRuleCheckComponent {
  private readonly fb = inject(FormBuilder);
  private readonly api = inject(BankProgramsApiService);
  private readonly errors = inject(ErrorCodeService);
  private readonly enums = inject(PlatformEnumerationsService);

  /** Empty on a not-yet-saved program: the check needs the program's own pricing. */
  readonly programCode = input<string | null>(null);

  /** The ON-SCREEN rule (FR-028) — supplied by the host, never re-read from the server. */
  /**
   * The un-saved program to check against, when there is no saved one.
   *
   * Supplied by the CREATE wizard. `null` on an edit, where the server reads the stored
   * row's own rate and limits — which is the better answer whenever a row exists, because
   * the figures are then this program's rather than a form's current state.
   */
  readonly draftProgram = input<IncomeRuleDraftProgram | null>(null);

  readonly draft = input.required<IncomeAssumptionConfig>();

  /**
   * A product rule's structure, when the draft is one.
   *
   * Needed because the draft a BANK program posts carries only `stepParams` — the steps belong
   * to the catalog name and the server merges them in. Without them this panel could not know
   * WHICH facts to ask a sample answer for, and a ten-fact rule would be testable only by
   * guessing.
   */
  readonly ruleSteps = input<readonly RuleStep[]>([]);
  readonly ruleGates = input<readonly RuleGate[]>([]);

  readonly pending = signal(false);
  readonly result = signal<IncomeRuleCheckResult | null>(null);
  readonly error = signal<string | null>(null);

  readonly dash = '—';
  readonly anyKeyPlaceholder = $localize`:@@bank_programs.income.check_key_placeholder:Pick a value to test`;

  readonly form = this.fb.nonNullable.group({
    factKey: this.fb.control<string | null>(null),
    factValue: this.fb.control<string | null>(null),
    age: this.fb.nonNullable.control('34', [Validators.required]),
    declaredMonthlySalaryEGP: this.fb.control<string | null>('0'),
    existingMonthlyObligationsEGP: this.fb.nonNullable.control('3000', [Validators.required]),
    requestedAmountEGP: this.fb.nonNullable.control('500000', [Validators.required]),
    tenorMonths: this.fb.nonNullable.control('60', [Validators.required]),
  });

  readonly shape = computed(() => incomeMethodShape(this.draft().strategy, this.facts()));

  /**
   * Every fact this pipeline reads, with the label and the options to test it by.
   *
   * Derived from the rule, exactly as the backend's `factsReadBy` is: the rule already names
   * each fact, so a second list of "facts to ask about" could only drift out of step with it.
   */
  readonly pipelineFacts = computed(() => {
    const keys = factKeysReadBy(this.ruleSteps(), this.ruleGates());
    const byKey = new Map(this.facts().map((f) => [f.key, f]));
    return keys.map((key) => {
      const fact = byKey.get(key);
      // A DERIVED fact has no registry row: the platform computes it per quote, so the
      // platform also supplies the label and the two answers it can take. Without this the
      // panel would draw a free-text box for a closed two-option answer and the operator
      // would have to know the codes.
      if (fact === undefined && key === BANK_RELATIONSHIP_FACT_KEY) {
        return {
          key,
          label: $localize`:@@income_rule_check.fact.bank_relationship:Already a customer of this bank`,
          numeric: false,
          options: [
            {
              code: 'ntb',
              labelEn: 'No — new to this bank',
              labelAr: $localize`:@@income_rule_check.fact.bank_relationship_ntb:No — new to this bank`,
            },
            {
              code: 'xsell',
              labelEn: 'Yes — an existing customer',
              labelAr: $localize`:@@income_rule_check.fact.bank_relationship_xsell:Yes — an existing customer`,
            },
          ],
        };
      }
      return {
        key,
        label: fact?.label ?? key,
        numeric: fact?.question?.type === 'NUMERIC',
        options: fact?.question?.options ?? [],
      };
    });
  });

  /**
   * Arabic primary (Principle IV). Read from the document, like every other surface that has
   * to pick between the two labels a registry row carries.
   */
  protected readonly isAr = computed(() => document.documentElement.lang.startsWith('ar'));

  /** One sample answer per fact, by key. A plain record, not a form group: the set is data. */
  readonly sampleFacts = signal<Record<string, string>>({});

  protected sampleFactFor(key: string): string {
    return this.sampleFacts()[key] ?? '';
  }

  protected setSampleFact(key: string, value: string): void {
    // An empty answer is REMOVED rather than sent blank: an absent fact is what reproduces
    // `SURROGATE_FACT_MISSING`, which the operator needs to be able to trigger deliberately.
    const next = { ...this.sampleFacts() };
    if (value === '') delete next[key];
    else next[key] = value;
    this.sampleFacts.set(next);
  }
  readonly registry = computed(
    () => INCOME_KEY_REGISTRY[this.draft().strategy as BuiltinIncomeStrategy] ?? null,
  );

  /** The operator-defined facts, so this panel can test a `fact:` rule too. */
  private readonly facts = computed(() =>
    registryFacts(
      this.enums.membersFor('surrogate_fact')(),
      document.documentElement.lang.startsWith('ar'),
    ),
  );

  /**
   * The sample values the key picker offers.
   *
   * A built-in key method draws them from its enumeration; a registry fact draws them
   * from its bound question's options — the same list the applicant answers from, so
   * what is testable here is exactly what is answerable there.
   */
  readonly keyMembers = computed<ReadonlyArray<{ key: string; labelAr: string; labelEn: string }>>(
    () => {
      const options = factKeyOptions(this.draft().strategy, this.facts());
      if (options.length > 0) {
        return options.map((o) => ({ key: o.code, labelAr: o.labelAr, labelEn: o.labelEn }));
      }
      const type = this.registry();
      return type ? this.enums.membersFor(type)() : [];
    },
  );

  readonly keyLabel = computed(() => {
    const factKey = factKeyOf(this.draft().strategy);
    if (factKey !== null) {
      const fact = this.facts().find((f) => f.key === factKey);
      // Named after the FACT the operator picked, not after a built-in method. Falling
      // back to the key keeps the label honest for a fact that has since been retired,
      // rather than labelling it as somebody else's grade.
      return fact
        ? $localize`:@@bank_programs.income.check_fact:Sample ${fact.label}:fact:`
        : $localize`:@@bank_programs.income.check_fact_key:Sample answer for “${factKey}:fact:”`;
    }
    return this.draft().strategy === 'byMilitaryGrade'
      ? $localize`:@@bank_programs.income.check_grade:Sample military grade`
      : $localize`:@@bank_programs.income.check_rank:Sample academic rank`;
  });

  readonly valueLabel = computed(() => {
    switch (this.draft().strategy) {
      case 'byYearsInJob':
        return $localize`:@@bank_programs.income.check_years_job:Sample years in job`;
      case 'byYearsInPractice':
        return $localize`:@@bank_programs.income.check_years_practice:Sample years in practice`;
      case 'byCDValue':
        return $localize`:@@bank_programs.income.check_cd:Sample certificate value (EGP)`;
      case 'byTotalDeposits':
        return $localize`:@@bank_programs.income.check_deposits:Sample total deposits (EGP)`;
      case 'byCarInstallment':
        return $localize`:@@bank_programs.income.check_car_installment:Sample car installment (EGP)`;
      case 'byCarLoanAmount':
        return $localize`:@@bank_programs.income.check_car_loan:Sample car loan amount (EGP)`;
      case 'byCreditCardLimit':
        return $localize`:@@bank_programs.income.check_card_limit:Sample card limit (EGP)`;
      case 'byBankStatementPercent':
        return $localize`:@@bank_programs.income.check_statement:Sample statement balance (EGP)`;
      default:
        return $localize`:@@bank_programs.income.check_value:Sample value`;
    }
  });

  /** The sentence shown where the income would be. Never a zero (FR-031). */
  unresolvedLabel(r: IncomeRuleCheckResult): string {
    switch (r.unresolvedReason) {
      case 'no_matching_row':
      case 'no_matching_band':
        return $localize`:@@bank_programs.income.check_no_row:No row matched this value`;
      case 'fact_not_answered':
        return $localize`:@@bank_programs.income.check_no_fact:This applicant was not asked for the detail this method reads`;
      case 'rule_unconfigured':
        return $localize`:@@bank_programs.income.check_unconfigured:This method has no configuration yet`;
      default:
        return $localize`:@@bank_programs.income.check_no_figures:No figures for this applicant`;
    }
  }

  /** Which configured row produced the figure (FR-030). */
  matchedRowLabel(r: IncomeRuleCheckResult): string | null {
    const row = r.matchedRow;
    if (!row) return null;
    if ('key' in row) return row.key;
    return row.toExclusive === null
      ? `${row.fromInclusive} +`
      : `${row.fromInclusive} – ${row.toExclusive}`;
  }

  /**
   * Whether there is anything to check against: a saved program, or a draft carrying the
   * rate and term a quote needs.
   */
  protected readonly canRun = computed(
    () => this.programCode() !== null || this.draftProgram() !== null,
  );

  async run(): Promise<void> {
    const code = this.programCode() ?? null;
    // One or the other has to be there. The button's own disabled state says the same
    // thing; this is the guard behind it, not a second policy.
    if (code === null && this.draftProgram() === null) return;
    this.pending.set(true);
    this.error.set(null);
    try {
      const v = this.form.getRawValue();
      const sample = {
        age: Number(v.age),
        ...this.factFields(v.factKey, v.factValue),
        // A pipeline's answers, by fact key. Sent alongside the single-fact field rather
        // than instead of it: an eleven-method rule reads exactly one fact and its form
        // should not start asking for a key.
        ...(Object.keys(this.sampleFacts()).length > 0 ? { facts: this.sampleFacts() } : {}),
        declaredMonthlySalaryEGP: v.declaredMonthlySalaryEGP ?? '0',
        existingMonthlyObligationsEGP: v.existingMonthlyObligationsEGP,
        requestedAmountEGP: v.requestedAmountEGP,
        tenorMonths: Number(v.tenorMonths),
      };
      // The draft as it stands on screen, not a re-fetch (FR-028) — on either route.
      //
      // A SAVED program is checked against its stored rate, fees and limits, because those
      // are the program's own and a half-edited form is not. Only a program that has no
      // stored anything sends the form's copy.
      const program = this.draftProgram();
      const response =
        code === null
          ? await this.api.checkIncomeRuleDraft({
              program: program as IncomeRuleDraftProgram,
              incomeAssumption: this.draft(),
              sample,
            })
          : await this.api.checkIncomeRule(code, { incomeAssumption: this.draft(), sample });
      this.result.set(response.data);
    } catch (err: unknown) {
      // Mapped through the shared error-code vocabulary — never a per-component
      // English string for a code the backend also reports (A22). The rejections here
      // are the SAME ones the save path raises, so the admin reads one message for one
      // problem whichever action surfaced it.
      const envelope = (err as { error?: { code?: string; meta?: Record<string, unknown> } })
        ?.error;
      this.error.set(
        this.errors.toLocalizedMessage(
          (envelope?.code ?? 'INTERNAL_ERROR') as Parameters<
            ErrorCodeService['toLocalizedMessage']
          >[0],
          envelope?.meta,
        ),
      );
      this.result.set(null);
    } finally {
      this.pending.set(false);
    }
  }

  /**
   * Put the sample fact on the field the SELECTED method reads.
   *
   * Sending all ten would be harmless server-side but wrong here: the panel would
   * show a figure produced by a fact the admin cannot see on screen, which is the
   * opposite of "every displayed figure traces to a configured value".
   */
  private factFields(
    key: string | null,
    value: string | null,
  ): Record<string, string | number | undefined> {
    const strategy = this.draft().strategy;
    // A registry fact travels under ONE generic field, keyed by the rule's own
    // `fact:<key>`: the ten named fields below exist because live offers carry the
    // built-in tokens that read them, and adding an eleventh per new fact is the
    // release this feature removed.
    if (factKeyOf(strategy) !== null) {
      const answer = key ?? value;
      return answer ? { factValue: answer } : {};
    }
    if (key) {
      if (strategy === 'byMilitaryGrade') return { militaryGrade: key };
      if (strategy === 'byProfessorRank') return { professorRank: key };
    }
    if (value === null || value === '') return {};
    switch (strategy) {
      case 'byYearsInJob':
        return { monthsInJob: Math.round(Number(value) * 12) };
      case 'byYearsInPractice':
        return { yearsInPractice: Math.floor(Number(value)) };
      case 'byCDValue':
        return { cdValueEGP: value };
      case 'byTotalDeposits':
        return { totalDepositsEGP: value };
      case 'byCarInstallment':
        return { carInstallmentEGP: value };
      case 'byCarLoanAmount':
        return { carLoanAmountEGP: value };
      case 'byCreditCardLimit':
        return { creditCardLimitEGP: value };
      case 'byBankStatementPercent':
        return { bankStatementBalanceEGP: value };
      default:
        return {};
    }
  }
}
