/**
 * AUTHOR a product's calculation — the step list, the conditions, and which step is the answer.
 *
 * The half `product-rule-editor` deliberately does not do. That component's own scope note
 * says it: it renders the steps READ-ONLY and edits only their figures, because
 * `steps`/`gates`/`output` are plain `input()`s there with no output channel, and "a graph
 * editor is its own feature". This is that feature, and the two compose — this one decides
 * WHAT the calculation is, that one fills in what each bank PAYS.
 *
 * WHY IT MATTERS: until now a no-payslip product's shape could only be written by a seed or
 * a raw API call, so `/program-catalog/products` could show a calculation nobody could author and
 * a newly created product could never become a pipeline at all — `'steps'` is absent from
 * the method picker on purpose (a pipeline is not a twelfth method), so there was no control
 * anywhere that turned one on.
 *
 * STRUCTURE ONLY, and the split is not cosmetic. What is authored here belongs to the
 * catalog and is merged onto every bank program on every read; the figures belong to the
 * bank. Keeping them in separate components keeps that ownership visible instead of
 * presenting one form whose fields belong to two different parties.
 *
 * THE RULES IT ENFORCES CLIENT-SIDE are the ones whose refusal would otherwise arrive as a
 * `PRODUCT_RULE_INVALID` token naming a step id: a reference may name only an EARLIER step
 * (`forward_reference` / `unknown_step_reference`), `subtract` takes exactly two inputs and
 * the other n-ary ops at least one (`wrong_ref_count`), and a `pickByFact` needs one branch
 * per input (`branches_mismatch`). The server still checks all of them — this is a second
 * statement of the same rule for the operator's benefit, not the authority.
 */
import { ChangeDetectionStrategy, Component, input, model, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzIconModule, provideNzIconsPatch } from 'ng-zorro-antd/icon';
import {
  ArrowDownOutline,
  ArrowUpOutline,
  DeleteOutline,
  PlusOutline,
} from '@ant-design/icons-angular/icons';
import {
  GATE_REASON_CODES,
  STEP_OPS,
  type GateReasonCode,
  type ProductRuleOutput,
  type RegistryFact,
  type RuleGate,
  type RuleStep,
  type StepOp,
  type ValueRef,
} from '@features/bank-programs/bank-programs.types';

/** What an op needs the operator to say, beyond its id. */
interface OpSpec {
  /** Reads one named fact (`step.fact`). */
  readonly fact: boolean;
  /** How many inputs it takes: `[min, max]`, `max: null` = any number. */
  readonly refs: readonly [number, number | null];
  /** Positional branch codes, one per input. */
  readonly branches: boolean;
}

/**
 * Mirrors the arities `validateProductRule` enforces, so the form cannot build a rule the
 * save is going to refuse. `subtract` is the only fixed-arity arithmetic op — `a − b` is
 * ordered and two-sided, and the server states the same thing.
 */
const OP_SPEC: Readonly<Record<StepOp, OpSpec>> = {
  constant: { fact: false, refs: [0, 0], branches: false },
  factNumber: { fact: true, refs: [0, 0], branches: false },
  factChoiceTable: { fact: true, refs: [0, 0], branches: false },
  factParentTable: { fact: true, refs: [0, 0], branches: false },
  bandTable: { fact: false, refs: [1, 1], branches: false },
  percentOf: { fact: false, refs: [1, 2], branches: false },
  upliftPercent: { fact: false, refs: [1, 2], branches: false },
  multiply: { fact: false, refs: [1, 2], branches: false },
  sum: { fact: false, refs: [1, null], branches: false },
  subtract: { fact: false, refs: [2, 2], branches: false },
  minOf: { fact: false, refs: [1, null], branches: false },
  maxOf: { fact: false, refs: [1, null], branches: false },
  coalesce: { fact: false, refs: [1, null], branches: false },
  pickByFact: { fact: true, refs: [1, null], branches: true },
};

/** One editable input, flattened so the template does not narrow a union per row. */
interface RefRow {
  index: number;
  kind: 'step' | 'fact' | 'const';
  value: string;
  branch: string;
}

const GATE_NUMBER_OPS = ['gte', 'lte', 'gt', 'lt', 'between'] as const;
const GATE_CHOICE_OPS = ['eq', 'neq', 'in'] as const;

