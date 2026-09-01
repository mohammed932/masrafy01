/**
 * The friendly form — a no-payslip product's calculation, as three plain questions.
 *
 * WHAT THIS REPLACES. The same calculation could already be authored, in
 * `app-product-rule-builder`: add a step, choose an operation, wire input A to step 1 and
 * input B to step 2, then declare which step is the answer. It works and it is powerful, and
 * it asks a bank-operations person to think in `ValueRef{step|fact|const}` and op arity.
 * Nine banks across five products all fit one frame with three switches, so the form asks
 * about the frame and compiles the rest.
 *
 * THE COMPILER IS ON THE SERVER, deliberately. This screen sends the answers and renders the
 * rule that comes back. A second compiler here would be a second authority on what a shape
 * MEANS, free to disagree with the one that decides what is stored — and the disagreement
 * would surface as a bank quoting a figure the screen never showed.
 *
 * WHY IT IS A SCREEN AND NOT A SHEET. It branches on a type choice, it grows a `FormArray`,
 * and it is worth coming back to: the shell's own rule (`FormPageComponent`). A sheet would
 * also cover the product page this is edited against.
 *
 * THE THIRD QUESTION IS DEFERRED, AND SAYS SO. "What are the numbers" can only be asked
 * about a shape that exists, and the shape only exists once the server has compiled it. So
 * the figures editor renders against the LAST SAVED shape and hides itself while the answers
 * above are dirty, with a line saying why. The alternative — compiling here to preview — is
 * the second authority this file exists without.
 */
import {
  ChangeDetectionStrategy,
  Component,
  LOCALE_ID,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormArray, FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormPageComponent } from '@shared/ui';
import { ProductRuleEditorComponent } from '@shared/income-rule/product-rule-editor.component';
import { BankProgramsApiService } from '@features/bank-programs/bank-programs.api.service';
import { PlatformEnumerationsService } from '@core/platform-enumerations/platform-enumerations.service';
import { ErrorCodeService } from '@core/errors/error-code.service';
import type { ErrorCode } from '@core/auth/auth.types';
import {
  GATE_REASON_CODES,
  registryFacts,
  type GateReasonCode,
  type ProductTemplate,
  type RegistryFact,
  type RuleGate,
  type RuleStep,
  type ProductRuleOutput,
  type StepFigures,
  type TemplateCondition,
  type TemplateMechanism,
  type TemplateMechanismKind,
} from '@features/bank-programs/bank-programs.types';
import { CATALOG_BASE, PRODUCT_BASE } from './program-catalog.paths';

/** Which kind of answer a mechanism can read. `null` = it reads none. */
const MECHANISM_FACT_TYPE: Readonly<
  Record<TemplateMechanismKind, 'SINGLE_SELECT' | 'NUMERIC' | null>
> = {
  choiceTable: 'SINGLE_SELECT',
  classTable: 'SINGLE_SELECT',
  numberBand: 'NUMERIC',
  shareOf: 'NUMERIC',
  multipleOf: 'NUMERIC',
  flatAmount: null,
};

/**
 * How many FURTHER ways one product may offer.
 *
 * Mirrors the server's own cap (`MAX_WAYS`, six including the first). Stated here so the
 * Add button can withhold itself rather than teach the operator that Add is broken.
 */
const MAX_ALTERNATIVES = 5;

const MECHANISM_ORDER: readonly TemplateMechanismKind[] = [
  'choiceTable',
  'classTable',
  'numberBand',
  'shareOf',
  'multipleOf',
  'flatAmount',
];

/** The tests a condition can apply, in the order they are worth reading. */
const CONDITION_OPS = [
  'atLeast',
  'atMost',
  'between',
  'atLeastShareOf',
  'oneOf',
  'atLeastPerAnswer',
  'atMostPerAnswer',
] as const;

type ConditionOp = (typeof CONDITION_OPS)[number];

