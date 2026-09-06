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
  factKeyOf,
  factKeyOptions,
  incomeMethodGroups,
  incomeMethodShape,
  PRODUCT_RULE_STRATEGY,
  registryFacts,
  type BuiltinIncomeStrategy,
  type IncomeAssumptionStrategy,
  type IncomeBand,
  type IncomeKeyTableRow,
  type IncomeMethodShape,
  type ProductRuleOutput,
  type RuleGate,
  type RuleStep,
  type StepFigures,
} from '@features/bank-programs/bank-programs.types';
import { IncomeBandsEditorComponent, incomeBandsErrorFor } from './income-bands-editor.component';
import { IncomeKeyTableComponent, incomeKeyTableErrorFor } from './income-key-table.component';
import { ProductRuleEditorComponent } from './product-rule-editor.component';
import { incomeRuleHasError } from './income-rule.rules';

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
    ProductRuleEditorComponent,
  ],
  providers: [provideNzIconsPatch([CalculatorOutline, WarningOutline])],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="section" [formGroup]="group()" id="income-assumption">
      <!-- No header of its own. Both hosts already say what this block is, one line
           above it, in words that fit where it sits: the catalog asks what the NAME
           reads, the wizard says what the name already decided. A third heading in
           between read as a second question. -->
      @if (showProofPicker()) {
        <p class="proof-lede" i18n="@@income_rule.proof_lede">
          Every bank selling this name works the income out from this one figure. A bank may change
          the amounts below, never the figure.
        </p>
      } @else if (showPipelineLede()) {
        <!-- A pipeline reads several answers, so "this one figure" would be false. It also
             cannot be re-pointed from here: the steps ARE the product, and the picker below
             is hidden rather than offered blank. -->
        <p class="proof-lede" i18n="@@income_rule.pipeline_lede">
          This name is a product of its own: the steps below are what it works the figure out from,
          and they are set up when the product is added. A bank changes only the amounts.
        </p>
      }

      <div class="grid">
        @if (showProofPicker()) {
          <nz-form-item class="span-2 method-field">
            <nz-form-label [nzFor]="'strategy'" i18n="@@income_rule.field.proof"
              >What the income is worked out from</nz-form-label
            >
            <nz-form-control>
              <!-- Grouped by what the method READS, so the four whose fact can simply be
                 missing are visibly a different kind of choice from the six that read a
                 document, and from Declared, which is not a rule at all.

                 The panel is styled by 'select-grouped-dropdown' (global — it renders in
                 a CDK overlay, outside every component's scope), which gives each group
                 heading its own band so three headings cannot read as three more options.
                 That class sets 40px rows, and the list is virtual-scrolled, so
                 nzOptionHeightPx MUST stay equal to it or every row slides out from
                 under its own slot. 8.5 rows of viewport, not 8: a half-visible row is
                 the only thing that says the list continues. -->
              <nz-select
                id="strategy"
                formControlName="strategy"
                nzDropdownClassName="select-grouped-dropdown"
                [nzOptionHeightPx]="40"
                [nzOptionOverflowSize]="8.5"
              >
                @for (g of methodGroups(); track g.label) {
                  <nz-option-group [nzLabel]="g.label">
                    @for (o of g.options; track o.value) {
                      <nz-option [nzValue]="o.value" [nzLabel]="o.label"></nz-option>
                    }
                  </nz-option-group>
                }
              </nz-select>
            </nz-form-control>
          </nz-form-item>
        }

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
                [enumerationType]="keyRegistry()"
                [keyOptions]="factKeyRows()"
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
                      [attr.aria-describedby]="'legacyScalarValueHint'"
                      (blur)="touchScalar()"
                    />
                    <!-- Same arithmetic note as the canonical scalar editor. These two
                         methods divide by 12; the one next door does not, and this field
                         is the one most likely to be edited by someone who has only ever
                         seen the other. -->
                    <p class="rule-hint" id="legacyScalarValueHint">{{ scalarHint() }}</p>
                  </nz-form-control>
                </nz-form-item>
              }
            </div>
          }
          @case ('scalar') {
            <div class="span-2 rule-block" formGroupName="scalar">
              <h4 class="rule-title">{{ scalarTitle() }}</h4>
              <nz-form-item class="numeric">
                <nz-form-label [nzFor]="'scalarValue'">{{ scalarLabel() }}</nz-form-label>
                <nz-form-control>
                  <input
                    nz-input
                    id="scalarValue"
                    formControlName="value"
                    inputmode="decimal"
                    [attr.aria-describedby]="scalarError() ? 'scalarValueError' : 'scalarValueHint'"
                    (blur)="touchScalar()"
                  />
                  <!-- The ARITHMETIC, spelled out with a worked example.
                       Load-bearing, not decoration: the six scalar methods do NOT agree
                       on it. A percent of a car loan or a certificate is annual and gets
                       divided by 12; a percent of a statement balance is already monthly
                       and is not. So the same "10" typed into two of these fields means
                       two different incomes, and the label alone ("Percent of …") cannot
                       tell them apart. -->
                  <p class="rule-hint" id="scalarValueHint">{{ scalarHint() }}</p>
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
          @case ('steps') {
            <!-- No bordered block and no heading of its own: the editor below draws its own
                 groups, and both hosts already titled this section one line above it. A
                 third frame around a rule that is mostly hairlines read as a box in a box
                 in a box. -->
            <div class="span-2">
              <app-product-rule-editor
                [steps]="ruleSteps()"
                [gates]="ruleGates()"
                [output]="ruleOutput()"
                [figures]="stepFigures()"
                (figuresChange)="stepFigures.set($event)"
                (figuresTouched)="stepFiguresTouched.emit()"
                [variant]="variant()"
                [facts]="facts()"
                [waysAre]="waysAre()"
                [wayId]="wayId()"
                (wayIdChange)="wayId.set($event)"
                [figuresAreOwn]="figuresAreOwn()"
                [catalogFigures]="catalogFigures()"
                [showsCatalogDefaults]="showsCatalogDefaults()"
              ></app-product-rule-editor>
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
        @if (showPolicy() && shape() !== 'none') {
          <!-- The comment above has named these three "policy on top of the method" since
               they were written; the screen never did. Sitting in the same grid directly
               under the ways, they read as fields OF the way just picked — and a
               debt-burden cap is not part of how the figure is worked out. -->
          <h4 class="policy-label" i18n="@@bank_programs.income.policy_label">
            Policy on top of this method
          </h4>
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
                  <nz-option
                    [nzValue]="doc.key"
                    [nzLabel]="isAr ? doc.labelAr : doc.labelEn"
                  ></nz-option>
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
  // The wizard's shared section rhythm. Still reached by relative path after this
  // component moved to `shared/`, because the stylesheet is the FORM's grid and label
  // vocabulary — copying it here would fork the two, and the catalog page renders this
  // component inside its own card, where the same rhythm is what makes it look native.
  styleUrls: ['../../features/bank-programs/form/sections/section.styles.scss'],
  styles: [
    `
      /* The band ramp, shared with the section's other labels. span-2 so it heads the
         row rather than sitting in the first column of it. */
      .policy-label {
        grid-column: span 2;
        margin: var(--space-2) 0 0;
        font-size: var(--text-xs);
        font-weight: var(--font-semibold);
        letter-spacing: var(--tracking-wide);
        text-transform: uppercase;
        color: var(--color-text-secondary);
      }

      /* The catalog's one-line statement of the rule, above the picker. Plain text on
         the card surface — a callout box here would be the third bordered thing on a
         screen whose whole job is one choice. */
      .proof-lede {
        margin: 0 0 var(--space-4);
        color: var(--text-secondary);
        font-size: 0.8125rem;
        line-height: 1.55;
        max-inline-size: 62ch;
      }

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

      /* The method picker holds eleven short labels. Left at the section's full
         two-column width it renders a trigger the better part of two thousand
         pixels wide — and, because the panel matches the trigger, a dropdown of
         the same width with one twenty-character label per row. Capped to a
         width a single value reads at; the panel follows the trigger. */
      .method-field ::ng-deep nz-select {
        display: block;
        max-inline-size: 34rem;
      }
      /* The caret answers "is it open?" without the panel in view. .anticon-down
         only — there is no search here today, but the arrow slot swaps the glyph
         if one is ever added, and a rotated magnifier just reads as broken. */
      .method-field ::ng-deep .ant-select-arrow .anticon-down {
        transition: transform var(--motion-duration-base) var(--motion-easing-standard);
      }
      .method-field ::ng-deep nz-select.ant-select-open .ant-select-arrow .anticon-down {
        transform: rotate(180deg);
      }
      @media (prefers-reduced-motion: reduce) {
        .method-field ::ng-deep .ant-select-arrow .anticon-down {
          transition: none;
        }
      }
    `,
  ],
})
export class IncomeAssumptionSectionComponent implements OnInit {
  private readonly modal = inject(NzModalService);
  private readonly enums = inject(PlatformEnumerationsService);
  private readonly destroyRef = inject(DestroyRef);

  /**
   * The facts an operator has defined on Manage values, from the same signal cache the
   * key pickers read. A computed, not a snapshot: the four built-in methods are static
   * but the registry is not, and a fact added while this form is open must appear in
   * the picker on the next read rather than after a reload.
   */
  protected readonly facts = computed(() =>
    registryFacts(this.enums.membersFor('surrogate_fact')(), this.isAr),
  );

  // `protected`, not private: the document option list reads it to pick a locale's label.
  protected readonly isAr = document.documentElement.lang.startsWith('ar');

  /** Built-in methods plus one entry per operator-defined fact. */
  protected readonly methodGroups = computed(() => incomeMethodGroups(this.facts()));

  /** The `incomeAssumption` form group: strategy, scalar, override, combination, docs. */
  readonly group = input.required<FormGroup>();

  /**
   * WHO is editing this rule, which decides two things at once.
   *
   *   'catalog'  the program NAME's own rule. The proof picker is shown — this is where
   *              the one figure is chosen — and the bank-policy controls are hidden,
   *              because a DBR cap and a document list belong to a bank, not to a name.
   *   'program'  a bank's rule. The proof picker is HIDDEN: the name already decided,
   *              and the server refuses a program that reads anything else. Policy is
   *              shown, because that half really is the bank's.
   *
   * One input rather than three booleans (`showHeader` / `showPicker` / `showPolicy`):
   * the three always move together, and separating them invites a future caller to
   * assemble a combination that means nothing — a bank picking its own proof, or a
   * catalog name carrying a debt-burden cap.
   */
  readonly variant = input<'program' | 'catalog'>('program');

  /** The catalog chooses the proof; a bank program is told it. */
  protected readonly showProofPicker = computed(
    () => this.variant() === 'catalog' && !this.pipelineLocked(),
  );

  /**
   * A product rule cannot be re-pointed from this control, so the control is not offered.
   *
   * `steps` is deliberately absent from `incomeMethodGroups()` — a pipeline is not a twelfth
   * method — which left the select rendering a BLANK trigger over a live product, and every
   * option in it a one-click way to replace the product's structure with a single-figure
   * table (`ruleFromForm` sends whatever the control holds). Naming the state and hiding the
   * control says the same thing without the trapdoor.
   */
  protected readonly pipelineLocked = computed(
    () => this.strategy() === PRODUCT_RULE_STRATEGY && this.ruleSteps().length > 0,
  );

  /**
   * The catalog's own line about a pipeline. Not shown on a bank program: the wizard already
   * says whose amounts these are, twice, immediately above this section.
   */
  protected readonly showPipelineLede = computed(
    () => this.variant() === 'catalog' && this.pipelineLocked(),
  );

  /** Bank policy on top of the method. Never a catalog name's business. */
  protected readonly showPolicy = computed(() => this.variant() === 'program');

  /**
   * The two TABLE shapes are signals, not form controls — the same pattern
   * `dbrBands` already uses on this form. A `FormArray` of row groups would give the
   * band linkage two owners (the array and the relink), which is how a gap appears.
   */
  readonly keyTable = model<IncomeKeyTableRow[]>([]);
  readonly bands = model<IncomeBand[]>([]);

  /**
   * A product rule's two halves. The STRUCTURE is the catalog name's and arrives from the
   * host (which already fetches the name's rule for the whose-amounts card); the FIGURES are
   * the bank's and are edited here.
   *
   * Inputs rather than derived from the form group, for the same reason `keyTable` and `bands`
   * are signals rather than controls: a pipeline is not a flat set of named fields, and
   * modelling one as controls would mean a control per step of a shape only the catalog knows.
   */
  readonly ruleSteps = input<readonly RuleStep[]>([]);
  readonly ruleGates = input<readonly RuleGate[]>([]);
  readonly ruleOutput = input<ProductRuleOutput | null>(null);
  readonly stepFigures = model<Record<string, StepFigures>>({});
  readonly stepFiguresTouched = output<void>();
  /** The catalog's statement that a bank sells ONE of the product's ways. */
  readonly waysAre = input<'exclusive' | null>(null);
  /** Which way this bank sells. Written by the picker inside the editor. */
  readonly wayId = model<string | null>(null);
  /**
   * Are the figures below this program's own, or the catalog's shown read-only?
   *
   * Passed straight through to the editor, which is the only thing that reads it. Default
   * `true` keeps both catalog hosts — where there is no such thing as someone else's
   * amounts — exactly as they were.
   */
  readonly figuresAreOwn = input<boolean>(true);

  /**
   * The surrogate product's own figures, so a box this bank left blank can offer the number
   * the product states. Pass-through: the derivation and the affordance both live in the
   * editor, and this section is the wizard's only route to it.
   */
  readonly catalogFigures = input<Readonly<Record<string, StepFigures>>>({});
  readonly showsCatalogDefaults = input<boolean>(false);

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

  readonly shape = computed<IncomeMethodShape>(() =>
    incomeMethodShape(this.strategy(), this.facts()),
  );

  readonly keyRegistry = computed<EnumerationType | null>(
    () => INCOME_KEY_REGISTRY[this.strategy() as BuiltinIncomeStrategy] ?? null,
  );

  /**
   * A fact's key rows — its bound question's options. `null` for the built-in key
   * methods, which draw theirs from an enumeration instead.
   */
  readonly factKeyRows = computed(() => {
    const options = factKeyOptions(this.strategy(), this.facts());
    return options.length > 0
      ? options.map((o) => ({ key: o.code, labelAr: o.labelAr, labelEn: o.labelEn }))
      : null;
  });

  /**
   * The chosen fact, when the method is one — for the line that tells the operator
   * which answer this table will be looked up by, and whether it is still asked.
   */
  readonly selectedFact = computed(() => {
    const key = factKeyOf(this.strategy());
    return key === null ? null : (this.facts().find((f) => f.key === key) ?? null);
  });

  readonly bandUnit = computed<string | null>(
    () => INCOME_BAND_UNIT[this.strategy() as BuiltinIncomeStrategy] ?? null,
  );

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

  /**
   * WHOSE figure this is. On the catalog it is the name's, shared by every bank —
   * calling it "the bank's figure" there says the opposite of what the screen is for.
   */
  readonly scalarTitle = computed(() =>
    this.variant() === 'catalog'
      ? $localize`:@@income_rule.scalar_title_catalog:The figure banks start from`
      : $localize`:@@income_rule.scalar_title_program:This bank's figure`,
  );

  /**
   * What the engine DOES with the number, as a sentence and a worked example.
   *
   * Written from `income-resolver.ts` case by case, because the six methods disagree in
   * a way no label can convey: `byCarLoanAmount`, `byCDValue` and `byTotalDeposits`
   * treat the percent as ANNUAL and divide by 12, `byBankStatementPercent` does not, and
   * the two multiplier methods divide by nothing. An operator typing 10 into two of
   * these fields is setting two different incomes, and until now the screen said only
   * "Percent of …" for both.
   *
   * The examples use round numbers so the arithmetic can be checked at a glance — the
   * point is to make a wrong entry obvious before it is saved, not to look tidy.
   */
  readonly scalarHint = computed(() => {
    switch (this.strategy()) {
      case 'byCarInstallment':
        return $localize`:@@income_rule.scalar_hint_car_installment:Installment × this number. A 5,000 EGP installment × 4 = 20,000 EGP a month.`;
      case 'byCreditCardLimit':
        return $localize`:@@income_rule.scalar_hint_card_limit:Card limit × this number. A 100,000 EGP limit × 0.1 = 10,000 EGP a month.`;
      case 'byCarLoanAmount':
        return $localize`:@@income_rule.scalar_hint_car_loan:This percent of the loan, per YEAR, divided into months. 5% of 300,000 EGP = 1,250 EGP a month.`;
      case 'byBankStatementPercent':
        return $localize`:@@income_rule.scalar_hint_bank_statement:This percent of the balance, already MONTHLY — not divided by 12. 10% of 200,000 EGP = 20,000 EGP a month.`;
      case 'byCDValue':
        return $localize`:@@income_rule.scalar_hint_cd:This percent of the certificate, per YEAR, divided into months. 3% of 400,000 EGP = 1,000 EGP a month.`;
      case 'byTotalDeposits':
        return $localize`:@@income_rule.scalar_hint_deposits:This percent of total deposits, per YEAR, divided into months. 2% of 600,000 EGP = 1,000 EGP a month.`;
      default:
        return '';
    }
  });

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
    void this.enums.preload([
      'required_document',
      'professor_rank',
      'military_grade',
      // The fact registry — without it the picker offers the four built-ins only, and
      // an operator who just defined a fact would not find it here.
      'surrogate_fact',
    ]);

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

      const previousShape = incomeMethodShape(previous, this.facts());
      const nextShape = incomeMethodShape(next, this.facts());
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
    if (nextShape !== 'keyTable' && this.keyTable().length > 0) {
      this.keyTable.set([]);
    }
    if (nextShape !== 'bands' && this.bands().length > 0) {
      this.bands.set([]);
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