@Component({
  selector: 'app-product-rule-builder',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, NzIconModule],
  providers: [provideNzIconsPatch([PlusOutline, DeleteOutline, ArrowUpOutline, ArrowDownOutline])],
  template: `
    <div class="builder">
      <!-- ── the steps ─────────────────────────────────────────────────── -->
      <section class="block" [attr.aria-label]="stepsAria">
        <header class="block-head">
          <div>
            <h4 class="block-title" i18n="@@prb.steps.title">The steps</h4>
            <p class="block-note" i18n="@@prb.steps.note">
              Worked out in order. A step may read an answer, a fixed number, or the result of a
              step above it.
            </p>
          </div>
        </header>

        @if (steps().length === 0) {
          <p class="empty" i18n="@@prb.steps.empty">
            No steps yet. Add the first one — usually the figure the customer states, or a table
            keyed by one of their answers.
          </p>
        }

        <ol class="rows">
          @for (step of steps(); track step.id; let i = $index) {
            <li class="row" [attr.aria-label]="stepRowLabel(i)">
              <span class="ord" aria-hidden="true">{{ i + 1 }}</span>
              <div class="row-body" role="group" [attr.aria-label]="stepRowLabel(i)">
                <div class="line">
                  <label class="mini">
                    <span class="mini-label" i18n="@@prb.step.name">Name</span>
                    <input
                      class="input mono"
                      [ngModel]="step.id"
                      (ngModelChange)="renameStep(i, $event)"
                      [attr.aria-label]="stepIdAria"
                    />
                  </label>
                  <label class="mini grow">
                    <span class="mini-label" i18n="@@prb.step.op">What it does</span>
                    <select
                      class="input"
                      [ngModel]="step.op"
                      (ngModelChange)="changeOp(i, $event)"
                      [attr.aria-label]="stepOpAria"
                    >
                      @for (op of ops; track op) {
                        <option [value]="op">{{ opLabel(op) }}</option>
                      }
                    </select>
                  </label>
                  <div class="row-tools">
                    <button
                      type="button"
                      class="icon"
                      [disabled]="i === 0"
                      (click)="moveStep(i, -1)"
                      [attr.aria-label]="moveUpAria"
                    >
                      <span nz-icon nzType="arrow-up" nzTheme="outline"></span>
                    </button>
                    <button
                      type="button"
                      class="icon"
                      [disabled]="i === steps().length - 1"
                      (click)="moveStep(i, 1)"
                      [attr.aria-label]="moveDownAria"
                    >
                      <span nz-icon nzType="arrow-down" nzTheme="outline"></span>
                    </button>
                    <button
                      type="button"
                      class="icon danger"
                      (click)="removeStep(i)"
                      [attr.aria-label]="removeAria"
                    >
                      <span nz-icon nzType="delete" nzTheme="outline"></span>
                    </button>
                  </div>
                </div>

                @if (specOf(step.op).fact) {
                  <label class="mini">
                    <span class="mini-label" i18n="@@prb.step.fact">Reads the answer to</span>
                    <select
                      class="input"
                      [ngModel]="step.fact ?? ''"
                      (ngModelChange)="setFact(i, $event)"
                    >
                      <option value="" i18n="@@prb.step.fact.none">Pick an input…</option>
                      @for (fact of facts(); track fact.key) {
                        <option [value]="fact.key">{{ fact.label }}</option>
                      }
                    </select>
                  </label>
                }

                @if (maxRefs(step.op) !== 0) {
                  <div class="refs">
                    <span class="mini-label" i18n="@@prb.step.inputs">Inputs</span>
                    @for (ref of refRows(i); track ref.index) {
                      <div class="ref">
                        <select
                          class="input narrow"
                          [ngModel]="ref.kind"
                          (ngModelChange)="setRefKind(i, ref.index, $event)"
                          [attr.aria-label]="refKindAria"
                        >
                          <option value="step" i18n="@@prb.ref.step">An earlier step</option>
                          <option value="fact" i18n="@@prb.ref.fact">An answer</option>
                          <option value="const" i18n="@@prb.ref.const">A fixed number</option>
                        </select>

                        @switch (ref.kind) {
                          @case ('step') {
                            <select
                              class="input grow"
                              [ngModel]="ref.value"
                              (ngModelChange)="setRefValue(i, ref.index, $event)"
                              [attr.aria-label]="refValueAria"
                            >
                              <option value="" i18n="@@prb.ref.pick">Pick…</option>
                              @for (earlier of earlierSteps(i); track earlier) {
                                <option [value]="earlier">{{ earlier }}</option>
                              }
                            </select>
                          }
                          @case ('fact') {
                            <select
                              class="input grow"
                              [ngModel]="ref.value"
                              (ngModelChange)="setRefValue(i, ref.index, $event)"
                              [attr.aria-label]="refValueAria"
                            >
                              <option value="" i18n="@@prb.ref.pick">Pick…</option>
                              @for (fact of facts(); track fact.key) {
                                <option [value]="fact.key">{{ fact.label }}</option>
                              }
                            </select>
                          }
                          @default {
                            <input
                              class="input grow"
                              inputmode="decimal"
                              [ngModel]="ref.value"
                              (ngModelChange)="setRefValue(i, ref.index, $event)"
                              [attr.aria-label]="refValueAria"
                            />
                          }
                        }

                        @if (specOf(step.op).branches) {
                          <input
                            class="input narrow"
                            [ngModel]="ref.branch"
                            (ngModelChange)="setBranch(i, ref.index, $event)"
                            [placeholder]="branchPlaceholder"
                            [attr.aria-label]="branchAria"
                          />
                        }

                        <button
                          type="button"
                          class="icon danger"
                          [disabled]="refRows(i).length <= minRefs(step.op)"
                          (click)="removeRef(i, ref.index)"
                          [attr.aria-label]="removeAria"
                        >
                          <span nz-icon nzType="delete" nzTheme="outline"></span>
                        </button>
                      </div>
                    }
                    @if (canAddRef(i)) {
                      <button type="button" class="add small" (click)="addRef(i)">
                        <span nz-icon nzType="plus" nzTheme="outline" aria-hidden="true"></span>
                        <span i18n="@@prb.ref.add">Add an input</span>
                      </button>
                    }
                  </div>
                }

                @if (stepProblem(i); as problem) {
                  <p class="problem" role="alert">{{ problem }}</p>
                }
              </div>
            </li>
          }
        </ol>

        <button type="button" class="add" (click)="addStep()">
          <span nz-icon nzType="plus" nzTheme="outline" aria-hidden="true"></span>
          <span i18n="@@prb.step.add">Add a step</span>
        </button>
      </section>

      <!-- ── the answer ────────────────────────────────────────────────── -->
      <section class="block" [attr.aria-label]="outputAria">
        <header class="block-head">
          <div>
            <h4 class="block-title" i18n="@@prb.output.title">The answer</h4>
            <p class="block-note" i18n="@@prb.output.note">
              Which step is the result, and what that number means.
            </p>
          </div>
        </header>

        <div class="line">
          <label class="mini grow">
            <span class="mini-label" i18n="@@prb.output.from">The answer is</span>
            <select
              class="input"
              [ngModel]="output()?.from ?? ''"
              (ngModelChange)="setOutputFrom($event)"
            >
              <option value="" i18n="@@prb.ref.pick">Pick…</option>
              @for (step of steps(); track step.id) {
                <option [value]="step.id">{{ step.id }}</option>
              }
            </select>
          </label>
          <label class="mini grow">
            <span class="mini-label" i18n="@@prb.output.kind">and it is</span>
            <select
              class="input"
              [ngModel]="output()?.kind ?? 'monthlyIncome'"
              (ngModelChange)="setOutputKind($event)"
            >
              <option value="monthlyIncome" i18n="@@prb.output.kind.income">
                Assumed income
              </option>
              <option value="maxAmount" i18n="@@prb.output.kind.ceiling">
                The most the customer can borrow
              </option>
            </select>
          </label>
        </div>

        @if (output()?.kind === 'maxAmount') {
          <label class="mini">
            <span class="mini-label" i18n="@@prb.output.baseline">
              Share of income that ceiling assumes (%)
            </span>
            <input
              class="input narrow"
              inputmode="decimal"
              [ngModel]="output()?.baselineDbrPercent ?? ''"
              (ngModelChange)="setBaseline($event)"
            />
            <span class="mini-hint" i18n="@@prb.output.baseline.hint">
              The engine turns a borrowing ceiling back into the income it implies, and needs to
              know what share of income the ceiling was worked out against.
            </span>
          </label>
        }
      </section>

      <!-- ── the conditions ────────────────────────────────────────────── -->
      <section class="block" [attr.aria-label]="gatesAria">
        <header class="block-head">
          <div>
            <h4 class="block-title" i18n="@@prb.gates.title">Conditions</h4>
            <p class="block-note" i18n="@@prb.gates.note">
              A condition stops the calculation and gives a reason. Each bank decides whether to
              turn one on by filling in its figures — a condition with none is off.
            </p>
          </div>
        </header>

        <ol class="rows">
          @for (gate of gates(); track gate.id; let i = $index) {
            <li class="row" [attr.aria-label]="gateRowLabel(i)">
              <span class="ord" aria-hidden="true">{{ i + 1 }}</span>
              <div class="row-body" role="group" [attr.aria-label]="gateRowLabel(i)">
                <div class="line">
                  <label class="mini">
                    <span class="mini-label" i18n="@@prb.gate.name">Name</span>
                    <input
                      class="input mono"
                      [ngModel]="gate.id"
                      (ngModelChange)="renameGate(i, $event)"
                    />
                  </label>
                  <label class="mini">
                    <span class="mini-label" i18n="@@prb.gate.kind">Compares</span>
                    <select
                      class="input"
                      [ngModel]="gate.kind"
                      (ngModelChange)="changeGateKind(i, $event)"
                    >
                      <option value="number" i18n="@@prb.gate.kind.number">
                        A number against a limit
                      </option>
                      <option value="numberByKey" i18n="@@prb.gate.kind.byKey">
                        A number against a limit per answer
                      </option>
                      <option value="choice" i18n="@@prb.gate.kind.choice">
                        An answer against a list
                      </option>
                    </select>
                  </label>
                  <div class="row-tools">
                    <button
                      type="button"
                      class="icon danger"
                      (click)="removeGate(i)"
                      [attr.aria-label]="removeAria"
                    >
                      <span nz-icon nzType="delete" nzTheme="outline"></span>
                    </button>
                  </div>
                </div>

                <div class="line">
                  @if (gate.kind === 'choice') {
                    <label class="mini grow">
                      <span class="mini-label" i18n="@@prb.gate.fact">On the answer to</span>
                      <select
                        class="input"
                        [ngModel]="gateFact(gate)"
                        (ngModelChange)="setGateFact(i, $event)"
                      >
                        <option value="" i18n="@@prb.step.fact.none">Pick an input…</option>
                        @for (fact of facts(); track fact.key) {
                          <option [value]="fact.key">{{ fact.label }}</option>
                        }
                      </select>
                    </label>
                    <label class="mini">
                      <span class="mini-label" i18n="@@prb.gate.op">Must be</span>
                      <select
                        class="input"
                        [ngModel]="gate.op"
                        (ngModelChange)="setGateOp(i, $event)"
                      >
                        @for (op of choiceOps; track op) {
                          <option [value]="op">{{ choiceOpLabel(op) }}</option>
                        }
                      </select>
                    </label>
                    <label class="mini grow">
                      <span class="mini-label" i18n="@@prb.gate.expect">
                        One of these answers
                      </span>
                      <input
                        class="input"
                        [ngModel]="gateExpect(gate)"
                        (ngModelChange)="setGateExpect(i, $event)"
                        [placeholder]="expectPlaceholder"
                      />
                    </label>
                  } @else {
                    <label class="mini grow">
                      <span class="mini-label" i18n="@@prb.gate.left">Measures</span>
                      <select
                        class="input"
                        [ngModel]="gateLeftStep(gate)"
                        (ngModelChange)="setGateLeft(i, $event)"
                      >
                        <option value="" i18n="@@prb.ref.pick">Pick…</option>
                        @for (step of steps(); track step.id) {
                          <option [value]="step.id">{{ step.id }}</option>
                        }
                      </select>
                    </label>
                    <label class="mini">
                      <span class="mini-label" i18n="@@prb.gate.op">Must be</span>
                      <select
                        class="input"
                        [ngModel]="gate.op"
                        (ngModelChange)="setGateOp(i, $event)"
                      >
                        @for (op of numberOpsFor(gate.kind); track op) {
                          <option [value]="op">{{ numberOpLabel(op) }}</option>
                        }
                      </select>
                    </label>
                    @if (gate.kind === 'numberByKey') {
                      <label class="mini grow">
                        <span class="mini-label" i18n="@@prb.gate.keyedBy"> with a limit per </span>
                        <select
                          class="input"
                          [ngModel]="gateKeyedBy(gate)"
                          (ngModelChange)="setGateKeyedBy(i, $event)"
                        >
                          <option value="" i18n="@@prb.step.fact.none">Pick an input…</option>
                          @for (fact of facts(); track fact.key) {
                            <option [value]="fact.key">{{ fact.label }}</option>
                          }
                        </select>
                      </label>
                    }
                  }
                </div>

                <label class="mini">
                  <span class="mini-label" i18n="@@prb.gate.reason">
                    What the customer is told
                  </span>
                  <select
                    class="input"
                    [ngModel]="gate.reasonCode"
                    (ngModelChange)="setGateReason(i, $event)"
                  >
                    @for (code of reasonCodes; track code) {
                      <option [value]="code">{{ reasonLabel(code) }}</option>
                    }
                  </select>
                  <span class="mini-hint" i18n="@@prb.gate.reason.hint">
                    A fixed platform list — each reason is already translated for the customer. “The
                    conditions were not met” is the honest fallback; a new reason needs a developer.
                  </span>
                </label>
              </div>
            </li>
          }
        </ol>

        <button type="button" class="add" (click)="addGate()">
          <span nz-icon nzType="plus" nzTheme="outline" aria-hidden="true"></span>
          <span i18n="@@prb.gate.add">Add a condition</span>
        </button>
      </section>
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
      }
      .builder {
        display: flex;
        flex-direction: column;
        gap: var(--space-6);
      }
      .block {
        display: flex;
        flex-direction: column;
        gap: var(--space-3);
      }
      .block-head {
        display: flex;
        justify-content: space-between;
        gap: var(--space-3);
      }
      .block-title {
        margin: 0;
        font-size: 0.9375rem;
        font-weight: 600;
        color: var(--text-primary);
      }
      .block-note,
      .empty {
        margin: 0;
        color: var(--text-secondary);
        font-size: 0.8125rem;
        line-height: 1.6;
        max-inline-size: 52rem;
      }
      .rows {
        list-style: none;
        margin: 0;
        padding: 0;
        display: flex;
        flex-direction: column;
        gap: var(--space-3);
      }
      .row {
        display: grid;
        grid-template-columns: 2ch minmax(0, 1fr);
        gap: var(--space-3);
        align-items: start;
        padding-inline-start: var(--space-3);
        border-inline-start: 2px solid var(--border-subtle);
      }
      .ord {
        font-variant-numeric: tabular-nums;
        text-align: end;
        color: var(--text-tertiary);
        font-size: 0.8125rem;
        line-height: 2.25rem;
      }
      .row-body {
        display: flex;
        flex-direction: column;
        gap: var(--space-2);
        min-inline-size: 0;
      }
      .line {
        display: flex;
        flex-wrap: wrap;
        gap: var(--space-2);
        align-items: flex-end;
      }
      .mini {
        display: flex;
        flex-direction: column;
        gap: var(--space-1);
        min-inline-size: 0;
      }
      .mini.grow {
        flex: 1 1 12rem;
      }
      .mini-label {
        font-size: 0.75rem;
        font-weight: 600;
        color: var(--text-secondary);
      }
      .mini-hint {
        font-size: 0.75rem;
        line-height: 1.5;
        color: var(--text-tertiary);
        max-inline-size: 44rem;
      }
      .input {
        min-block-size: var(--size-field);
        padding-inline: var(--space-3);
        border: 1px solid var(--color-border-default);
        border-radius: var(--radius-field);
        background: var(--bg-surface);
        color: var(--text-primary);
        font: inherit;
        font-size: 0.8125rem;
        min-inline-size: 0;
      }
      .input.mono {
        font-family: var(--font-mono, ui-monospace, monospace);
        inline-size: 11rem;
      }
      .input.narrow {
        inline-size: 11rem;
        flex: 0 0 auto;
      }
      .input.grow {
        flex: 1 1 10rem;
      }
      .input:focus-visible {
        outline: 2px solid var(--accent);
        outline-offset: 1px;
      }
      .refs {
        display: flex;
        flex-direction: column;
        gap: var(--space-2);
      }
      .ref {
        display: flex;
        flex-wrap: wrap;
        gap: var(--space-2);
        align-items: center;
      }
      .row-tools {
        display: flex;
        gap: var(--space-1);
        margin-inline-start: auto;
      }
      .icon {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        inline-size: var(--size-field);
        block-size: var(--size-field);
        border: 1px solid var(--color-border-default);
        border-radius: var(--radius-field);
        background: var(--bg-surface);
        color: var(--text-secondary);
        cursor: pointer;
      }
      .icon:hover:not(:disabled) {
        border-color: var(--accent);
        color: var(--text-primary);
      }
      .icon.danger:hover:not(:disabled) {
        border-color: var(--error);
        color: var(--error);
      }
      .icon:disabled {
        opacity: 0.4;
        cursor: not-allowed;
      }
      .icon:focus-visible,
      .add:focus-visible {
        outline: 2px solid var(--accent);
        outline-offset: 2px;
      }
      .add {
        align-self: flex-start;
        display: inline-flex;
        align-items: center;
        gap: var(--space-2);
        min-block-size: var(--size-field);
        padding-inline: var(--space-3);
        border: 1px dashed var(--color-border-default);
        border-radius: var(--radius-field);
        background: transparent;
        color: var(--text-secondary);
        font: inherit;
        font-size: 0.8125rem;
        cursor: pointer;
      }
      .add:hover {
        border-color: var(--accent);
        color: var(--text-primary);
      }
      .add.small {
        font-size: 0.75rem;
      }
      .problem {
        margin: 0;
        color: var(--error);
        font-size: 0.75rem;
        line-height: 1.5;
      }
    `,
  ],
})
export class ProductRuleBuilderComponent {
  readonly steps = model<RuleStep[]>([]);
  readonly gates = model<RuleGate[]>([]);
  readonly output = model<ProductRuleOutput | null>(null);
  /** The inputs a step may read — the registry facts, already reduced for display. */
  readonly facts = input<readonly RegistryFact[]>([]);
  /** Raised on every structural edit, so the host can mark itself dirty. */
  readonly touched = output<void>();