@Component({
  selector: 'app-product-template-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, RouterLink, FormPageComponent, ProductRuleEditorComponent],
  template: `
    <app-form-page
      [eyebrow]="eyebrow"
      [title]="title()"
      [subtitle]="subtitle()"
      [backLabel]="backLabel()"
      [hint]="hint()"
      [blockReason]="blockReason()"
      [submitLabel]="submitLabel"
      [submitting]="saving()"
      [submitDisabled]="!form.valid"
      (cancelled)="leave()"
      (submitted)="save()"
    >
      @if (advanced()) {
        <!-- No form to show, and saying so is the honest state. Offering an empty one would
             invite the operator to overwrite a live calculation with a blank shape. -->
        <p class="notice" role="status">
          <span i18n="@@spt.advanced"
            >This product's calculation was built step by step, so there is no form for it. You can
            still edit the steps on the product page, or start a new product from a shape.</span
          >
          <a class="linkish" [routerLink]="newProductLink" i18n="@@spt.advanced_new"
            >Start from a shape</a
          >
        </p>
      } @else {
        <form [formGroup]="form" class="stack">
          <!-- ① ------------------------------------------------------------ -->
          <section class="block" [attr.aria-labelledby]="'spt-q1'">
            <h2 class="q" id="spt-q1" i18n="@@spt.q1">How does this bank work out the income?</h2>

            <div class="picks" role="radiogroup" [attr.aria-labelledby]="'spt-q1'">
              @for (kind of mechanisms; track kind) {
                <button
                  type="button"
                  class="pick is-stacked"
                  role="radio"
                  [class.is-on]="form.controls.primaryKind.value === kind"
                  [attr.aria-checked]="form.controls.primaryKind.value === kind"
                  (click)="setPrimary(kind)"
                >
                  <span class="pick-dot" aria-hidden="true"></span>
                  <span class="pick-text">
                    <span class="pick-name">{{ mechanismLabel(kind) }}</span>
                    <span class="pick-eg">{{ mechanismExample(kind) }}</span>
                  </span>
                </button>
              }
            </div>

            @if (primaryNeedsFact()) {
              <label class="field">
                <span class="label" i18n="@@spt.q1.fact">Which answer does it read?</span>
                <select class="control" formControlName="primaryFact">
                  <option value="" i18n="@@spt.choose">Choose…</option>
                  @for (fact of primaryFacts(); track fact.key) {
                    <option [value]="fact.key">{{ fact.label }}</option>
                  }
                </select>
                @if (primaryFacts().length === 0) {
                  <!-- The class shape needs a DIFFERENT thing from the others: not just a
                       single-select answer, but one whose answers are each filed under a
                       class. Saying "add a question" would send the operator to build a
                       second question they do not need. -->
                  @if (form.controls.primaryKind.value === 'classTable') {
                    <span class="help is-warn" i18n="@@spt.class.none_body"
                      >No answer list is filed under classes yet. This shape prices by the class an
                      answer is filed under, so it needs a question whose answers each name
                      one.</span
                    >
                  } @else {
                    <span class="help is-warn" i18n="@@spt.q1.no_facts"
                      >This product does not ask anything of that kind yet. Add it on the product
                      page first.</span
                    >
                  }
                }
              </label>
            }

            <div class="field">
              <span class="label" i18n="@@spt.q1.output">What does that figure mean?</span>
              <div class="picks" role="radiogroup">
                <button
                  type="button"
                  class="pick"
                  role="radio"
                  [class.is-on]="form.controls.outputKind.value === 'monthlyIncome'"
                  [attr.aria-checked]="form.controls.outputKind.value === 'monthlyIncome'"
                  (click)="setOutputKind('monthlyIncome')"
                >
                  <span class="pick-dot" aria-hidden="true"></span>
                  <span i18n="@@spt.out.income">A monthly income</span>
                </button>
                <button
                  type="button"
                  class="pick"
                  role="radio"
                  [class.is-on]="form.controls.outputKind.value === 'maxAmount'"
                  [attr.aria-checked]="form.controls.outputKind.value === 'maxAmount'"
                  (click)="setOutputKind('maxAmount')"
                >
                  <span class="pick-dot" aria-hidden="true"></span>
                  <span i18n="@@spt.out.ceiling">The most the customer may borrow</span>
                </button>
              </div>
            </div>

            @if (form.controls.outputKind.value === 'maxAmount') {
              <label class="field is-inset">
                <span class="label" i18n="@@spt.q1.baseline"
                  >This ceiling was worked out at a DBR of</span
                >
                <span class="affix">
                  <input
                    class="control is-narrow"
                    type="text"
                    formControlName="baselineDbrPercent"
                  />
                  <span class="unit" aria-hidden="true">%</span>
                </span>
                <span class="help" i18n="@@spt.q1.baseline.help"
                  >The share of income the bank assumed when it decided that ceiling. Leave it blank
                  to use the program's own cap.</span
                >
              </label>
            }
          </section>

          <!-- ② ------------------------------------------------------------ -->
          <section class="block" [attr.aria-labelledby]="'spt-q2'">
            <h2 class="q" id="spt-q2" i18n="@@spt.q2">Does anything else apply?</h2>

            <!-- other ways -->
            <div class="addon">
              <label class="addon-head">
                <input class="addon-tick" type="checkbox" formControlName="useAlternative" />
                <span i18n="@@spt.addon.alt">Other ways to reach the figure</span>
              </label>
              <p class="addon-note" i18n="@@spt.addon.alt.note">
                One product, however many ways banks work its figure out. Each bank fills in only
                the ways it uses; a bank that fills in more than one is handled by the choice below.
              </p>
              @if (form.controls.useAlternative.value) {
                <div class="addon-body" formArrayName="alternatives">
                  @for (way of alternatives.controls; track $index) {
                    <div class="way" [formGroupName]="$index">
                      <div class="way-head">
                        <span class="way-name">{{ wayLabel($index) }} </span>
                        <button
                          type="button"
                          class="linkish is-danger"
                          (click)="removeWay($index)"
                          [attr.aria-label]="wayRemoveLabel($index)"
                        >
                          <span i18n="@@spt.addon.alt.remove">Remove</span>
                        </button>
                      </div>
                      <div class="picks">
                        @for (kind of mechanisms; track kind) {
                          <button
                            type="button"
                            class="pick is-stacked"
                            role="radio"
                            [class.is-on]="way.controls.kind.value === kind"
                            [attr.aria-checked]="way.controls.kind.value === kind"
                            (click)="setWayKind($index, kind)"
                          >
                            <span class="pick-dot" aria-hidden="true"></span>
                            <span class="pick-text">
                              <span class="pick-name">{{ mechanismLabel(kind) }}</span>
                              <span class="pick-eg">{{ mechanismExample(kind) }}</span>
                            </span>
                          </button>
                        }
                      </div>
                      @if (wayNeedsFact($index)) {
                        <label class="field">
                          <span class="label" i18n="@@spt.q1.fact">Which answer does it read?</span>
                          <select class="control" formControlName="fact">
                            <option value="" i18n="@@spt.choose">Choose…</option>
                            @for (fact of wayFacts($index); track fact.key) {
                              <option [value]="fact.key">{{ fact.label }}</option>
                            }
                          </select>
                        </label>
                      }
                    </div>
                  }

                  @if (canAddWay()) {
                    <button type="button" class="way-add" (click)="addWay()">
                      <span i18n="@@spt.addon.alt.add">Add another way</span>
                    </button>
                  } @else {
                    <p class="addon-note" i18n="@@spt.addon.alt.full">
                      That is as many ways as one product can offer.
                    </p>
                  }

                  <label class="field">
                    <span class="label" i18n="@@spt.addon.alt.both"
                      >If a bank fills in more than one way</span
                    >
                    <select class="control" formControlName="combine">
                      <option value="" i18n="@@spt.addon.alt.first">
                        Use whichever it filled in first
                      </option>
                      <option value="lower" i18n="@@spt.addon.alt.lower">Take the lowest</option>
                      <option value="higher" i18n="@@spt.addon.alt.higher">Take the highest</option>
                    </select>
                  </label>
                </div>
              }
            </div>

            <!-- second column -->
            <div class="addon">
              <label class="addon-head">
                <input class="addon-tick" type="checkbox" formControlName="useSecondColumn" />
                <span i18n="@@spt.addon.column">A second column</span>
              </label>
              <p class="addon-note" i18n="@@spt.addon.column.note">
                One table per kind of customer — new to the bank versus an existing customer, a
                city, an employment type. The first column stays where it is, so adding one does not
                disturb figures a bank has already entered.
              </p>
              @if (form.controls.useSecondColumn.value) {
                <div class="addon-body">
                  <label class="field">
                    <span class="label" i18n="@@spt.addon.column.fact"
                      >Which answer decides the column?</span
                    >
                    <select class="control" formControlName="columnFact">
                      <option value="" i18n="@@spt.choose">Choose…</option>
                      @for (fact of choiceFacts(); track fact.key) {
                        <option [value]="fact.key">{{ fact.label }}</option>
                      }
                    </select>
                  </label>
                  @if (columnOptions().length > 0) {
                    <fieldset class="field">
                      <legend class="label" i18n="@@spt.addon.column.branches">
                        Which answers get their own column?
                      </legend>
                      <div class="ticks">
                        @for (option of columnOptions(); track option.code) {
                          <label class="tick">
                            <input
                              type="checkbox"
                              [checked]="branchOn(option.code)"
                              (change)="toggleBranch(option.code)"
                            />
                            <span>{{ optionLabel(option) }}</span>
                          </label>
                        }
                      </div>
                      <span class="help" i18n="@@spt.addon.column.branches.help"
                        >Pick at least two. The first one you pick is the standard column — the one
                        a bank quotes when it sells no others.</span
                      >
                    </fieldset>
                  }
                </div>
              }
            </div>

            <!-- bonus -->
            <div class="addon">
              <label class="addon-head">
                <input class="addon-tick" type="checkbox" formControlName="useUplift" />
                <span i18n="@@spt.addon.uplift">A bonus percentage when something is true</span>
              </label>
              <p class="addon-note" i18n="@@spt.addon.uplift.note">
                Each bank states its own bonus. A customer who answers anything else, or nothing at
                all, gets no bonus.
              </p>
              @if (form.controls.useUplift.value) {
                <div class="addon-body">
                  <label class="field">
                    <span class="label" i18n="@@spt.addon.uplift.fact">Which answer?</span>
                    <select class="control" formControlName="upliftFact">
                      <option value="" i18n="@@spt.choose">Choose…</option>
                      @for (fact of choiceFacts(); track fact.key) {
                        <option [value]="fact.key">{{ fact.label }}</option>
                      }
                    </select>
                  </label>
                  @if (upliftOptions().length > 0) {
                    <div class="pair">
                      <label class="field">
                        <span class="label" i18n="@@spt.addon.uplift.when">Earns the bonus</span>
                        <select class="control" formControlName="upliftWhen">
                          <option value="" i18n="@@spt.choose">Choose…</option>
                          @for (option of upliftOptions(); track option.code) {
                            <option [value]="option.code">{{ optionLabel(option) }}</option>
                          }
                        </select>
                      </label>
                      <label class="field">
                        <span class="label" i18n="@@spt.addon.uplift.else">Does not</span>
                        <select class="control" formControlName="upliftOtherwise">
                          <option value="" i18n="@@spt.choose">Choose…</option>
                          @for (option of upliftOptions(); track option.code) {
                            <option [value]="option.code">{{ optionLabel(option) }}</option>
                          }
                        </select>
                      </label>
                    </div>
                  }
                </div>
              }
            </div>

            <!-- I-Score -->
            <div class="addon">
              <label class="addon-head">
                <input class="addon-tick" type="checkbox" formControlName="iScore" />
                <span i18n="@@spt.addon.iscore">Adjust by I-Score</span>
              </label>
              <p class="addon-note" i18n="@@spt.addon.iscore.note">
                Each bank types its own multiplier per score band. We ask the customer their score
                and it is optional — if they do not answer, the multiplier is 100% and nothing about
                their quote changes.
              </p>
            </div>

            <!-- conditions -->
            <div class="addon">
              <div class="addon-head is-static">
                <span i18n="@@spt.addon.conditions">Conditions the customer must meet</span>
                <button type="button" class="linkish" (click)="addCondition()">
                  <span i18n="@@spt.addon.conditions.add">Add a condition</span>
                </button>
              </div>
              <p class="addon-note" i18n="@@spt.addon.conditions.note">
                Each bank turns on the ones it applies and states its own limit. A customer who
                fails one is still shown the program, with the reason and no figures.
              </p>

              @if (conditions.length > 0) {
                <ul class="conditions" role="list" formArrayName="conditions">
                  @for (row of conditions.controls; track row.value.id; let i = $index) {
                    <li class="condition" [formGroupName]="i">
                      <div class="pair">
                        <label class="field">
                          <span class="label" i18n="@@spt.cond.measure">What is measured</span>
                          <select class="control" formControlName="measure">
                            <option value="__answer__" i18n="@@spt.cond.measure.answer">
                              The figure this calculation arrives at
                            </option>
                            @for (fact of allFacts(); track fact.key) {
                              <option [value]="fact.key">{{ fact.label }}</option>
                            }
                          </select>
                        </label>
                        <label class="field">
                          <span class="label" i18n="@@spt.cond.test">Must be</span>
                          <select class="control" formControlName="op">
                            @for (op of conditionOps; track op) {
                              <option [value]="op">{{ conditionOpLabel(op) }}</option>
                            }
                          </select>
                        </label>
                      </div>

                      @if (row.value.op === 'atLeastShareOf') {
                        <label class="field">
                          <span class="label" i18n="@@spt.cond.share_of">A share of</span>
                          <select class="control" formControlName="otherFact">
                            <option value="" i18n="@@spt.choose">Choose…</option>
                            @for (fact of numericFacts(); track fact.key) {
                              <option [value]="fact.key">{{ fact.label }}</option>
                            }
                          </select>
                        </label>
                      }
                      @if (
                        row.value.op === 'atLeastPerAnswer' || row.value.op === 'atMostPerAnswer'
                      ) {
                        <label class="field">
                          <span class="label" i18n="@@spt.cond.keyed_by">The limit depends on</span>
                          <select class="control" formControlName="otherFact">
                            <option value="" i18n="@@spt.choose">Choose…</option>
                            @for (fact of choiceFacts(); track fact.key) {
                              <option [value]="fact.key">{{ fact.label }}</option>
                            }
                          </select>
                        </label>
                      }

                      <label class="field">
                        <span class="label" i18n="@@spt.cond.reason"
                          >What the customer is told when they do not meet it</span
                        >
                        <select class="control" formControlName="reasonCode">
                          @for (code of reasonCodes; track code) {
                            <option [value]="code">{{ reasonLabel(code) }}</option>
                          }
                        </select>
                      </label>

                      <div class="condition-foot">
                        <span class="mono">{{ row.value.id }}</span>
                        <button
                          type="button"
                          class="linkish is-danger"
                          (click)="removeCondition(i)"
                        >
                          <span i18n="@@spt.cond.remove">Remove</span>
                        </button>
                      </div>
                    </li>
                  }
                </ul>
              }
            </div>
          </section>

          <!-- ③ ------------------------------------------------------------ -->
          <section class="block" [attr.aria-labelledby]="'spt-q3'">
            <h2 class="q" id="spt-q3" i18n="@@spt.q3">What are the numbers?</h2>
            <p class="lede" i18n="@@spt.q3.lede">
              These are the figures every bank starts from. A bank that types its own replaces them;
              a bank that does not, quotes from here.
            </p>

            @if (dirty()) {
              <p class="notice" role="status">
                <span i18n="@@spt.q3.stale"
                  >Save the answers above to see the tables that go with them.</span
                >
              </p>
            } @else if (compiledSteps().length === 0) {
              <p class="notice" role="status">
                <span i18n="@@spt.q3.none"
                  >Nothing to fill in yet — answer the first question and save.</span
                >
              </p>
            } @else {
              <app-product-rule-editor
                variant="catalog"
                [steps]="compiledSteps()"
                [gates]="compiledGates()"
                [output]="compiledOutput()"
                [figures]="figures()"
                (figuresChange)="onFigures($event)"
                (figuresTouched)="markFiguresDirty()"
                [facts]="facts()"
              />
            }
          </section>
        </form>
      }
    </app-form-page>
  `,
  styles: [
    `
      :host {
        display: block;
      }
      .stack {
        display: flex;
        flex-direction: column;
        gap: var(--space-7);
      }

      /* Sections are headings on the page ground, not boxes. A card here would be a card
         inside the form page's own body, and the tables below already carry one. */
      .block {
        display: flex;
        flex-direction: column;
        gap: var(--space-4);
      }
      .q {
        margin: 0;
        font-size: var(--text-xl);
        font-weight: var(--font-bold);
        line-height: var(--line-height-tight);
        color: var(--color-text-primary);
      }
      .lede {
        margin: 0;
        max-inline-size: 52rem;
        font-size: var(--text-sm);
        color: var(--color-text-secondary);
        line-height: var(--line-height-base);
      }

      .picks {
        display: flex;
        flex-wrap: wrap;
        gap: var(--space-2);
      }
      .pick {
        display: inline-flex;
        align-items: center;
        gap: var(--space-2);
        min-block-size: var(--size-field);
        padding-inline: var(--space-4);
        border: 1px solid var(--color-border-default);
        border-radius: var(--radius-field);
        background: var(--bg-surface);
        color: var(--color-text-secondary);
        font: inherit;
        font-size: var(--text-sm);
        cursor: pointer;
        transition:
          border-color var(--motion-duration-fast) var(--motion-easing-standard),
          color var(--motion-duration-fast) var(--motion-easing-standard);
      }
      .pick:hover {
        border-color: var(--color-border-strong);
        color: var(--color-text-primary);
      }
      .pick:focus-visible {
        outline: none;
        box-shadow: var(--focus-halo);
        border-color: var(--primary);
      }
      .pick.is-on {
        border-color: var(--primary);
        background: var(--primary-subtle);
        color: var(--color-text-primary);
        font-weight: var(--font-semibold);
      }
      /* Name over example. The dot keeps its optical line with the NAME, not with the
         centre of a two-line card, so a row of stacked cards still reads as one control. */
      .pick.is-stacked {
        align-items: flex-start;
        padding-block: var(--space-2);
        text-align: start;
      }
      .pick-text {
        display: flex;
        flex-direction: column;
        gap: var(--space-1);
      }
      .pick-eg {
        font-size: var(--text-xs);
        font-weight: var(--font-normal);
        color: var(--color-text-secondary);
      }
      /* A circle, not a rounded square: a square teaches "as many as apply" before the
         first click, and only one of these can be picked. */
      .pick-dot {
        inline-size: 14px;
        block-size: 14px;
        border-radius: var(--radius-pill);
        border: 1.5px solid var(--color-border-strong);
      }
      .pick.is-stacked .pick-dot {
        flex: none;
        margin-block-start: var(--space-1);
      }
      .pick.is-on .pick-dot {
        border-color: var(--primary);
        box-shadow: inset 0 0 0 3px var(--primary);
      }

      .field {
        display: flex;
        flex-direction: column;
        gap: var(--space-2);
        max-inline-size: 34rem;
      }
      .field.is-inset {
        padding-inline-start: var(--space-4);
        border-inline-start: var(--rule-width-accent) solid var(--color-border-default);
      }
      .label {
        font-size: var(--text-xs);
        font-weight: var(--font-semibold);
        color: var(--color-text-secondary);
      }
      .control {
        min-block-size: var(--size-field);
        padding-inline: var(--space-3);
        border: 1px solid var(--color-border-default);
        border-radius: var(--radius-field);
        background: var(--bg-subtle);
        color: var(--color-text-primary);
        font: inherit;
        font-size: var(--text-sm);
      }
      .control:focus-visible {
        outline: none;
        border-color: var(--primary);
        box-shadow: var(--focus-halo);
      }
      .control.is-narrow {
        inline-size: 7rem;
      }
      .affix {
        display: inline-flex;
        align-items: center;
        gap: var(--space-2);
      }
      .unit {
        font-size: var(--text-sm);
        color: var(--color-text-secondary);
      }
      .help {
        font-size: var(--text-xs);
        color: var(--color-text-secondary);
        line-height: var(--line-height-base);
      }
      .help.is-warn {
        color: var(--color-warning);
      }

      .addon {
        display: flex;
        flex-direction: column;
        gap: var(--space-2);
        padding-block: var(--space-4);
        border-block-start: 1px solid var(--color-border-default);
      }
      .addon-head {
        cursor: pointer;
        display: flex;
        align-items: center;
        gap: var(--space-3);
        font-size: var(--text-base);
        font-weight: var(--font-semibold);
        color: var(--color-text-primary);
        cursor: pointer;
      }
      .addon-tick {
        inline-size: 18px;
        block-size: 18px;
        flex: 0 0 auto;
        accent-color: var(--primary);
        cursor: pointer;
      }
      .addon-head.is-static {
        cursor: default;
        justify-content: space-between;
      }
      .addon-note {
        margin: 0;
        max-inline-size: 52rem;
        font-size: var(--text-sm);
        color: var(--color-text-secondary);
        line-height: var(--line-height-base);
      }
      .addon-body {
        display: flex;
        flex-direction: column;
        gap: var(--space-4);
        margin-block-start: var(--space-3);
        padding-inline-start: var(--space-4);
        border-inline-start: var(--rule-width-accent) solid var(--primary-subtle);
        animation: spt-reveal var(--motion-duration-base) var(--motion-easing-standard);
      }
      @keyframes spt-reveal {
        from {
          opacity: 0;
          transform: translateY(-4px);
        }
      }

      /* One way among several. Set off by a rule rather than a card: the addon body already
         sits inside a card, and a card inside a card reads as a second level of nesting the
         content does not have. */
      .way {
        display: flex;
        flex-direction: column;
        gap: var(--space-3);
        padding-block-end: var(--space-4);
        border-block-end: 1px solid var(--color-border-default);
      }
      .way:last-of-type {
        padding-block-end: 0;
        border-block-end: 0;
      }
      .way-head {
        display: flex;
        align-items: baseline;
        justify-content: space-between;
        gap: var(--space-3);
      }
      .way-name {
        font-size: var(--text-sm);
        font-weight: var(--font-semibold);
        color: var(--color-text-secondary);
      }
      .way-add {
        align-self: flex-start;
        padding: var(--space-2) var(--space-4);
        border: 1px dashed var(--color-border-strong);
        border-radius: var(--radius-field);
        background: none;
        font: inherit;
        font-size: var(--text-sm);
        font-weight: var(--font-medium);
        color: var(--color-text-primary);
        cursor: pointer;
        transition: border-color var(--motion-duration-fast) var(--motion-easing-standard);
      }
      .way-add:hover {
        border-color: var(--primary);
        border-style: solid;
      }
      .way-add:focus-visible {
        outline: var(--focus-ring-width) solid var(--focus-ring-color);
        outline-offset: var(--focus-ring-offset);
      }

      .ticks {
        display: flex;
        flex-wrap: wrap;
        gap: var(--space-3);
      }
      .tick {
        display: inline-flex;
        align-items: center;
        gap: var(--space-2);
        font-size: var(--text-sm);
        color: var(--color-text-primary);
        cursor: pointer;
      }

      .pair {
        display: grid;
        gap: var(--space-4);
        grid-template-columns: repeat(auto-fit, minmax(min(100%, 16rem), 1fr));
        max-inline-size: 52rem;
      }

      .conditions {
        list-style: none;
        margin: var(--space-3) 0 0;
        padding: 0;
        display: flex;
        flex-direction: column;
        gap: var(--space-4);
      }
      .condition {
        display: flex;
        flex-direction: column;
        gap: var(--space-3);
        padding: var(--space-4);
        border: 1px solid var(--color-border-default);
        border-radius: var(--radius-lg);
        background: var(--bg-surface);
      }
      .condition-foot {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: var(--space-3);
      }
      .mono {
        font-family: var(--font-mono);
        font-size: var(--text-xs);
        color: var(--color-text-tertiary);
      }

      .notice {
        margin: 0;
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: var(--space-2);
        max-inline-size: 52rem;
        padding: var(--space-3) var(--space-4);
        border: 1px solid var(--color-border-default);
        border-radius: var(--radius-lg);
        background: var(--bg-subtle);
        font-size: var(--text-sm);
        color: var(--color-text-secondary);
        line-height: var(--line-height-base);
      }

      .linkish {
        border: 0;
        background: none;
        padding: 0;
        font: inherit;
        font-size: var(--text-sm);
        color: var(--color-text-link);
        cursor: pointer;
        text-decoration: underline;
        text-underline-offset: 2px;
      }
      .linkish.is-danger {
        color: var(--color-error);
      }
      .linkish:focus-visible {
        outline: var(--focus-ring-width) solid var(--focus-ring-color);
        outline-offset: var(--focus-ring-offset);
      }

      @media (prefers-reduced-motion: reduce) {
        .pick,
        .way-add {
          transition: none;
        }
        .addon-body {
          animation: none;
        }
      }
    `,
  ],
})
export class ProductTemplatePage implements OnInit {
  protected readonly newProductLink = `${PRODUCT_BASE}/new`;

