import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input, model, output } from '@angular/core';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzIconModule, provideNzIconsPatch } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import {
  CheckCircleOutline,
  MinusCircleOutline,
  PlusCircleOutline,
} from '@ant-design/icons-angular/icons';
import {
  STEP_OP_SHAPE,
  gateIsConfigured,
  optionalStepIds,
  stepIsConfigured,
  stepRefs,
  stepTakesFigures,
  type IncomeBand,
  type IncomeKeyTableRow,
  type ProductRuleOutput,
  type RegistryFact,
  type RuleGate,
  type RuleStep,
  type StepFigures,
} from '@features/bank-programs/bank-programs.types';
import { IncomeBandsEditorComponent } from './income-bands-editor.component';
import { IncomeKeyTableComponent } from './income-key-table.component';

/**
 * One row of the editor — a step or a gate, with everything the template needs already
 * decided. Computed once rather than asked five times from the template, which is how a
 * `@for` ends up calling `stepIsConfigured` on every change detection pass.
 */
interface EditorRow {
  kind: 'step' | 'gate';
  id: string;
  /** What this row DOES, in the operator's words. */
  title: string;
  /** How the figure is used, when that is not obvious from the title. */
  hint: string;
  shape: 'keyTable' | 'bands' | 'scalar' | 'none' | 'minmax' | 'applies';
  /** The bank may leave this blank — a derivation or a condition it declines. */
  optional: boolean;
  configured: boolean;
  /** For a key-table row: the option codes the keys must come from, when known. */
  keyOptions: readonly { key: string; labelEn: string; labelAr: string }[] | null;
  unit: string | null;
}

/**
 * A product rule — the compound-ownership guarantee, the club-membership loan — in the two
 * halves it is actually authored in.
 *
 * ─── Why one component and not two ────────────────────────────────────────────
 *
 * `variant` decides which half is editable, exactly as it does on the income-assumption
 * section this sits inside:
 *
 *   'catalog'  the program NAME's own rule. The pipeline is shown as a numbered, readable
 *              summary and the figures are hidden — the catalog states the SHAPE, and its
 *              banks disagree about every number in it.
 *   'program'  a bank's rule. The pipeline is shown the same way, and each step it may state
 *              a figure for gets the editor its op calls for.
 *
 * ─── Why the figure editors are the existing ones ─────────────────────────────
 *
 * A step's table is the same `IncomeKeyTableRow[]` / `IncomeBand[]` the eleven single-fact
 * methods use, so `app-income-key-table` and `app-income-bands-editor` draw it unchanged —
 * with their ordering, their validation, and their estimated-value markers. A new OP that
 * reuses a shape therefore costs no new UI at all; only a genuinely new shape would.
 *
 * ─── One deliberate scope cut, stated ─────────────────────────────────────────
 *
 * The catalog variant does not yet let an operator AUTHOR a pipeline — add a step, pick an
 * op, wire a reference. Adding a new PRODUCT is still an API or seed action
 * (`PUT admin/bank-programs/program-names/:key/income-rule`, `npm run seed:collateral`).
 * Configuring a bank on an existing product, which is the daily task and the one four banks
 * multiply, is fully here. A graph editor is its own feature and would be a worse one built
 * in a hurry beside this.
 */