  protected readonly ops = STEP_OPS;
  protected readonly reasonCodes = GATE_REASON_CODES;
  protected readonly choiceOps = GATE_CHOICE_OPS;

  protected readonly stepsAria = $localize`:@@prb.steps.aria:The steps of the calculation`;
  protected readonly gatesAria = $localize`:@@prb.gates.aria:Conditions`;
  protected readonly outputAria = $localize`:@@prb.output.aria:The answer`;
  protected readonly stepIdAria = $localize`:@@prb.step.name.aria:Step name`;
  protected readonly stepOpAria = $localize`:@@prb.step.op.aria:What this step does`;
  protected readonly refKindAria = $localize`:@@prb.ref.kind.aria:Where this input comes from`;
  protected readonly refValueAria = $localize`:@@prb.ref.value.aria:Which one`;
  protected readonly branchAria = $localize`:@@prb.ref.branch.aria:The answer this column is for`;
  protected readonly moveUpAria = $localize`:@@prb.move.up:Move up`;
  protected readonly moveDownAria = $localize`:@@prb.move.down:Move down`;
  protected readonly removeAria = $localize`:@@prb.remove:Remove`;
  protected readonly branchPlaceholder = $localize`:@@prb.ref.branch.placeholder:answer code`;
  protected readonly expectPlaceholder = $localize`:@@prb.gate.expect.placeholder:code, code`;