  private readonly api = inject(BankProgramsApiService);
  private readonly enums = inject(PlatformEnumerationsService);
  private readonly errors = inject(ErrorCodeService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);
  private readonly isAr = inject(LOCALE_ID).startsWith('ar');

  protected readonly mechanisms = MECHANISM_ORDER;
  protected readonly conditionOps = CONDITION_OPS;
  protected readonly reasonCodes = GATE_REASON_CODES;

  protected readonly eyebrow = $localize`:@@spt.form.eyebrow:Surrogate product`;
  protected readonly submitLabel = $localize`:@@spt.form.save:Save the calculation`;

  private key = '';

  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly advanced = signal(false);
  /**
   * The ANSWERS above are dirty — the tables below were compiled from an older shape.
   *
   * Deliberately NOT set by a figure edit. Section ③ is guarded on this signal, so a
   * figure write that set it unmounted the editor the operator was typing into: one
   * keystroke replaced the whole table with "save the answers above", and there was no
   * way to give the product any figures at all from this screen.
   */
  protected readonly dirty = signal(false);
  /** A figure has been typed. Enables Save; never hides the editor it was typed into. */
  protected readonly figuresDirty = signal(false);
  /** Anything unsaved, of either kind — what the action bar's hint speaks about. */
  protected readonly unsaved = computed(() => this.dirty() || this.figuresDirty());
  protected readonly saveError = signal<string | null>(null);
  protected readonly label = signal<string | null>(null);
  protected readonly figures = signal<Record<string, StepFigures>>({});