@Component({
  selector: 'app-product-rule-editor',
  standalone: true,
  imports: [
    CommonModule,
    NzFormModule,
    NzIconModule,
    NzInputModule,
    IncomeBandsEditorComponent,
    IncomeKeyTableComponent,
  ],
  providers: [provideNzIconsPatch([CheckCircleOutline, MinusCircleOutline, PlusCircleOutline])],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="pipeline">
      <!-- What the rule produces. Said first, because every figure below is in service of it. -->
      <p class="pipeline-output">
        @if (output()?.kind === 'maxAmount') {
          <span i18n="@@product_rule.output.max_amount"
            >This product works out the most the customer's property or membership can support.
            Their salary is not read.</span
          >
        } @else {
          <span i18n="@@product_rule.output.monthly_income"
            >This product works out an assumed monthly income from the answers below.</span
          >
        }
      </p>

      @if (variant() === 'program' && activeDerivation(); as active) {
        <p class="pipeline-active">
          <i nz-icon nzType="check-circle"></i>
          <span i18n="@@product_rule.active_derivation"
            >This bank works the ceiling out from: {{ active }}</span
          >
        </p>
      }

      <ol class="steps">
        @for (row of rows(); track row.id) {
          <li class="step" [class.is-optional]="row.optional" [class.is-off]="!row.configured">
            <div class="step-head">
              <span class="step-title">{{ row.title }}</span>
              @if (row.optional && !row.configured) {
                <span class="step-tag" i18n="@@product_rule.step.not_used"
                  >Not used by this bank</span
                >
              }
              @if (!row.optional && !row.configured && variant() === 'program') {
                <span class="step-tag is-warn" i18n="@@product_rule.step.needs_figures"
                  >Needs figures</span
                >
              }
            </div>
            @if (row.hint) {
              <p class="step-hint">{{ row.hint }}</p>
            }

            @if (variant() === 'program' && row.shape !== 'none') {
              @switch (row.shape) {
                @case ('keyTable') {
                  <app-income-key-table
                    [rows]="tableFor(row.id)"
                    (rowsChange)="setTable(row.id, $event)"
                    [keyOptions]="row.keyOptions"
                    [estimatedKeys]="noEstimatedKeys"
                  ></app-income-key-table>
                }
                @case ('bands') {
                  <app-income-bands-editor
                    [bands]="bandsFor(row.id)"
                    (bandsChange)="setBands(row.id, $event)"
                    [unit]="row.unit"
                    [estimatedIndexes]="noEstimatedIndexes"
                  ></app-income-bands-editor>
                }
                @case ('scalar') {
                  <label class="figure">
                    <span class="figure-label">{{ row.unit ?? '' }}</span>
                    <input
                      nz-input
                      inputmode="decimal"
                      [value]="scalarFor(row.id)"
                      (input)="setScalar(row.id, $any($event.target).value)"
                      [attr.aria-label]="row.title"
                    />
                  </label>
                }
                @case ('minmax') {
                  <div class="figure-pair">
                    @if (wantsMin(row.id)) {
                      <label class="figure">
                        <span class="figure-label" i18n="@@product_rule.gate.at_least"
                          >At least</span
                        >
                        <input
                          nz-input
                          inputmode="decimal"
                          [value]="minFor(row.id)"
                          (input)="setBound(row.id, 'minValue', $any($event.target).value)"
                        />
                      </label>
                    }
                    @if (wantsMax(row.id)) {
                      <label class="figure">
                        <span class="figure-label" i18n="@@product_rule.gate.at_most">At most</span>
                        <input
                          nz-input
                          inputmode="decimal"
                          [value]="maxFor(row.id)"
                          (input)="setBound(row.id, 'maxValue', $any($event.target).value)"
                        />
                      </label>
                    }
                  </div>
                }
                @case ('applies') {
                  <button
                    type="button"
                    class="applies"
                    role="switch"
                    [attr.aria-checked]="appliesFor(row.id)"
                    [class.is-on]="appliesFor(row.id)"
                    (click)="toggleApplies(row.id)"
                  >
                    <span class="applies-dot"></span>
                    <span i18n="@@product_rule.gate.applies">This bank applies this condition</span>
                  </button>
                }
              }
            }
          </li>
        }
      </ol>

      @if (variant() === 'catalog') {
        <p class="pipeline-note" i18n="@@product_rule.catalog_note">
          These are the steps every bank selling this name runs. Each bank fills in its own figures
          on its own program — the amounts are never stated here.
        </p>
      }
    </div>
  `,
  styles: [
    `
      .pipeline {
        display: flex;
        flex-direction: column;
        gap: var(--space-3);
      }
      .pipeline-output,
      .pipeline-note {
        margin: 0;
        color: var(--text-secondary);
        font-size: var(--font-size-sm);
        line-height: var(--line-height-relaxed);
      }
      .pipeline-active {
        display: flex;
        align-items: center;
        gap: var(--space-2);
        margin: 0;
        padding: var(--space-2) var(--space-3);
        border-inline-start: 2px solid var(--color-success);
        background: var(--surface-sunken);
        border-radius: var(--radius-sm);
        color: var(--text-primary);
        font-size: var(--font-size-sm);
      }
      .steps {
        display: flex;
        flex-direction: column;
        gap: var(--space-3);
        margin: 0;
        padding: 0;
        list-style: none;
        counter-reset: step;
      }
      .step {
        position: relative;
        padding-inline-start: var(--space-5);
        counter-increment: step;
      }
      .step::before {
        content: counter(step);
        position: absolute;
        inset-inline-start: 0;
        inset-block-start: 0;
        display: grid;
        place-items: center;
        inline-size: 1.5rem;
        block-size: 1.5rem;
        border-radius: 50%;
        background: var(--surface-sunken);
        color: var(--text-secondary);
        font-size: var(--font-size-xs);
        font-variant-numeric: tabular-nums;
      }
      .step.is-off::before {
        opacity: 0.45;
      }
      .step-head {
        display: flex;
        flex-wrap: wrap;
        align-items: baseline;
        gap: var(--space-2);
      }
      .step-title {
        color: var(--text-primary);
        font-weight: var(--font-weight-medium);
      }
      .step.is-off .step-title {
        color: var(--text-secondary);
      }
      .step-tag {
        padding: 0 var(--space-2);
        border-radius: var(--radius-sm);
        background: var(--surface-sunken);
        color: var(--text-tertiary);
        font-size: var(--font-size-xs);
      }
      .step-tag.is-warn {
        background: var(--color-warning-bg);
        color: var(--color-warning-text);
      }
      .step-hint {
        margin: var(--space-1) 0 var(--space-2);
        color: var(--text-tertiary);
        font-size: var(--font-size-xs);
        line-height: var(--line-height-relaxed);
      }
      .figure,
      .figure-pair {
        display: flex;
        align-items: center;
        gap: var(--space-2);
      }
      .figure-pair {
        flex-wrap: wrap;
        gap: var(--space-4);
      }
      .figure-label {
        color: var(--text-secondary);
        font-size: var(--font-size-xs);
        white-space: nowrap;
      }
      .figure input {
        max-inline-size: 12rem;
      }
      .applies {
        display: inline-flex;
        align-items: center;
        gap: var(--space-2);
        padding: var(--space-1) var(--space-3);
        border: 1px solid var(--color-border);
        border-radius: var(--radius-pill);
        background: var(--surface-raised);
        color: var(--text-secondary);
        font: inherit;
        font-size: var(--font-size-sm);
        cursor: pointer;
      }
      .applies.is-on {
        border-color: var(--color-brand-primary);
        color: var(--text-primary);
      }
      .applies-dot {
        inline-size: 0.6rem;
        block-size: 0.6rem;
        border-radius: 50%;
        background: var(--color-border-strong);
      }
      .applies.is-on .applies-dot {
        background: var(--color-brand-primary);
      }
    `,
  ],
})
export class ProductRuleEditorComponent {
  /** The catalog name's structure. Read-only in both variants — a bank cannot restate it. */
  readonly steps = input<readonly RuleStep[]>([]);
  readonly gates = input<readonly RuleGate[]>([]);
  readonly output = input<ProductRuleOutput | null>(null);

  /** The BANK's figures, by step id and gate id. The only half a program stores. */
  readonly figures = model<Record<string, StepFigures>>({});

  readonly variant = input<'program' | 'catalog'>('program');

  /** The fact registry, so a step can be titled by the question it reads. */
  readonly facts = input<readonly RegistryFact[]>([]);

  /** Raised whenever a figure changes, so the host can mark the form dirty. */
  readonly figuresTouched = output<void>();

  /**
   * No estimated-value markers on a step's figures — yet.
   *
   * The marker paths for a pipeline are `stepParams.<id>.keyTable.<key>.incomeEGP`, which the
   * backend's walker already produces (it recurses `stepParams` by key with no change). Wiring
   * the host's marker map through per step is the remaining half, and passing an empty set is
   * the honest interim: no figure is CLAIMED to be team-estimated, rather than one being marked
   * on the wrong row. Shared constants so the template does not allocate a new set per pass.
   */
  protected readonly noEstimatedKeys: ReadonlySet<string> = new Set<string>();
  protected readonly noEstimatedIndexes: ReadonlySet<number> = new Set<number>();

  private readonly factByKey = computed(() => new Map(this.facts().map((f) => [f.key, f])));

  private readonly optional = computed(() => optionalStepIds(this.steps(), this.gates()));

  private readonly configuredStepIds = computed(() => {
    const figures = this.figures();
    return new Set(
      this.steps()
        .filter((step) => stepIsConfigured(step, figures[step.id]))
        .map((step) => step.id),
    );
  });

  /**
   * Which derivation this bank actually uses, named in its own words.
   *
   * The single most useful line on the screen: a compound rule offers four ways to work the
   * ceiling out and a bank fills exactly one, so "which one is live here" is otherwise
   * something the operator has to infer from which table happens to have rows in it.
   */
  protected readonly activeDerivation = computed<string | null>(() => {
    const configured = this.configuredStepIds();
    for (const step of this.steps()) {
      if (step.op !== 'coalesce') continue;
      for (const ref of stepRefs(step)) {
        if ('step' in ref && configured.has(ref.step)) {
          const chosen = this.steps().find((s) => s.id === ref.step);
          if (chosen) return this.titleFor(chosen);
        }
      }
    }
    return null;
  });

  protected readonly rows = computed<EditorRow[]>(() => {
    const figures = this.figures();
    const optional = this.optional();
    const configuredSteps = this.configuredStepIds();

    const stepRows: EditorRow[] = this.steps().map((step) => {
      const shape = stepTakesFigures(step) ? STEP_OP_SHAPE[step.op] : 'none';
      return {
        kind: 'step',
        id: step.id,
        title: this.titleFor(step),
        hint: this.hintFor(step),
        shape: shape === 'steps' ? 'none' : shape,
        optional: optional.has(step.id),
        configured: stepIsConfigured(step, figures[step.id]),
        keyOptions: this.keyOptionsFor(step),
        unit: this.unitFor(step),
      };
    });

    const gateRows: EditorRow[] = this.gates().map((gate) => ({
      kind: 'gate',
      id: gate.id,
      title: this.gateTitleFor(gate),
      hint: this.gateHintFor(gate),
      shape:
        gate.kind === 'choice' ? 'applies' : gate.kind === 'numberByKey' ? 'keyTable' : 'minmax',
      // Every gate is optional by construction: the catalog offers the condition and the bank
      // turns on the one it applies (see `GateParams` on the backend).
      optional: true,
      configured: gateIsConfigured(gate, figures[gate.id], configuredSteps),
      keyOptions: gate.kind === 'numberByKey' ? this.factOptionsFor(gate.keyedBy) : null,
      unit: null,
    }));

    return [...stepRows, ...gateRows];
  });

  // --- figure accessors ------------------------------------------------------

  protected tableFor(id: string): IncomeKeyTableRow[] {
    return this.figures()[id]?.keyTable ?? [];
  }

  protected bandsFor(id: string): IncomeBand[] {
    return this.figures()[id]?.bands ?? [];
  }

  protected scalarFor(id: string): string {
    const f = this.figures()[id];
    // `constant` states a plain amount; every other scalar op states a percentage or a
    // multiplier. Two fields would ask the operator which kind of number they are typing.
    return f?.valueEGP ?? f?.scalar?.value ?? '';
  }

  /**
   * Which bound a gate actually needs — `gte` asks for a floor, `lte` for a ceiling, and only
   * `between` for both. Rendering both fields for every gate would invite an operator to fill
   * in one the engine never reads.
   */
  protected wantsMin(id: string): boolean {
    const gate = this.gates().find((g) => g.id === id);
    if (gate === undefined || gate.kind !== 'number') return false;
    return gate.op === 'gte' || gate.op === 'gt' || gate.op === 'between';
  }

  protected wantsMax(id: string): boolean {
    const gate = this.gates().find((g) => g.id === id);
    if (gate === undefined || gate.kind !== 'number') return false;
    return gate.op === 'lte' || gate.op === 'lt' || gate.op === 'between';
  }

  protected minFor(id: string): string {
    return this.figures()[id]?.minValue ?? '';
  }

  protected maxFor(id: string): string {
    return this.figures()[id]?.maxValue ?? '';
  }

  protected appliesFor(id: string): boolean {
    return this.figures()[id]?.applies === true;
  }

  protected setTable(id: string, rows: IncomeKeyTableRow[]): void {
    this.patch(id, { keyTable: rows });
  }

  protected setBands(id: string, bands: IncomeBand[]): void {
    this.patch(id, { bands });
  }

  protected setScalar(id: string, raw: string): void {
    const step = this.steps().find((s) => s.id === id);
    if (step?.op === 'constant') {
      this.patch(id, { valueEGP: raw });
      return;
    }
    const unit = step?.op === 'multiply' ? 'multiplier' : 'percent';
    this.patch(id, { scalar: { value: raw, unit } });
  }

  protected setBound(id: string, key: 'minValue' | 'maxValue', raw: string): void {
    this.patch(id, { [key]: raw });
  }

  protected toggleApplies(id: string): void {
    // Written as `undefined` rather than `false` when turned off, so the stored blob says
    // "this bank stated nothing here" — which is what an unapplied gate IS, and what the
    // server reads it as.
    const next = this.appliesFor(id) ? undefined : true;
    this.patch(id, { applies: next });
  }

  private patch(id: string, part: Partial<StepFigures>): void {
    const current = this.figures();
    const merged: StepFigures = { ...(current[id] ?? {}), ...part };
    for (const [key, value] of Object.entries(part)) {
      // An empty string and an absent key are the same statement — "nothing here" — and
      // storing the empty string would make a blank field look like a figure of zero.
      if (value === undefined || value === '') delete (merged as Record<string, unknown>)[key];
    }
    this.figures.set({ ...current, [id]: merged });
    this.figuresTouched.emit();
  }

  // --- naming ---------------------------------------------------------------
  //
  // Every label is derived from the op and the fact, never stored. A stored label would be a
  // second description of the step, free to disagree with what it does — and it would have to
  // be translated per rule, which no operator should be asked to do.

  private titleFor(step: RuleStep): string {
    const factLabel = step.fact ? this.factLabel(step.fact) : '';
    switch (step.op) {
      case 'constant':
        return $localize`:@@product_rule.step.constant:A figure this bank sets`;
      case 'factNumber':
        return $localize`:@@product_rule.step.fact_number:Reads the answer: ${factLabel}:factLabel:`;
      case 'factChoiceTable':
        return $localize`:@@product_rule.step.fact_table:A table keyed by the answer: ${factLabel}:factLabel:`;
      case 'factParentTable':
        return $localize`:@@product_rule.step.fact_parent_table:A table keyed by the class of: ${factLabel}:factLabel:`;
      case 'bandTable':
        return $localize`:@@product_rule.step.band_table:A table of ranges`;
      case 'percentOf':
        return $localize`:@@product_rule.step.percent_of:A percentage of an earlier figure`;
      case 'upliftPercent':
        return $localize`:@@product_rule.step.uplift:An increase on an earlier figure`;
      case 'multiply':
        return $localize`:@@product_rule.step.multiply:An earlier figure multiplied`;
      case 'sum':
        return $localize`:@@product_rule.step.sum:Earlier figures added together`;
      case 'subtract':
        return $localize`:@@product_rule.step.subtract:One earlier figure less another`;
      case 'minOf':
        return $localize`:@@product_rule.step.min_of:The smallest of the earlier figures`;
      case 'maxOf':
        return $localize`:@@product_rule.step.max_of:The largest of the earlier figures`;
      case 'coalesce':
        return $localize`:@@product_rule.step.coalesce:Whichever of the above this bank filled in`;
      default:
        return step.id;
    }
  }

  private hintFor(step: RuleStep): string {
    if (step.op === 'coalesce') {
      return $localize`:@@product_rule.step.coalesce_hint:Fill in exactly one of the tables above. The rest are other banks' ways of working the same figure out.`;
    }
    if (
      STEP_OP_SHAPE[step.op] === 'scalar' &&
      step.op !== 'constant' &&
      stepRefs(step).length >= 2
    ) {
      return $localize`:@@product_rule.step.factor_from_answer:The percentage comes from the customer's own answer, so there is nothing to type here.`;
    }
    return '';
  }

  private gateTitleFor(gate: RuleGate): string {
    switch (gate.reasonCode) {
      case 'DOWN_PAYMENT_BELOW_MIN':
        return $localize`:@@product_rule.gate.down_payment:Minimum the customer must have paid`;
      case 'UNIT_PRICE_BELOW_MIN':
        return $localize`:@@product_rule.gate.unit_price:Minimum unit price, by the year of the contract`;
      case 'CONTRACT_TOO_NEW':
        return $localize`:@@product_rule.gate.owned_min:How long the unit must have been owned`;
      case 'CONTRACT_TOO_OLD':
        return $localize`:@@product_rule.gate.owned_max:How old the contract may be`;
      case 'OWNERSHIP_NOT_CONFIRMED':
        return $localize`:@@product_rule.gate.ownership:How ownership must be stated`;
      case 'MULTI_UNIT_NOT_CONFIRMED':
        return $localize`:@@product_rule.gate.multi_unit:Multi-unit owners must confirm their strongest unit`;
      default:
        return $localize`:@@product_rule.gate.other:A condition on the answers`;
    }
  }

  private gateHintFor(gate: RuleGate): string {
    if (gate.kind === 'numberByKey') {
      return $localize`:@@product_rule.gate.by_key_hint:One row per answer. Leave the table empty and this condition does not apply to this bank.`;
    }
    if (gate.kind === 'number' && gate.right !== undefined) {
      return $localize`:@@product_rule.gate.derived_hint:The requirement is worked out from the table above, so there is no figure to type here.`;
    }
    return $localize`:@@product_rule.gate.blank_hint:Leave blank and this condition does not apply to this bank.`;
  }

  private factLabel(key: string): string {
    const fact = this.factByKey().get(key);
    return fact?.label ?? key;
  }

  private keyOptionsFor(
    step: RuleStep,
  ): readonly { key: string; labelEn: string; labelAr: string }[] | null {
    if (step.op === 'factChoiceTable' && step.fact) return this.factOptionsFor(step.fact);
    // A PARENT table's keys are the classes the values are filed under, which this screen has
    // no list of. Left free-text rather than guessed: a wrong list would refuse a key the
    // registry accepts.
    return null;
  }

  private factOptionsFor(
    factKey: string,
  ): readonly { key: string; labelEn: string; labelAr: string }[] | null {
    const question = this.factByKey().get(factKey)?.question;
    if (!question?.options?.length) return null;
    return question.options.map((o) => ({ key: o.code, labelEn: o.labelEn, labelAr: o.labelAr }));
  }

  private unitFor(step: RuleStep): string | null {
    switch (step.op) {
      case 'constant':
        return $localize`:@@product_rule.unit.egp:EGP`;
      case 'multiply':
        return $localize`:@@product_rule.unit.multiplier:× multiplier`;
      case 'percentOf':
      case 'upliftPercent':
        return $localize`:@@product_rule.unit.percent:%`;
      default:
        return null;
    }
  }
}