  // ---- reads ------------------------------------------------------------

  protected specOf(op: StepOp): OpSpec {
    return OP_SPEC[op];
  }

  protected minRefs(op: StepOp): number {
    return OP_SPEC[op].refs[0];
  }

  protected maxRefs(op: StepOp): number | null {
    return OP_SPEC[op].refs[1];
  }

  /**
   * A step may name only an EARLIER step, so the picker offers only those.
   *
   * The rule is the server's (`forward_reference` / `unknown_step_reference`) and is
   * enforced there too; offering the later ones would be offering a save that is refused,
   * with a message naming a step id rather than a control.
   */
  protected earlierSteps(index: number): string[] {
    return this.steps()
      .slice(0, index)
      .map((s) => s.id);
  }

  protected refRows(index: number): RefRow[] {
    const step = this.steps()[index];
    if (!step) return [];
    const refs = normaliseRefs(step.of);
    return refs.map((ref, i) => ({
      index: i,
      kind: refKind(ref),
      value: refValue(ref),
      branch: step.branches?.[i] ?? '',
    }));
  }

  protected canAddRef(index: number): boolean {
    const step = this.steps()[index];
    if (!step) return false;
    const max = this.maxRefs(step.op);
    return max === null || this.refRows(index).length < max;
  }

  /** The one problem worth naming per row, in the order the server would hit it. */
  protected stepProblem(index: number): string | null {
    const step = this.steps()[index];
    if (!step) return null;
    const spec = OP_SPEC[step.op];
    if (spec.fact && !step.fact) {
      return $localize`:@@prb.problem.fact:Pick which answer this step reads.`;
    }
    const refs = normaliseRefs(step.of);
    const [min, max] = spec.refs;
    if (refs.length < min) {
      return $localize`:@@prb.problem.tooFewInputs:This step needs at least ${min}:min: input(s).`;
    }
    if (max !== null && refs.length > max) {
      return $localize`:@@prb.problem.tooManyInputs:This step takes at most ${max}:max: input(s).`;
    }
    const earlier = new Set(this.earlierSteps(index));
    for (const ref of refs) {
      if ('step' in ref && !earlier.has(ref.step)) {
        return $localize`:@@prb.problem.badRef:An input names a step that does not come before this one.`;
      }
      if ('const' in ref && !/^-?\d+(\.\d+)?$/.test(ref.const)) {
        return $localize`:@@prb.problem.badConst:A fixed number is not a number.`;
      }
      if (('fact' in ref && !ref.fact) || ('step' in ref && !ref.step)) {
        return $localize`:@@prb.problem.emptyRef:An input has not been filled in.`;
      }
    }
    if (spec.branches && (step.branches?.length ?? 0) !== refs.length) {
      return $localize`:@@prb.problem.branches:Each input needs the answer code it belongs to.`;
    }
    return null;
  }