  private readonly compiled = signal<{
    steps: RuleStep[];
    gates: RuleGate[];
    output: ProductRuleOutput | null;
  }>({ steps: [], gates: [], output: null });

  protected readonly compiledSteps = computed(() => this.compiled().steps);
  protected readonly compiledGates = computed(() => this.compiled().gates);
  protected readonly compiledOutput = computed(() => this.compiled().output);

  protected readonly facts = computed(() =>
    registryFacts(this.enums.membersFor('surrogate_fact')(), this.isAr),
  );
  /** Only a bound fact can be read. An unbound one has no answer to look anything up by. */
  protected readonly allFacts = computed(() => this.facts().filter((f) => f.question !== null));
  protected readonly choiceFacts = computed(() =>
    this.allFacts().filter((f) => f.question?.type === 'SINGLE_SELECT'),
  );
  protected readonly numericFacts = computed(() =>
    this.allFacts().filter((f) => f.question?.type === 'NUMERIC'),
  );

  readonly form = this.fb.nonNullable.group({
    outputKind: this.fb.nonNullable.control<'monthlyIncome' | 'maxAmount'>('monthlyIncome'),
    baselineDbrPercent: this.fb.nonNullable.control(''),
    primaryKind: this.fb.nonNullable.control<TemplateMechanismKind>('choiceTable'),
    primaryFact: this.fb.nonNullable.control(''),
    useAlternative: this.fb.nonNullable.control(false),
    alternatives: this.fb.array<ReturnType<ProductTemplatePage['wayGroup']>>([]),
    combine: this.fb.nonNullable.control<'' | 'lower' | 'higher'>(''),
    useSecondColumn: this.fb.nonNullable.control(false),
    columnFact: this.fb.nonNullable.control(''),
    columnBranches: this.fb.nonNullable.control<string[]>([]),
    useUplift: this.fb.nonNullable.control(false),
    upliftFact: this.fb.nonNullable.control(''),
    upliftWhen: this.fb.nonNullable.control(''),
    upliftOtherwise: this.fb.nonNullable.control(''),
    iScore: this.fb.nonNullable.control(false),
    conditions: this.fb.array<ReturnType<ProductTemplatePage['conditionGroup']>>([]),
  });