  protected stepRowLabel(index: number): string {
    const id = this.steps()[index]?.id ?? '';
    return $localize`:@@prb.step.row.aria:Step ${index + 1}:pos: — ${id}:id:`;
  }

  protected gateRowLabel(index: number): string {
    const id = this.gates()[index]?.id ?? '';
    return $localize`:@@prb.gate.row.aria:Condition ${index + 1}:pos: — ${id}:id:`;
  }

  protected gateFact(gate: RuleGate): string {
    return gate.kind === 'choice' ? gate.fact : '';
  }

  protected gateExpect(gate: RuleGate): string {
    return gate.kind === 'choice' ? gate.expect.join(', ') : '';
  }

  protected gateKeyedBy(gate: RuleGate): string {
    return gate.kind === 'numberByKey' ? gate.keyedBy : '';
  }

  protected gateLeftStep(gate: RuleGate): string {
    if (gate.kind === 'choice') return '';
    return 'step' in gate.left ? gate.left.step : '';
  }

  protected numberOpsFor(kind: RuleGate['kind']): readonly string[] {
    // `numberByKey` compares against a table the bank fills, so only the two one-sided
    // operators make sense — the server's own union says the same.
    return kind === 'numberByKey' ? (['gte', 'lte'] as const) : GATE_NUMBER_OPS;
  }

  // ---- labels -----------------------------------------------------------

  protected opLabel(op: StepOp): string {
    return OP_LABELS[op]();
  }

  protected reasonLabel(code: GateReasonCode): string {
    return REASON_LABELS[code]();
  }

  protected numberOpLabel(op: string): string {
    return NUMBER_OP_LABELS[op]?.() ?? op;
  }

  protected choiceOpLabel(op: string): string {
    return CHOICE_OP_LABELS[op]?.() ?? op;
  }

  // ---- writes -----------------------------------------------------------

  protected addStep(): void {
    const id = this.freeId(
      'step',
      this.steps().map((s) => s.id),
    );
    this.steps.update((list) => [...list, { id, op: 'constant' }]);
    this.touched.emit();
  }

  protected removeStep(index: number): void {
    const removed = this.steps()[index]?.id;
    this.steps.update((list) => list.filter((_, i) => i !== index));
    // A step nothing can name any more must not stay named: leaving the reference behind
    // saves as `unknown_step_reference` against a step id the operator can no longer see.
    if (removed) this.dropReferencesTo(removed);
    this.touched.emit();
  }

  protected moveStep(index: number, delta: number): void {
    const next = index + delta;
    this.steps.update((list) => {
      if (next < 0 || next >= list.length) return list;
      const copy = [...list];
      const [moved] = copy.splice(index, 1);
      if (moved) copy.splice(next, 0, moved);
      return copy;
    });
    this.touched.emit();
  }

  protected renameStep(index: number, rawId: string): void {
    const before = this.steps()[index]?.id;
    const id = rawId.trim();
    if (!before || !id || id === before) return;
    // Re-point every reference in the same edit. A rename that left them behind would break
    // the rule in a way whose only symptom is a step id nobody recognises in a 422.
    this.steps.update((list) =>
      list.map((step, i) => {
        const renamed = i === index ? { ...step, id } : step;
        return { ...renamed, of: rewriteRefs(renamed.of, before, id) };
      }),
    );
    this.gates.update((list) => list.map((gate) => rewriteGateRefs(gate, before, id)));
    this.output.update((out) => (out && out.from === before ? { ...out, from: id } : out));
    this.touched.emit();
  }

  protected changeOp(index: number, op: StepOp): void {
    this.steps.update((list) =>
      list.map((step, i) => {
        if (i !== index) return step;
        const spec = OP_SPEC[op];
        const refs = normaliseRefs(step.of).slice(0, spec.refs[1] ?? undefined);
        // Drop what the new op cannot carry rather than leaving it in the blob: a stray
        // `fact` on an arithmetic op is `unknown_param_key` territory and reads, on the
        // screen, as a field the operator filled in that nothing uses.
        const next: RuleStep = { id: step.id, op };
        if (spec.fact && step.fact) next.fact = step.fact;
        if ((spec.refs[1] ?? 1) !== 0 && refs.length > 0) next.of = refs;
        if (spec.branches && step.branches) next.branches = step.branches.slice(0, refs.length);
        return next;
      }),
    );
    this.touched.emit();
  }

  protected setFact(index: number, fact: string): void {
    this.patchStep(index, (step) => ({ ...step, fact: fact || undefined }));
  }

  protected addRef(index: number): void {
    this.patchStep(index, (step) => {
      const refs = [...normaliseRefs(step.of), { step: '' } as ValueRef];
      const branches = OP_SPEC[step.op].branches ? [...(step.branches ?? []), ''] : step.branches;
      return { ...step, of: refs, ...(branches ? { branches } : {}) };
    });
  }

  protected removeRef(index: number, refIndex: number): void {
    this.patchStep(index, (step) => {
      const refs = normaliseRefs(step.of).filter((_, i) => i !== refIndex);
      const branches = step.branches?.filter((_, i) => i !== refIndex);
      return { ...step, of: refs, ...(branches ? { branches } : {}) };
    });
  }