  get conditions(): FormArray<ReturnType<ProductTemplatePage['conditionGroup']>> {
    return this.form.controls.conditions;
  }

  get alternatives(): FormArray<ReturnType<ProductTemplatePage['wayGroup']>> {
    return this.form.controls.alternatives;
  }

  /**
   * One further way of reaching the figure.
   *
   * `flatAmount`, not `classTable`, is what a new row opens ON: `classTable` filters its
   * picker to facts whose answers are filed under classes, so on a product with no such list
   * it opened to an empty select with nothing saying why. `flatAmount` reads no fact at all,
   * so it is the one kind that can never open empty.
   */
  private wayGroup(kind: TemplateMechanismKind = 'flatAmount', fact = '') {
    return this.fb.nonNullable.group({
      kind: this.fb.nonNullable.control<TemplateMechanismKind>(kind),
      fact: this.fb.nonNullable.control(fact),
    });
  }

  ngOnInit(): void {
    this.key = this.route.snapshot.paramMap.get('key') ?? '';
    void this.enums.load('surrogate_fact');
    this.form.valueChanges.subscribe(() => this.dirty.set(true));
    // Ticking the addon with nothing under it would say a second way exists and save none,
    // so the tick opens on one empty row — the state it describes.
    this.form.controls.useAlternative.valueChanges.subscribe((on) => {
      if (on && this.alternatives.length === 0) this.alternatives.push(this.wayGroup());
    });
    void this.load();
  }

  // --- what the shell renders ------------------------------------------------

  protected title(): string {
    return this.label() ?? $localize`:@@spt.form.title_fallback:How the income is worked out`;
  }

  protected subtitle(): string {
    return $localize`:@@spt.form.subtitle:Answer these and we build the calculation. Every bank selling this product fills in its own figures against the same shape.`;
  }

  protected hint(): string | null {
    if (this.saving()) return null;
    if (!this.unsaved())
      return $localize`:@@spt.form.clean:Nothing to save — this is what is stored.`;
    return $localize`:@@spt.form.next:Saving rebuilds the calculation every bank under this product quotes from.`;
  }

  /**
   * Why Save is refused, in the operator's words.
   *
   * Both halves are here rather than only the local one: the server's refusals on this screen
   * are about OTHER banks' figures, which the operator cannot see, so the message has to be
   * where the button is.
   */
  protected blockReason(): string | null {
    if (this.saveError()) return this.saveError();
    if (this.advanced())
      return $localize`:@@spt.form.block_advanced:This calculation was built by hand, so there is no form to save.`;
    if (this.primaryNeedsFact() && !this.form.controls.primaryFact.value) {
      return $localize`:@@spt.form.block_fact:Choose which answer the calculation reads.`;
    }
    if (this.form.controls.useAlternative.value) {
      const unnamed = this.alternatives.controls.findIndex(
        (row, index) => this.wayNeedsFact(index) && !row.controls.fact.value,
      );
      if (unnamed !== -1) {
        return $localize`:@@spt.form.block_alt_fact:Choose which answer way ${unnamed + 2}:index: reads.`;
      }
      const ways = this.alternatives.controls.map((row) => row.getRawValue());
      const primary = this.form.getRawValue();
      const identity = (kind: TemplateMechanismKind, fact: string): string =>
        `${kind}|${MECHANISM_FACT_TYPE[kind] === null ? '' : fact}`;
      const seen = new Set([identity(primary.primaryKind, primary.primaryFact)]);
      for (const way of ways) {
        const id = identity(way.kind, way.fact);
        if (seen.has(id)) {
          return $localize`:@@spt.form.block_alt_duplicate:Two ways read the same answer the same way. Remove one, or change what it reads.`;
        }
        seen.add(id);
      }
    }
    if (
      this.form.controls.useSecondColumn.value &&
      this.form.controls.columnBranches.value.length < 2
    ) {
      return $localize`:@@spt.form.block_columns:A second column needs at least two answers picked.`;
    }
    const uplift = this.form.getRawValue();
    if (uplift.useUplift && (!uplift.upliftWhen || !uplift.upliftOtherwise)) {
      return $localize`:@@spt.form.block_uplift:Say which answer earns the bonus and which does not.`;
    }
    if (uplift.useUplift && uplift.upliftWhen === uplift.upliftOtherwise) {
      return $localize`:@@spt.form.block_uplift_same:The two bonus answers have to be different.`;
    }
    return null;
  }

  // --- ① ---------------------------------------------------------------------

  protected mechanismLabel(kind: TemplateMechanismKind): string {
    return MECHANISM_LABELS[kind]();
  }

  protected mechanismExample(kind: TemplateMechanismKind): string {
    return MECHANISM_EXAMPLES[kind]();
  }

  protected primaryNeedsFact(): boolean {
    return MECHANISM_FACT_TYPE[this.form.controls.primaryKind.value] !== null;
  }

  protected wayNeedsFact(index: number): boolean {
    const kind = this.alternatives.at(index)?.controls.kind.value;
    return kind !== undefined && MECHANISM_FACT_TYPE[kind] !== null;
  }

  protected primaryFacts(): RegistryFact[] {
    return this.factsFor(this.form.controls.primaryKind.value);
  }

  protected wayFacts(index: number): RegistryFact[] {
    const kind = this.alternatives.at(index)?.controls.kind.value;
    return kind === undefined ? [] : this.factsFor(kind);
  }

  protected setPrimary(kind: TemplateMechanismKind): void {
    if (this.form.controls.primaryKind.value === kind) return;
    this.form.controls.primaryKind.setValue(kind);
    // The fact a table is keyed by and the fact a percentage reads are different KINDS of
    // answer, so carrying the old pick across would leave a select showing a value that is
    // no longer in its own list.
    if (MECHANISM_FACT_TYPE[kind] !== MECHANISM_FACT_TYPE[this.form.controls.primaryKind.value]) {
      this.form.controls.primaryFact.setValue('');
    }
    this.form.controls.primaryFact.setValue('');
  }

  protected setWayKind(index: number, kind: TemplateMechanismKind): void {
    const row = this.alternatives.at(index);
    if (!row || row.controls.kind.value === kind) return;
    row.controls.kind.setValue(kind);
    // The fact a table is keyed by and the fact a percentage reads are different KINDS of
    // answer, so carrying the old pick across would leave a select showing a value that is
    // no longer in its own list.
    row.controls.fact.setValue('');
  }

  /**
   * The ways may be ADDED to and REMOVED from, never reordered.
   *
   * The first two keep the slot ids they have always had (`primary`, `alt`) and every way
   * after that is named by the fact it reads, so a bank's figures stay under the id they
   * were typed against. Moving what is in the first row would rename `alt`, which is a
   * number quietly becoming some other bank's — so there is no control that can.
   */
  protected addWay(): void {
    if (!this.canAddWay()) return;
    this.alternatives.push(this.wayGroup());
    this.dirty.set(true);
  }

  protected removeWay(index: number): void {
    this.alternatives.removeAt(index);
    // The last way gone is the addon off: a ticked box over an empty list says a second way
    // exists, and the save would state none.
    if (this.alternatives.length === 0) this.form.controls.useAlternative.setValue(false);
    this.dirty.set(true);
  }

  protected canAddWay(): boolean {
    return this.alternatives.length < MAX_ALTERNATIVES;
  }

  /**
   * Ways are numbered from the FIRST one, which is the section above this addon — so the
   * first row here is way 2. Numbering these from one would put two "way 1"s on the screen.
   */
  protected wayLabel(index: number): string {
    const n = index + 2;
    return $localize`:@@spt.addon.alt.way:Way ${n}:index:`;
  }

  protected wayRemoveLabel(index: number): string {
    const n = index + 2;
    return $localize`:@@spt.addon.alt.remove_aria:Remove way ${n}:index:`;
  }

  protected setOutputKind(kind: 'monthlyIncome' | 'maxAmount'): void {
    this.form.controls.outputKind.setValue(kind);
    // The baseline only means something for a ceiling. Left behind on an income product it
    // is refused at save, naming a field that is no longer on screen.
    if (kind !== 'maxAmount') this.form.controls.baselineDbrPercent.setValue('');
  }

  // --- ② ---------------------------------------------------------------------

  protected columnOptions(): ReadonlyArray<{ code: string; labelAr: string; labelEn: string }> {
    return this.optionsOf(this.form.controls.columnFact.value);
  }

  protected upliftOptions(): ReadonlyArray<{ code: string; labelAr: string; labelEn: string }> {
    return this.optionsOf(this.form.controls.upliftFact.value);
  }

  protected optionLabel(option: { labelAr: string; labelEn: string }): string {
    return this.isAr ? option.labelAr : option.labelEn;
  }

  protected branchOn(code: string): boolean {
    return this.form.controls.columnBranches.value.includes(code);
  }

  /**
   * Order matters and is preserved: the FIRST branch is the standard column, the one a bank
   * quotes when it sells no others, and it is the one that keeps the bare step id.
   */
  protected toggleBranch(code: string): void {
    const current = this.form.controls.columnBranches.value;
    this.form.controls.columnBranches.setValue(
      current.includes(code) ? current.filter((c) => c !== code) : [...current, code],
    );
  }

  // --- conditions ------------------------------------------------------------

  private conditionGroup(seed: {
    id: string;
    measure: string;
    op: ConditionOp;
    otherFact: string;
    reasonCode: GateReasonCode;
  }) {
    return this.fb.nonNullable.group({
      // Never edited. It is a `stepParams` key, so renaming it orphans whatever bound a bank
      // has entered against it — which the server would then refuse.
      id: this.fb.nonNullable.control(seed.id),
      measure: this.fb.nonNullable.control(seed.measure, Validators.required),
      op: this.fb.nonNullable.control<ConditionOp>(seed.op),
      otherFact: this.fb.nonNullable.control(seed.otherFact),
      reasonCode: this.fb.nonNullable.control<GateReasonCode>(seed.reasonCode),
    });
  }

  protected addCondition(): void {
    const taken = new Set(this.conditions.controls.map((c) => c.getRawValue().id));
    let n = this.conditions.length + 1;
    // Never re-used, even after a delete: an id is a figures key, and recycling one would
    // hand a new condition the bound a bank had entered against the old one.
    while (taken.has(`c${n}`)) n += 1;
    this.conditions.push(
      this.conditionGroup({
        id: `c${n}`,
        measure: '__answer__',
        op: 'atLeast',
        otherFact: '',
        reasonCode: 'GATE_NOT_MET',
      }),
    );
    this.dirty.set(true);
  }

  protected removeCondition(index: number): void {
    this.conditions.removeAt(index);
    this.dirty.set(true);
  }

  protected conditionOpLabel(op: ConditionOp): string {
    return CONDITION_OP_LABELS[op]();
  }