  protected setRefKind(index: number, refIndex: number, kind: RefRow['kind']): void {
    this.patchStep(index, (step) => ({
      ...step,
      of: normaliseRefs(step.of).map((ref, i) => (i === refIndex ? emptyRef(kind) : ref)),
    }));
  }

  protected setRefValue(index: number, refIndex: number, value: string): void {
    this.patchStep(index, (step) => ({
      ...step,
      of: normaliseRefs(step.of).map((ref, i) => (i === refIndex ? withRefValue(ref, value) : ref)),
    }));
  }

  protected setBranch(index: number, refIndex: number, code: string): void {
    this.patchStep(index, (step) => {
      const refs = normaliseRefs(step.of);
      const branches = refs.map((_, i) => (i === refIndex ? code : (step.branches?.[i] ?? '')));
      return { ...step, branches };
    });
  }

  protected setOutputFrom(from: string): void {
    this.output.update((out) => ({ kind: out?.kind ?? 'monthlyIncome', ...out, from }));
    this.touched.emit();
  }

  protected setOutputKind(kind: ProductRuleOutput['kind']): void {
    this.output.update((out) => {
      const next: ProductRuleOutput = { from: out?.from ?? '', ...out, kind };
      // A monthly income implies no baseline share; carrying one would leave a figure in
      // the blob that nothing reads and the operator cannot see.
      if (kind === 'monthlyIncome') delete next.baselineDbrPercent;
      return next;
    });
    this.touched.emit();
  }

  protected setBaseline(value: string): void {
    this.output.update((out) => (out ? { ...out, baselineDbrPercent: value || undefined } : out));
    this.touched.emit();
  }

  protected addGate(): void {
    const id = this.freeId(
      'gate',
      this.gates().map((g) => g.id),
    );
    this.gates.update((list) => [
      ...list,
      { id, kind: 'number', op: 'gte', left: { step: '' }, reasonCode: 'GATE_NOT_MET' },
    ]);
    this.touched.emit();
  }

  protected removeGate(index: number): void {
    this.gates.update((list) => list.filter((_, i) => i !== index));
    this.touched.emit();
  }

  protected renameGate(index: number, rawId: string): void {
    const id = rawId.trim();
    if (!id) return;
    this.patchGate(index, (gate) => ({ ...gate, id }) as RuleGate);
  }

  protected changeGateKind(index: number, kind: RuleGate['kind']): void {
    // Rebuilt rather than spread: the three kinds carry disjoint fields, and merging them
    // would leave a `keyedBy` on a choice gate — a key nothing reads and the save refuses.
    this.patchGate(index, (gate) => {
      const base = { id: gate.id, reasonCode: gate.reasonCode };
      if (kind === 'choice') return { ...base, kind, op: 'eq', fact: '', expect: [] };
      if (kind === 'numberByKey') {
        return { ...base, kind, op: 'gte', left: { step: '' }, keyedBy: '' };
      }
      return { ...base, kind, op: 'gte', left: { step: '' } };
    });
  }

  protected setGateOp(index: number, op: string): void {
    this.patchGate(index, (gate) => ({ ...gate, op }) as RuleGate);
  }

  protected setGateReason(index: number, reasonCode: GateReasonCode): void {
    this.patchGate(index, (gate) => ({ ...gate, reasonCode }));
  }

  protected setGateFact(index: number, fact: string): void {
    this.patchGate(index, (gate) => (gate.kind === 'choice' ? { ...gate, fact } : gate));
  }

  protected setGateExpect(index: number, raw: string): void {
    const expect = raw
      .split(',')
      .map((code) => code.trim())
      .filter(Boolean);
    this.patchGate(index, (gate) => (gate.kind === 'choice' ? { ...gate, expect } : gate));
  }

  protected setGateKeyedBy(index: number, keyedBy: string): void {
    this.patchGate(index, (gate) => (gate.kind === 'numberByKey' ? { ...gate, keyedBy } : gate));
  }

  protected setGateLeft(index: number, step: string): void {
    this.patchGate(index, (gate) => (gate.kind === 'choice' ? gate : { ...gate, left: { step } }));
  }

  // ---- helpers ----------------------------------------------------------

  private patchStep(index: number, fn: (step: RuleStep) => RuleStep): void {
    this.steps.update((list) => list.map((step, i) => (i === index ? fn(step) : step)));
    this.touched.emit();
  }

  private patchGate(index: number, fn: (gate: RuleGate) => RuleGate): void {
    this.gates.update((list) => list.map((gate, i) => (i === index ? fn(gate) : gate)));
    this.touched.emit();
  }

  private dropReferencesTo(id: string): void {
    this.steps.update((list) =>
      list.map((step) => ({
        ...step,
        of: normaliseRefs(step.of).filter((ref) => !('step' in ref && ref.step === id)),
      })),
    );
    this.gates.update((list) =>
      list.filter((gate) => gate.kind === 'choice' || !refNames(gate.left, id)),
    );
    this.output.update((out) => (out && out.from === id ? { ...out, from: '' } : out));
  }

  /** `step_1`, `step_2`… — free, so a rename is never forced at birth. */
  private freeId(prefix: string, taken: readonly string[]): string {
    const used = new Set(taken);
    for (let n = 1; ; n += 1) {
      const candidate = `${prefix}_${n}`;
      if (!used.has(candidate)) return candidate;
    }
  }
}