  /**
   * The gate reason, in the words the CUSTOMER will read.
   *
   * The same dictionary the mobile app renders it from, deliberately: the operator is
   * choosing the sentence somebody is going to be shown, so they should be choosing it by
   * that sentence and not by a code.
   *
   * `GATE_`-PREFIXED, because that is the key the sentence is filed under — the engine
   * raises `GATE_CONTRACT_TOO_NEW`, not `CONTRACT_TOO_NEW`, and both dictionaries agree
   * with it. Looked up bare, every one of the nine reasons missed and fell back to
   * `INTERNAL_ERROR`, so the picker offered nine options all reading "Something went wrong
   * on our side" and the operator could not tell which sentence they were choosing.
   *
   * `GATE_NOT_MET` is the exception and is filed bare: it is the only reason whose own
   * name already carries the prefix, in the engine and in the Flutter mapper as well as
   * here. Prefixing it unconditionally would leave exactly one option still wrong, which
   * is worse than the bug it replaced — a single broken row reads as a real sentence
   * nobody checked.
   */
  protected reasonLabel(code: GateReasonCode): string {
    const key = code.startsWith('GATE_') ? code : `GATE_${code}`;
    return this.errors.toLocalizedMessage(key as ErrorCode);
  }

  // --- ③ ---------------------------------------------------------------------

  protected onFigures(figures: Record<string, StepFigures>): void {
    this.figures.set(figures);
  }

  protected markFiguresDirty(): void {
    this.figuresDirty.set(true);
  }

  // --- save / load -----------------------------------------------------------

  /**
   * Where "back" goes.
   *
   * Normally the product's own page. But when a catalog name sent the operator here — it was
   * created one write earlier and links to this product — leaving belongs to the NAME: the
   * errand was "add a program name", and the calculation is the last thing it owed. `?then=`
   * carries the name's key.
   *
   * A query param and not router state, for the same reason `?from=` is one: this screen is
   * reloaded and pasted, and router state survives neither. It is a RETURN ADDRESS, applied
   * to nothing — unlike the new-question screen's payload, which the receiving page writes.
   */
  /** Names where back actually goes, so the arrow is not a guess. */
  protected backLabel(): string {
    return this.returnToName() !== null
      ? $localize`:@@spt.back_name:Back to the program name`
      : $localize`:@@spt.back_product:Back to the product`;
  }

  /** The catalog name that sent the operator here, if one did. */
  private returnToName(): string | null {
    const then = this.route.snapshot.queryParamMap.get('then');
    return then !== null && then !== '' ? then : null;
  }

  protected leave(): void {
    const then = this.returnToName();
    if (then !== null) {
      void this.router.navigate([CATALOG_BASE, then], { queryParams: { step: 2 } });
      return;
    }
    void this.router.navigate([PRODUCT_BASE, this.key], { queryParams: { step: 2 } });
  }

  /** Fire-and-forget for the template: Angular's parser has no `void` operator. */
  protected save(): void {
    void this.doSave();
  }

  private async doSave(): Promise<void> {
    if (this.saving() || this.blockReason() !== null) return;
    this.saving.set(true);
    this.saveError.set(null);
    try {
      const res = await this.api.setSurrogateProductTemplate(this.key, {
        template: this.toTemplate(),
        // The figures travel WITH the shape: recompiling replaces the step list, so a
        // separate figures write would be writing against a shape that no longer exists.
        stepParams: this.figures(),
      });
      this.absorb(res.data.template, res.data.incomeRule);
      this.dirty.set(false);
      this.figuresDirty.set(false);
    } catch (err) {
      const envelope = (err as { error?: { code?: string; meta?: Record<string, unknown> } })
        ?.error;
      this.saveError.set(
        this.errors.toLocalizedMessage(
          (envelope?.code ?? 'INTERNAL_ERROR') as ErrorCode,
          envelope?.meta,
        ),
      );
    } finally {
      this.saving.set(false);
    }
  }

  /** The form, as the shape the server compiles. */
  private toTemplate(): ProductTemplate {
    const v = this.form.getRawValue();
    const mechanism = (kind: TemplateMechanismKind, fact: string): TemplateMechanism =>
      kind === 'flatAmount' ? { kind } : ({ kind, fact } as TemplateMechanism);

    const conditions: TemplateCondition[] = this.conditions.controls.map((control) => {
      const c = control.getRawValue();
      const measure =
        c.measure === '__answer__'
          ? ({ of: 'answer' } as const)
          : ({ of: 'fact', fact: c.measure } as const);
      const test =
        c.op === 'atLeastShareOf'
          ? ({ op: 'atLeastShareOf', fact: c.otherFact } as const)
          : c.op === 'atLeastPerAnswer' || c.op === 'atMostPerAnswer'
            ? ({ op: c.op, keyedBy: c.otherFact } as const)
            : c.op === 'oneOf'
              ? ({ op: 'oneOf', expect: this.optionsOf(c.measure).map((o) => o.code) } as const)
              : ({ op: c.op } as const);
      return { id: c.id, measure, test, reasonCode: c.reasonCode };
    });

    return {
      version: 1,
      outputKind: v.outputKind,
      ...(v.outputKind === 'maxAmount' && v.baselineDbrPercent
        ? { baselineDbrPercent: v.baselineDbrPercent }
        : {}),
      primary: mechanism(v.primaryKind, v.primaryFact),
      ...(v.useAlternative && v.alternatives.length > 0
        ? { alternatives: v.alternatives.map((way) => mechanism(way.kind, way.fact)) }
        : {}),
      ...(v.useAlternative && v.alternatives.length > 0 && v.combine ? { combine: v.combine } : {}),
      ...(v.useSecondColumn && v.columnBranches.length >= 2
        ? { secondColumn: { fact: v.columnFact, branches: [...v.columnBranches] } }
        : {}),
      ...(v.useUplift && v.upliftWhen && v.upliftOtherwise
        ? {
            uplift: {
              fact: v.upliftFact,
              whenOption: v.upliftWhen,
              otherwiseOption: v.upliftOtherwise,
            },
          }
        : {}),
      ...(v.iScore ? { iScore: true } : {}),
      conditions,
    };
  }

  private async load(): Promise<void> {
    this.loading.set(true);
    try {
      const res = await this.api.getSurrogateProductTemplate(this.key);
      this.label.set(this.isAr ? res.data.labelAr : res.data.labelEn);
      this.advanced.set(res.data.advanced);
      this.absorb(res.data.template, res.data.compiled);

      // A brand-new product arrives with no form. `?from=` is the shape the operator picked
      // on the previous screen — carried on the URL rather than in a service so a reload, and
      // a link pasted to a colleague, both land on the same one.
      if (res.data.template === null && !res.data.advanced) {
        this.seedFromStarter(this.route.snapshot.queryParamMap.get('from'));
      }
      this.dirty.set(false);
      this.figuresDirty.set(false);
    } finally {
      this.loading.set(false);
    }
  }

  private seedFromStarter(starterKey: string | null): void {
    const seed = STARTER_SEED[starterKey ?? ''];
    if (!seed) return;
    this.form.patchValue({ primaryKind: seed.mechanism, outputKind: seed.outputKind });
  }

  private absorb(
    template: ProductTemplate | null,
    rule: {
      steps?: RuleStep[];
      gates?: RuleGate[];
      output?: ProductRuleOutput;
      stepParams?: Record<string, StepFigures>;
    } | null,
  ): void {
    this.compiled.set({
      steps: (rule?.steps ?? []).map((s) => ({ ...s })),
      gates: (rule?.gates ?? []).map((g) => ({ ...g })),
      output: rule?.output ? { ...rule.output } : null,
    });
    this.figures.set({ ...(rule?.stepParams ?? {}) });

    if (template === null) return;

    // Both spellings of the ways list, read the one way the server reads them. `alternative`
    // is what rows saved before the list existed carry, and it means a list of one.
    const ways =
      template.alternatives ?? (template.alternative === undefined ? [] : [template.alternative]);
    this.alternatives.clear();
    for (const way of ways) {
      this.alternatives.push(this.wayGroup(way.kind, way.kind === 'flatAmount' ? '' : way.fact));
    }

    this.conditions.clear();
    for (const condition of template.conditions ?? []) {
      this.conditions.push(
        this.conditionGroup({
          id: condition.id,
          measure: condition.measure.of === 'fact' ? condition.measure.fact : '__answer__',
          op: condition.test.op,
          otherFact:
            condition.test.op === 'atLeastShareOf'
              ? condition.test.fact
              : condition.test.op === 'atLeastPerAnswer' || condition.test.op === 'atMostPerAnswer'
                ? condition.test.keyedBy
                : '',
          reasonCode: condition.reasonCode,
        }),
      );
    }

    this.form.patchValue({
      outputKind: template.outputKind,
      baselineDbrPercent: template.baselineDbrPercent ?? '',
      primaryKind: template.primary.kind,
      primaryFact: template.primary.kind === 'flatAmount' ? '' : template.primary.fact,
      useAlternative: ways.length > 0,
      combine: template.combine ?? '',
      useSecondColumn: template.secondColumn !== undefined,
      columnFact: template.secondColumn?.fact ?? '',
      columnBranches: [...(template.secondColumn?.branches ?? [])],
      useUplift: template.uplift !== undefined,
      upliftFact: template.uplift?.fact ?? '',
      upliftWhen: template.uplift?.whenOption ?? '',
      upliftOtherwise: template.uplift?.otherwiseOption ?? '',
      iScore: template.iScore === true,
    });
  }

  // --- shared -----------------------------------------------------------------

  /**
   * The facts a mechanism can actually read.
   *
   * Keyed by the MECHANISM, not by the question type, and that is the load-bearing part:
   * `choiceTable` and `classTable` are both SINGLE_SELECT, so a type alone cannot tell them
   * apart. Before this, picking "a table by the class it is filed under" offered every
   * single-select fact including ones whose answers are filed under nothing — the template
   * compiled cleanly to `factParentTable` and then answered `no_matching_row` for every
   * applicant, which is FATAL rather than skippable.
   *
   * The predicate is `parentOptions.length > 0` and NOT `parentEnumerationType !== undefined`,
   * because it has to match the downstream consumer: `product-rule-editor.keyOptionsFor()`
   * keys a `factParentTable` off `parentOptions` regardless of whether the parent TYPE
   * resolved. A stricter predicate here would hide a fact whose table works; a looser one
   * would let through a fact whose table renders "the keys cannot be listed".
   *
   * `parentOptions` is now the axis the list DECLARES rather than the classes some answer
   * happens to sit in, so a freshly authored list with nothing filed yet still qualifies.
   */
  private factsFor(kind: TemplateMechanismKind): RegistryFact[] {
    const type = MECHANISM_FACT_TYPE[kind];
    if (type === null) return [];
    return this.allFacts().filter(
      (f) =>
        f.question?.type === type &&
        (kind !== 'classTable' || (f.question?.parentOptions?.length ?? 0) > 0),
    );
  }

  private optionsOf(
    factKey: string,
  ): ReadonlyArray<{ code: string; labelAr: string; labelEn: string }> {
    return this.allFacts().find((f) => f.key === factKey)?.question?.options ?? [];
  }
}

/** Thunks — `$localize` resolves per call, so a frozen map would pin the first locale. */
const MECHANISM_LABELS: Readonly<Record<TemplateMechanismKind, () => string>> = {
  choiceTable: () => $localize`:@@spt.mech.choice:One figure for each answer`,
  classTable: () => $localize`:@@spt.mech.class:One figure for each class`,
  numberBand: () => $localize`:@@spt.mech.band:One figure for each range of a number`,
  shareOf: () => $localize`:@@spt.mech.share:A percentage of a number the customer states`,
  multipleOf: () => $localize`:@@spt.mech.multiple:A multiple of a number the customer states`,
  flatAmount: () => $localize`:@@spt.mech.flat:The same figure for everyone`,
};

/**
 * One worked example per shape, in the same voice as the starter cards on
 * `/program-catalog/products/new` — a name says what the bank fills in, an example says what one
 * filled-in row looks like, and the pair is what tells a share from a multiple.
 */
const MECHANISM_EXAMPLES: Readonly<Record<TemplateMechanismKind, () => string>> = {
  choiceTable: () => $localize`:@@spt.mech.choice.eg:e.g. Colonel → 45,000 a month`,
  classTable: () =>
    $localize`:@@spt.mech.class.eg:e.g. Class AA → up to 6,000,000, whichever compound it is`,
  numberBand: () => $localize`:@@spt.mech.band.eg:e.g. 8–12 years → 30,000 a month`,
  shareOf: () => $localize`:@@spt.mech.share.eg:e.g. 30% of what they spend on their card`,
  multipleOf: () => $localize`:@@spt.mech.multiple.eg:e.g. 3× their car instalment`,
  flatAmount: () => $localize`:@@spt.mech.flat.eg:e.g. 15,000, nothing asked`,
};

const CONDITION_OP_LABELS: Readonly<Record<ConditionOp, () => string>> = {
  atLeast: () => $localize`:@@spt.op.atLeast:At least what the bank states`,
  atMost: () => $localize`:@@spt.op.atMost:At most what the bank states`,
  between: () => $localize`:@@spt.op.between:Between the bank's two figures`,
  atLeastShareOf: () => $localize`:@@spt.op.share:At least a percentage of another figure`,
  oneOf: () => $localize`:@@spt.op.oneOf:One of the answers the bank accepts`,
  atLeastPerAnswer: () =>
    $localize`:@@spt.op.perAnswerMin:At least a figure that depends on another answer`,
  atMostPerAnswer: () =>
    $localize`:@@spt.op.perAnswerMax:At most a figure that depends on another answer`,
};

/**
 * The shape the picker screen sent, as the two fields it seeds.
 *
 * Duplicated from the server's own starter list on purpose and kept to the two fields a
 * blank form needs — the server remains the authority on what a shape COMPILES to, which is
 * the half that could be wrong in a way nobody sees.
 */
const STARTER_SEED: Readonly<
  Record<string, { mechanism: TemplateMechanismKind; outputKind: 'monthlyIncome' | 'maxAmount' }>
> = {
  income_by_rank: { mechanism: 'choiceTable', outputKind: 'monthlyIncome' },
  income_by_years: { mechanism: 'numberBand', outputKind: 'monthlyIncome' },
  income_share_of_figure: { mechanism: 'shareOf', outputKind: 'monthlyIncome' },
  income_multiple_of_figure: { mechanism: 'multipleOf', outputKind: 'monthlyIncome' },
  ceiling_by_class: { mechanism: 'classTable', outputKind: 'maxAmount' },
  ceiling_by_bracket: { mechanism: 'numberBand', outputKind: 'maxAmount' },
  ceiling_share_of_paid: { mechanism: 'shareOf', outputKind: 'maxAmount' },
};