// ---------------------------------------------------------------------------
// Pure ref helpers. Outside the class so they are testable without a fixture.
// ---------------------------------------------------------------------------

/** `of` is a single ref OR an array on the wire; the editor always works in arrays. */
function normaliseRefs(of: RuleStep['of']): ValueRef[] {
  if (of === undefined) return [];
  return Array.isArray(of) ? [...of] : [of];
}

function refKind(ref: ValueRef): RefRow['kind'] {
  if ('step' in ref) return 'step';
  if ('fact' in ref) return 'fact';
  return 'const';
}

function refValue(ref: ValueRef): string {
  if ('step' in ref) return ref.step;
  if ('fact' in ref) return ref.fact;
  return ref.const;
}

function emptyRef(kind: RefRow['kind']): ValueRef {
  if (kind === 'step') return { step: '' };
  if (kind === 'fact') return { fact: '' };
  return { const: '' };
}

function withRefValue(ref: ValueRef, value: string): ValueRef {
  if ('step' in ref) return { step: value };
  if ('fact' in ref) return { fact: value };
  return { const: value };
}

function refNames(ref: ValueRef, id: string): boolean {
  return 'step' in ref && ref.step === id;
}

function rewriteRefs(of: RuleStep['of'], before: string, after: string): RuleStep['of'] {
  if (of === undefined) return undefined;
  const rewritten = normaliseRefs(of).map((ref) =>
    'step' in ref && ref.step === before ? { step: after } : ref,
  );
  return Array.isArray(of) ? rewritten : rewritten[0];
}

function rewriteGateRefs(gate: RuleGate, before: string, after: string): RuleGate {
  if (gate.kind === 'choice') return gate;
  const left = 'step' in gate.left && gate.left.step === before ? { step: after } : gate.left;
  const right =
    gate.kind === 'number' && gate.right && 'step' in gate.right && gate.right.step === before
      ? { step: after }
      : (gate as { right?: ValueRef }).right;
  return { ...gate, left, ...(right ? { right } : {}) } as RuleGate;
}

// ---------------------------------------------------------------------------
// Labels. Thunks rather than a plain map so `$localize` is evaluated per call in
// the right locale rather than once at module load.
// ---------------------------------------------------------------------------

const OP_LABELS: Readonly<Record<StepOp, () => string>> = {
  constant: () => $localize`:@@prb.op.constant:A fixed number`,
  factNumber: () => $localize`:@@prb.op.factNumber:A number the customer states`,
  factChoiceTable: () => $localize`:@@prb.op.factChoiceTable:A table keyed by an answer`,
  factParentTable: () => $localize`:@@prb.op.factParentTable:A table keyed by the answer's class`,
  bandTable: () => $localize`:@@prb.op.bandTable:A table of ranges`,
  percentOf: () => $localize`:@@prb.op.percentOf:A percentage of an earlier figure`,
  upliftPercent: () =>
    $localize`:@@prb.op.upliftPercent:An earlier figure increased by a percentage`,
  multiply: () => $localize`:@@prb.op.multiply:An earlier figure multiplied`,
  sum: () => $localize`:@@prb.op.sum:Several figures added up`,
  subtract: () => $localize`:@@prb.op.subtract:One figure minus another`,
  minOf: () => $localize`:@@prb.op.minOf:The smallest of several figures`,
  maxOf: () => $localize`:@@prb.op.maxOf:The largest of several figures`,
  coalesce: () => $localize`:@@prb.op.coalesce:Whichever way the bank filled in`,
  pickByFact: () => $localize`:@@prb.op.pickByFact:A different column per answer`,
};

const REASON_LABELS: Readonly<Record<GateReasonCode, () => string>> = {
  DOWN_PAYMENT_BELOW_MIN: () => $localize`:@@prb.reason.dp:The down payment is too small`,
  UNIT_PRICE_BELOW_MIN: () => $localize`:@@prb.reason.price:The unit price is too low`,
  CONTRACT_TOO_NEW: () => $localize`:@@prb.reason.new:The contract is too recent`,
  CONTRACT_TOO_OLD: () => $localize`:@@prb.reason.old:The contract is too old`,
  OWNERSHIP_NOT_CONFIRMED: () => $localize`:@@prb.reason.owner:Ownership is not confirmed`,
  MULTI_UNIT_NOT_CONFIRMED: () =>
    $localize`:@@prb.reason.multi:Owning more than one unit is not confirmed`,
  SELF_EMPLOYED_DOCS_MISSING: () =>
    $localize`:@@prb.reason.docs:Self-employment papers are missing`,
  BUSINESS_TOO_NEW: () => $localize`:@@prb.reason.business:The business is too new`,
  GATE_NOT_MET: () => $localize`:@@prb.reason.generic:The conditions were not met`,
};

const NUMBER_OP_LABELS: Readonly<Record<string, () => string>> = {
  gte: () => $localize`:@@prb.numop.gte:At least`,
  lte: () => $localize`:@@prb.numop.lte:At most`,
  gt: () => $localize`:@@prb.numop.gt:More than`,
  lt: () => $localize`:@@prb.numop.lt:Less than`,
  between: () => $localize`:@@prb.numop.between:Between`,
};

const CHOICE_OP_LABELS: Readonly<Record<string, () => string>> = {
  eq: () => $localize`:@@prb.chop.eq:Exactly`,
  neq: () => $localize`:@@prb.chop.neq:Anything except`,
  in: () => $localize`:@@prb.chop.in:One of`,
};
