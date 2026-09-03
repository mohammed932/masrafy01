/**
 * The friendly form — a no-payslip product's calculation, as three plain questions.
 *
 * WHAT THIS REPLACED, and what has since been DELETED. The same calculation used to be
 * authored in a raw step builder: add a step, choose an operation, wire input A to step 1 and
 * input B to step 2, then declare which step is the answer. It worked and it was powerful,
 * and it asked a bank-operations person to think in `ValueRef{step|fact|const}` and op arity.
 * Nine banks across five products all fit one frame with three switches, so the form asks
 * about the frame and compiles the rest — and the builder is gone, along with the one-way
 * escape hatch it was reached through. A calculation is shaped from the predefined library or
 * from this form; a product that predates both keeps quoting and says plainly that there is
 * no form for it.
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
import { FormPageComponent, WizardStepsComponent, type WizardStepItem } from '@shared/ui';
import { ProductRuleEditorComponent } from '@shared/income-rule/product-rule-editor.component';
import { BankProgramsApiService } from '@features/bank-programs/bank-programs.api.service';
import { PlatformEnumerationsService } from '@core/platform-enumerations/platform-enumerations.service';
import { ErrorCodeService } from '@core/errors/error-code.service';
import type { ErrorCode } from '@core/auth/auth.types';
import {
  GATE_REASON_CODES,
  registryFacts,
  type GateReasonCode,
  type IncomeBand,
  type ProductBlueprint,
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
import { blueprintCopy } from './blueprint-copy';
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
  imports: [
    ReactiveFormsModule,
    RouterLink,
    FormPageComponent,
    WizardStepsComponent,
    ProductRuleEditorComponent,
  ],
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
        <!-- The rail is NAVIGATION, not a flow: every step is reachable at any time and there
             is one Save for all three, because this is a settings screen and the three
             questions are not a sequence anybody completes once. What it buys is that a
             refusal raised by a field two steps away shows up as "Needs attention" ON that
             step, instead of as a sentence beside a button with nothing on screen to fix. -->
        <app-wizard-steps
          variant="plain"
          [steps]="railSteps()"
          [activeIndex]="step()"
          [ariaLabel]="railAria"
          [caption]="railCaption"
          (stepSelect)="goStep($event)"
        />

        <form [formGroup]="form" class="stack">
          @switch (step()) {
            <!-- ① ---------------------------------------------------------- -->
            @case (0) {
              <section class="block">
                <h2 class="q" i18n="@@spt.q1">How does the bank work the figure out?</h2>

                <!-- Asked FIRST because it decides which shapes make sense — the picker
                     screen groups its cards by exactly this, so asking it after the shape
                     would reverse the order the operator already answered it in. -->
                <div class="field">
                  <span class="label" id="spt-out" i18n="@@spt.q1.output">What the figure is</span>
                  <div class="picks" role="radiogroup" aria-labelledby="spt-out">
                    <button
                      type="button"
                      class="pick"
                      role="radio"
                      [class.is-on]="form.controls.outputKind.value === 'monthlyIncome'"
                      [attr.aria-checked]="form.controls.outputKind.value === 'monthlyIncome'"
                      (click)="setOutputKind('monthlyIncome')"
                    >
                      <span class="pick-dot" aria-hidden="true"></span>
                      <span i18n="@@spt.out.income">Assumed income</span>
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

                <div class="field is-wide">
                  <span class="label" id="spt-how" i18n="@@spt.q1.how"
                    >How the bank gets to it</span
                  >
                  <div class="cards" role="radiogroup" aria-labelledby="spt-how">
                    @for (kind of mechanisms; track kind) {
                      <button
                        type="button"
                        class="card"
                        role="radio"
                        [class.is-on]="form.controls.primaryKind.value === kind"
                        [attr.aria-checked]="form.controls.primaryKind.value === kind"
                        (click)="setPrimary(kind)"
                      >
                        <span class="pick-dot" aria-hidden="true"></span>
                        <span class="card-text">
                          <span class="card-name">{{ mechanismLabel(kind) }}</span>
                          <span class="card-eg">{{ mechanismExample(kind) }}</span>
                        </span>
                      </button>
                    }
                  </div>
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
                          >No answer list is filed under classes yet. This shape prices by the class
                          an answer is filed under, so it needs a question whose answers each name
                          one.</span
                        >
                      } @else {
                        <span class="help is-warn" i18n="@@spt.q1.no_facts"
                          >This product does not ask anything of that kind yet. Add it on the
                          product page first.</span
                        >
                      }
                    }
                  </label>
                }

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
                      >The share of income the bank assumed when it decided that ceiling. Leave it
                      blank to use the program's own cap.</span
                    >
                  </label>
                }
              </section>
            }

            <!-- ② ---------------------------------------------------------- -->
            @case (1) {
              <section class="block">
                <h2 class="q" i18n="@@spt.q2">Does anything else apply?</h2>
                <p class="lede" i18n="@@spt.q2.lede">
                  All of these are optional. Leave them alone and the calculation is the one answer
                  above.
                </p>

                <!-- other ways -->
                <div class="addon">
                  <label class="addon-head">
                    <input class="addon-tick" type="checkbox" formControlName="useAlternative" />
                    <span class="addon-text">
                      <span class="addon-name" i18n="@@spt.addon.alt"
                        >Other ways to reach the figure</span
                      >
                      <span class="addon-note" i18n="@@spt.addon.alt.note"
                        >Each bank fills in only the ways it uses.</span
                      >
                    </span>
                  </label>
                  @if (form.controls.useAlternative.value) {
                    <div class="addon-body">
                      <!-- The ways are the only thing inside the formArrayName container. The
                           combine select used to sit in here too, which resolved it against the
                           ARRAY: Angular threw "Cannot find control with path:
                           'alternatives -> combine'" and the select was never bound, so "take
                           the lowest" could not be chosen at all. -->
                      <div class="ways" formArrayName="alternatives">
                        @for (way of alternatives.controls; track $index) {
                          <!-- A ROW, not a second copy of the card grid. The cards on step 1 are
                               where a shape is learned; repeating all six per way put the same
                               control on screen twice and cost ~450px each. -->
                          <div class="way" [formGroupName]="$index">
                            <span class="way-n">{{ wayLabel($index) }}</span>
                            <label class="way-f">
                              <span class="label" i18n="@@spt.addon.alt.how">How</span>
                              <select class="control" formControlName="kind">
                                @for (kind of mechanisms; track kind) {
                                  <option [value]="kind">{{ mechanismLabel(kind) }}</option>
                                }
                              </select>
                            </label>
                            @if (wayNeedsFact($index)) {
                              <label class="way-f">
                                <span class="label" i18n="@@spt.q1.fact"
                                  >Which answer does it read?</span
                                >
                                <select class="control" formControlName="fact">
                                  <option value="" i18n="@@spt.choose">Choose…</option>
                                  @for (fact of wayFacts($index); track fact.key) {
                                    <option [value]="fact.key">{{ fact.label }}</option>
                                  }
                                </select>
                              </label>
                            }
                            <button
                              type="button"
                              class="linkish is-danger way-x"
                              (click)="removeWay($index)"
                              [attr.aria-label]="wayRemoveLabel($index)"
                            >
                              <span i18n="@@spt.addon.alt.remove">Remove</span>
                            </button>
                          </div>
                        }
                      </div>

                      @if (canAddWay()) {
                        <button type="button" class="way-add" (click)="addWay()">
                          <span i18n="@@spt.addon.alt.add">Add another way</span>
                        </button>
                      } @else {
                        <span class="help" i18n="@@spt.addon.alt.full"
                          >That is as many ways as one product can offer.</span
                        >
                      }

                      <label class="field">
                        <span class="label" i18n="@@spt.addon.alt.both"
                          >If a bank fills in more than one way</span
                        >
                        <select class="control" formControlName="combine">
                          <option value="" i18n="@@spt.addon.alt.first">
                            Use whichever it filled in first
                          </option>
                          <option value="lower" i18n="@@spt.addon.alt.lower">
                            Take the lowest
                          </option>
                          <option value="higher" i18n="@@spt.addon.alt.higher">
                            Take the highest
                          </option>
                        </select>
                      </label>
                    </div>
                  }
                </div>

                <!-- second column -->
                <div class="addon">
                  <label class="addon-head">
                    <input class="addon-tick" type="checkbox" formControlName="useSecondColumn" />
                    <span class="addon-text">
                      <span class="addon-name" i18n="@@spt.addon.column">A second column</span>
                      <span class="addon-note" i18n="@@spt.addon.column.note"
                        >One table per kind of customer — new to the bank, a city, an employment
                        type.</span
                      >
                    </span>
                  </label>
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
                            >Pick at least two. The first one you pick is the standard column — the
                            one a bank quotes when it sells no others.</span
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
                    <span class="addon-text">
                      <span class="addon-name" i18n="@@spt.addon.uplift"
                        >A bonus percentage when something is true</span
                      >
                      <span class="addon-note" i18n="@@spt.addon.uplift.note"
                        >Each bank states its own bonus. Any other answer earns none.</span
                      >
                    </span>
                  </label>
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
                      <fieldset class="scope">
                        <legend class="label" i18n="@@spt.addon.uplift.scope">
                          What does the bonus lift?
                        </legend>
                        <label class="radio">
                          <input type="radio" formControlName="upliftScope" value="income" />
                          <span i18n="@@spt.addon.uplift.scope.income"
                            >The figure this calculation works out</span
                          >
                        </label>
                        <label class="radio">
                          <input type="radio" formControlName="upliftScope" value="maxLoan" />
                          <span i18n="@@spt.addon.uplift.scope.max"
                            >The most the bank will lend</span
                          >
                        </label>
                        <p class="scope-note" i18n="@@spt.addon.uplift.scope.note">
                          Read the sheet again if you are unsure: it is worth 300,000 on one
                          applicant. A bonus on the loan amount is configured per bank, on the
                          program's own ceiling — nothing is added to this calculation.
                        </p>
                      </fieldset>
                      @if (upliftOptions().length > 0) {
                        <div class="pair">
                          <label class="field">
                            <span class="label" i18n="@@spt.addon.uplift.when"
                              >Earns the bonus</span
                            >
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
                    <span class="addon-text">
                      <span class="addon-name" i18n="@@spt.addon.iscore">Adjust by I-Score</span>
                      <span class="addon-note" i18n="@@spt.addon.iscore.note"
                        >Each bank types its own multiplier per score band. Optional for the
                        customer.</span
                      >
                    </span>
                  </label>
                </div>

                <!-- conditions -->
                <div class="addon">
                  <div class="addon-head is-static">
                    <span class="addon-text">
                      <span class="addon-name" i18n="@@spt.addon.conditions"
                        >Conditions the customer must meet</span
                      >
                      <span class="addon-note" i18n="@@spt.addon.conditions.note"
                        >Each bank turns on the ones it applies. A customer who fails one still sees
                        the program, with the reason.</span
                      >
                    </span>
                    <button type="button" class="linkish" (click)="addCondition()">
                      <span i18n="@@spt.addon.conditions.add">Add a condition</span>
                    </button>
                  </div>

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
                            row.value.op === 'atLeastPerAnswer' ||
                            row.value.op === 'atMostPerAnswer'
                          ) {
                            <label class="field">
                              <span class="label" i18n="@@spt.cond.keyed_by"
                                >The limit depends on</span
                              >
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
            }

            <!-- ③ ---------------------------------------------------------- -->
            @default {
              <section class="block">
                <h2 class="q" i18n="@@spt.q3">What are the numbers?</h2>
                <!-- The generic lede is withheld when this product has its OWN sentence to
                     say. Four prose blocks stacked before the first control, one of them
                     repeating the group heading below it ("Amounts every bank starts from"),
                     is a page an operator scrolls past rather than reads. -->
                @if (sheetNote() === null) {
                  <p class="lede" i18n="@@spt.q3.lede">
                    These are the figures every bank starts from. A bank that types its own replaces
                    them; a bank that does not, quotes from here.
                  </p>
                }

                <!-- What the operator is filling in, said once at the top rather than beside
                     every box: this product's mechanism, and what a published sheet puts here.
                     The figures are an EXAMPLE and are never written — a default in the
                     template layer becomes somebody's live table the first time nobody
                     overwrites it. -->
                @if (sheetNote(); as note) {
                  <aside class="sheet">
                    <p class="sheet-mech">{{ note.mechanism }}</p>
                    @if (note.example) {
                      <p class="sheet-eg">
                        <span class="sheet-eg-label" i18n="@@spt.sheet.eg">On a real sheet</span>
                        {{ note.example }}
                      </p>
                    }
                  </aside>
                }

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
                    [suggestedBands]="suggestedBands()"
                  />
                }
              </section>
            }
          }
        </form>
      }
    </app-form-page>
  `,
  styles: [
    `
      :host {
        display: block;
      }
      /* The rail is the first thing on the page body, and it is chrome — a step's worth of
         air below it, not the section gap the three questions use between themselves. */
      app-wizard-steps {
        display: block;
        margin-block-end: var(--space-7);
        padding-block-end: var(--space-5);
        border-block-end: 1px solid var(--color-border-default);
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
        gap: var(--space-5);
      }
      .q {
        margin: 0;
        font-size: var(--text-xl);
        font-weight: var(--font-bold);
        line-height: var(--line-height-tight);
        color: var(--color-text-primary);
      }
      .lede {
        margin: calc(var(--space-4) * -1) 0 0;
        max-inline-size: 52rem;
        font-size: var(--text-sm);
        color: var(--color-text-secondary);
        line-height: var(--line-height-base);
      }

      /* ── picks: a short row of plain choices ───────────────────────────── */
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

      /* ── cards: the shape pick, the one real decision on step 1 ─────────── */
      /* A GRID and not a wrapping flex row: as flex the six cards took their own content
         widths, so the rows were ragged and the six examples never lined up with each
         other — which is what they are there to be compared by. */
      .cards {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(min(100%, 17rem), 1fr));
        gap: var(--space-3);
      }
      .card {
        display: flex;
        align-items: flex-start;
        gap: var(--space-3);
        padding: var(--space-4);
        border: 1px solid var(--color-border-default);
        border-radius: var(--radius-lg);
        background: var(--bg-surface);
        text-align: start;
        font: inherit;
        cursor: pointer;
        transition:
          border-color var(--motion-duration-fast) var(--motion-easing-standard),
          background-color var(--motion-duration-fast) var(--motion-easing-standard);
      }
      .card:hover {
        border-color: var(--color-border-strong);
      }
      .card:focus-visible {
        outline: none;
        box-shadow: var(--focus-halo);
        border-color: var(--primary);
      }
      .card:active {
        background: var(--bg-subtle);
      }
      .card.is-on {
        border-color: var(--primary);
        background: var(--primary-subtle);
      }
      .card-text {
        display: flex;
        flex-direction: column;
        gap: var(--space-1);
        min-inline-size: 0;
      }
      .card-name {
        font-size: var(--text-sm);
        font-weight: var(--font-semibold);
        color: var(--color-text-primary);
        line-height: var(--line-height-base);
      }
      .card-eg {
        font-size: var(--text-xs);
        color: var(--color-text-secondary);
        line-height: var(--line-height-base);
      }
      /* A circle, not a rounded square: a square teaches "as many as apply" before the
         first click, and only one of these can be picked. */
      .pick-dot {
        flex: none;
        inline-size: 14px;
        block-size: 14px;
        border-radius: var(--radius-pill);
        border: 1.5px solid var(--color-border-strong);
      }
      /* Held on the NAME's optical line, not on the centre of a two-line card. */
      .card .pick-dot {
        margin-block-start: 3px;
      }
      .card.is-on .pick-dot,
      .pick.is-on .pick-dot {
        border-color: var(--primary);
        box-shadow: inset 0 0 0 3px var(--primary);
      }

      /* ── fields ────────────────────────────────────────────────────────── */
      .field {
        display: flex;
        flex-direction: column;
        gap: var(--space-2);
        max-inline-size: 34rem;
      }
      /* The card grid needs the body's whole width to hold three columns; the 34rem
         reading measure is for a control, not for a set of choices. */
      .field.is-wide {
        max-inline-size: none;
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

      /* ── add-ons ───────────────────────────────────────────────────────── */
      .addon {
        display: flex;
        flex-direction: column;
        gap: var(--space-2);
        padding-block: var(--space-4);
        border-block-start: 1px solid var(--color-border-default);
      }
      /* Tick and text, with the note indented under the NAME rather than starting back at
         the checkbox — five add-ons whose second line began further out than their first
         made the whole section read as unaligned prose. */
      .addon-head {
        display: grid;
        grid-template-columns: auto minmax(0, 1fr);
        align-items: start;
        gap: var(--space-3);
        cursor: pointer;
      }
      .addon-tick {
        inline-size: 18px;
        block-size: 18px;
        margin-block-start: 2px;
        accent-color: var(--primary);
        cursor: pointer;
      }
      .addon-head.is-static {
        cursor: default;
        grid-template-columns: minmax(0, 1fr) auto;
        align-items: baseline;
      }
      .addon-text {
        display: flex;
        flex-direction: column;
        gap: var(--space-1);
        min-inline-size: 0;
      }
      .addon-name {
        font-size: var(--text-base);
        font-weight: var(--font-semibold);
        color: var(--color-text-primary);
        line-height: var(--line-height-tight);
      }
      .addon-note {
        max-inline-size: 52rem;
        font-size: var(--text-sm);
        color: var(--color-text-secondary);
        line-height: var(--line-height-base);
      }
      .addon-body {
        display: flex;
        flex-direction: column;
        gap: var(--space-4);
        align-items: flex-start;
        margin-block-start: var(--space-3);
        /* Aligned with the add-on's own text column, so the body reads as belonging to the
           line above it rather than to the section. */
        margin-inline-start: calc(18px + var(--space-3));
        padding-inline-start: var(--space-4);
        border-inline-start: var(--rule-width-accent) solid var(--primary-subtle);
        animation: spt-reveal var(--motion-duration-base) var(--motion-easing-standard);
      }
      .addon-body > .field,
      .addon-body > .ways {
        inline-size: 100%;
      }
      @keyframes spt-reveal {
        from {
          opacity: 0;
          transform: translateY(-4px);
        }
      }

      /* ── ways ──────────────────────────────────────────────────────────── */
      .ways {
        display: flex;
        flex-direction: column;
        gap: var(--space-3);
      }
      /* One line per way. The label sits on the controls' own baseline row, and Remove is
         pushed to the end so the two selects stay adjacent — they are read together. */
      .way {
        display: grid;
        grid-template-columns: auto minmax(0, 1fr) auto;
        align-items: end;
        gap: var(--space-3);
        padding-block-end: var(--space-3);
        border-block-end: 1px solid var(--color-border-default);
      }
      .way:last-of-type {
        padding-block-end: 0;
        border-block-end: 0;
      }
      .way-n {
        padding-block-end: var(--space-2-5);
        font-size: var(--text-xs);
        font-weight: var(--font-semibold);
        color: var(--color-text-tertiary);
        white-space: nowrap;
      }
      .way-f {
        display: flex;
        flex-direction: column;
        gap: var(--space-2);
        min-inline-size: 0;
      }
      .way-x {
        padding-block-end: var(--space-2-5);
      }
      @media (max-width: 40rem) {
        .way {
          grid-template-columns: minmax(0, 1fr);
          align-items: stretch;
        }
        .way-n,
        .way-x {
          padding-block-end: 0;
        }
        .way-x {
          justify-self: start;
        }
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

      /* The scope of an adjustment is a DECISION worth 300,000 on one applicant, so it reads
         as a question with two answers rather than as a checkbox that defaults itself. */
      .scope {
        display: flex;
        flex-direction: column;
        gap: var(--space-1);
        margin: 0;
        padding: 0;
        border: 0;
      }
      .radio {
        display: flex;
        align-items: center;
        gap: var(--space-2);
        font-size: var(--text-sm);
        color: var(--text-primary);
        cursor: pointer;
      }
      .scope-note {
        margin: 0;
        margin-block-start: var(--space-1);
        font-size: var(--text-xs);
        line-height: var(--leading-normal);
        color: var(--text-secondary);
      }

      .sheet {
        display: flex;
        flex-direction: column;
        gap: var(--space-2);
        padding: var(--space-4);
        background: var(--bg-subtle);
        border-radius: var(--radius-md);
        /* --primary, not --primary-subtle: the pale tint measured all but invisible against
           this panel's own ground, and a rule nobody can see is a rule that is not there. */
        border-inline-start: var(--rule-width-accent) solid var(--primary);
      }
      .sheet-mech {
        margin: 0;
        font-size: var(--text-sm);
        line-height: var(--leading-normal);
        color: var(--text-primary);
      }
      .sheet-eg {
        margin: 0;
        font-size: var(--text-sm);
        line-height: var(--leading-normal);
        color: var(--text-secondary);
      }
      /* Secondary for the same measured reason as the card's worked example: tertiary is
         3.54:1 on this ground in light mode. A micro-label is small AND uppercase, which is
         the worst case for it — and this one names where the figures beside it came from. */
      .sheet-eg-label {
        font-size: var(--text-xs);
        font-weight: var(--font-semibold);
        letter-spacing: 0.06em;
        text-transform: uppercase;
        color: var(--text-secondary);
        margin-inline-end: var(--space-2);
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
        .card,
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
  /**
   * Which of the three questions is on stage.
   *
   * The signal is the truth and the URL mirrors it (`?step=`, `replaceUrl`) — the same
   * convention `?loan=` and `?basis=` already follow on the catalog screens, so a reload and
   * a pasted link both land where the operator was, and moving between steps does not fill
   * the back button with navigation states.
   */
  protected readonly step = signal(0);
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
    upliftScope: this.fb.nonNullable.control<'income' | 'maxLoan'>('income'),
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
    const group = this.fb.nonNullable.group({
      kind: this.fb.nonNullable.control<TemplateMechanismKind>(kind),
      fact: this.fb.nonNullable.control(fact),
    });
    // The fact a table is keyed by and the fact a percentage reads are different KINDS of
    // answer, so carrying the old pick across would leave a select showing a value that is
    // no longer in its own list. Wired HERE rather than in a click handler because the shape
    // is a bound `<select>` now: the row is seeded with both values before it is pushed, so
    // this fires only on an operator's own change.
    group.controls.kind.valueChanges.subscribe(() => group.controls.fact.setValue(''));
    return group;
  }

  ngOnInit(): void {
    this.key = this.route.snapshot.paramMap.get('key') ?? '';
    // Read once from the snapshot, like `?loan=` and `?basis=`: the signal is the truth from
    // here on, and re-reading a param this screen itself writes would fight its own mirror.
    const step = Number(this.route.snapshot.queryParamMap.get('step'));
    if (Number.isInteger(step) && step >= 0 && step <= 2) this.step.set(step);
    void this.enums.load('surrogate_fact');
    this.form.valueChanges.subscribe(() => this.dirty.set(true));
    // Ticking the addon with nothing under it would say a second way exists and save none,
    // so the tick opens on one empty row — the state it describes.
    this.form.controls.useAlternative.valueChanges.subscribe((on) => {
      if (on && this.alternatives.length === 0) this.alternatives.push(this.wayGroup());
    });
    void this.load();
  }

  /**
   * The blueprint behind this product, fetched only when there IS one.
   *
   * One extra read on a screen that already makes one, and only for a product created from
   * the library: a hand-shaped product pays nothing for a list it would not use.
   */
  private async loadBlueprint(key: string): Promise<void> {
    try {
      const res = await this.api.listProductBlueprints();
      this.blueprint.set(res.data.find((blueprint) => blueprint.key === key) ?? null);
    } catch {
      // The figures step works without it — it loses one grey sentence and the offer of a
      // bracket list. Not worth a refusal on a screen whose job is the numbers.
      this.blueprint.set(null);
    }
  }

  /** This product's mechanism and its worked example, when it came from the library. */
  protected readonly sheetNote = computed(() => {
    const blueprint = this.blueprint();
    if (blueprint === null) return null;
    const copy = blueprintCopy(blueprint.key, blueprint.labelEn);
    if (copy.mechanism === '' && copy.example === '') return null;
    return { mechanism: copy.mechanism, example: copy.example };
  });

  /**
   * The brackets a published sheet prints, keyed by the box they belong in.
   *
   * The SLOT comes from the server, which owns slot naming: a slot this screen worked out for
   * itself would be a second statement of the rule that decides where a bank's figures live,
   * and it would disagree the day a way is added to the product.
   */
  protected readonly suggestedBands = computed<Record<string, IncomeBand[]>>(() => {
    const blueprint = this.blueprint();
    if (blueprint === null) return {};
    const out: Record<string, IncomeBand[]> = {};
    for (const suggestion of blueprint.suggestedBands) {
      const edges = suggestion.edges.map((edge) => ({
        fromInclusive: edge.fromInclusive,
        toExclusive: edge.toExclusive,
        // Blank on purpose. The edges are the shape of the table; the figure beside each is
        // the bank's, and a band carrying one would be a number nobody authored.
        incomeEGP: '',
      }));
      // The way's own box, AND every column of it. A second column re-prints the same
      // brackets with different figures — that is what a column IS — so offering them only on
      // the first would leave the operator retyping six edges per tier off a photograph,
      // which is where an edge gets mistyped.
      //
      // Which boxes exist is read off the COMPILED steps rather than assembled from the
      // form's branch list: the compile is what named them, and a column slug worked out here
      // would be a second statement of that naming.
      for (const step of this.compiledSteps()) {
        if (step.op !== 'bandTable') continue;
        if (step.id === suggestion.slotId || step.id.startsWith(`${suggestion.slotId}__`)) {
          out[step.id] = edges.map((edge) => ({ ...edge }));
        }
      }
    }
    return out;
  });

  // --- the rail --------------------------------------------------------------

  protected readonly railAria = $localize`:@@spt.rail.aria:The calculation, in three steps`;
  protected readonly railCaption = $localize`:@@spt.rail.caption:Everything saves together, so move between the steps in any order.`;

  /**
   * The three steps, with the status each is actually IN.
   *
   * Step 1 reads `done` the moment nothing on it is refused, because there is exactly one
   * thing it can be missing. Step 2 is `done` only when something on it is switched on:
   * every add-on is optional, and a green tick on an untouched section would say a decision
   * was made where none was. Step 3 never reports either way — the figures are a bank's to
   * fill in, so "no numbers here" is a normal, finished state for a catalog product.
   */
  protected railSteps(): readonly WizardStepItem[] {
    const s1 = this.step1Block();
    const s2 = this.step2Block();
    return [
      {
        id: 'calc',
        label: $localize`:@@spt.step.1:The calculation`,
        status: s1 !== null ? 'invalid' : 'done',
      },
      {
        id: 'extras',
        label: $localize`:@@spt.step.2:Extras`,
        status: s2 !== null ? 'invalid' : this.hasExtras() ? 'done' : 'todo',
      },
      { id: 'figures', label: $localize`:@@spt.step.3:The numbers` },
    ];
  }

  protected goStep(index: number): void {
    if (index === this.step()) return;
    this.step.set(index);
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { step: index },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  /** Whether step 2 states anything at all — what tells its `done` from its `todo`. */
  private hasExtras(): boolean {
    const v = this.form.getRawValue();
    return (
      v.useAlternative || v.useSecondColumn || v.useUplift || v.iScore || this.conditions.length > 0
    );
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
    return this.step1Block() ?? this.step2Block();
  }

  /** What step 1 refuses, or `null`. Named per step so the rail can point at the right one. */
  private step1Block(): string | null {
    if (this.primaryNeedsFact() && !this.form.controls.primaryFact.value) {
      return $localize`:@@spt.form.block_fact:Choose which answer the calculation reads.`;
    }
    return null;
  }

  /** What step 2 refuses, or `null`. */
  private step2Block(): string | null {
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
    // no longer in its own list. Cleared unconditionally: the guard that used to sit here
    // compared the new kind against the control it had just written, so it was never true.
    this.form.controls.primaryFact.setValue('');
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

  /**
   * Fields of the stored form this screen does NOT ask about, carried across a save.
   *
   * Written out because dropping them is silent and expensive. `blueprintKey` is what makes
   * the form reopen as this product's own; `secondColumn.branchOn` is what makes a column read
   * a CLASS rather than an answer; `share` is the joint-ownership halving. None of the three
   * has a control here yet, and a save that re-emitted only what it can see would delete them
   * while reporting success — the same failure `withStoredStructure` exists to prevent one
   * level down, on the same object.
   */
  /**
   * The predefined product this form came from, when it came from one.
   *
   * Read for two things and nothing else: the sentence at the top of the figures step that
   * says what a published sheet puts in these boxes, and the brackets it offers to a band
   * table. It never changes what is saved — `blueprintKey` is carried by `storedExtras` — so
   * a product whose blueprint this bundle has no words for still saves exactly as it reads.
   */
  protected readonly blueprint = signal<ProductBlueprint | null>(null);

  private readonly storedExtras = signal<{
    blueprintKey?: string;
    branchOn?: 'answer' | 'parentClass';
    share?: NonNullable<ProductTemplate['share']>;
  }>({});

  /** The form, as the shape the server compiles. */
  private toTemplate(): ProductTemplate {
    const v = this.form.getRawValue();
    const extras = this.storedExtras();
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
        ? {
            secondColumn: {
              fact: v.columnFact,
              branches: [...v.columnBranches],
              // Carried, not asked about: which of the two a stored column reads is a
              // property of the product, and re-emitting it as "the answer" would silently
              // repoint a tier column at twenty-seven governorate codes it has no rows for.
              ...(extras.branchOn !== undefined ? { branchOn: extras.branchOn } : {}),
            },
          }
        : {}),
      ...(v.useUplift && v.upliftWhen && v.upliftOtherwise
        ? {
            uplift: {
              fact: v.upliftFact,
              whenOption: v.upliftWhen,
              otherwiseOption: v.upliftOtherwise,
              // The difference between two answers 300,000 apart on one applicant, so it is
              // STATED on every save rather than left to the compiler's default.
              scope: v.upliftScope,
            },
          }
        : {}),
      ...(extras.share !== undefined ? { share: extras.share } : {}),
      ...(v.iScore ? { iScore: true } : {}),
      ...(extras.blueprintKey !== undefined ? { blueprintKey: extras.blueprintKey } : {}),
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

      // A brand-new product arrives with no form. `?from=` is the shape (or shapes) the
      // operator picked on the previous screen — carried on the URL rather than in a service
      // so a reload, and a link pasted to a colleague, both land on the same ones.
      if (res.data.template === null && !res.data.advanced) {
        this.seedFromStarters(this.route.snapshot.queryParamMap.get('from'));
      }
      const fromLibrary = res.data.template?.blueprintKey;
      if (fromLibrary !== undefined) {
        void this.loadBlueprint(fromLibrary);
        // Open on the FIGURES, and only when the operator has not asked for a step. Every
        // question above is already answered — the library answered them — so landing on the
        // first one would ask them to re-read three screens of decisions they did not make
        // and cannot improve. The rail still walks back to all of them.
        if (this.route.snapshot.queryParamMap.get('step') === null) this.step.set(2);
      }
      this.dirty.set(false);
      this.figuresDirty.set(false);
    } finally {
      this.loading.set(false);
    }
  }

  /**
   * Open a blank form on the ways the operator ticked on the screen before this one.
   *
   * A COMMA-SEPARATED list, and a single value is the same thing with one member — so every
   * link written before the picker went multi-select still lands on exactly one way, with no
   * combine, which is what it always did.
   *
   * Two rules that only matter when the URL is wrong, either because it was hand-edited or
   * because a future card changed:
   *
   *   An unknown key is DROPPED, not defaulted. Guessing a mechanism would seed a shape the
   *   operator never picked, and the form would look answered.
   *
   *   A key whose output kind disagrees with the FIRST one is dropped too. A product carries
   *   one `outputKind`, so an income way beside a ceiling way is unrepresentable — the picker
   *   makes it unclickable, and this is the same rule stated where the URL is read.
   *
   * `combine` is seeded as `lower` for more than one way, per the design spec (§4 Q2 — "take
   * the lower of the two", and every sheet reading that way takes the lower). The operator
   * can change it on the control two sections down; what they cannot do is end up with a
   * multi-way product that silently quotes whichever way happened to be filled in first.
   */
  private seedFromStarters(raw: string | null): void {
    const keys = (raw ?? '')
      .split(',')
      .map((key) => key.trim())
      .filter((key) => key !== '');
    const seeds = keys.map((key) => STARTER_SEED[key]).filter((seed) => seed !== undefined);
    const [primary, ...rest] = seeds;
    if (primary === undefined) return;

    const sameKind = rest.filter((seed) => seed.outputKind === primary.outputKind);
    this.alternatives.clear();
    for (const seed of sameKind) this.alternatives.push(this.wayGroup(seed.mechanism));

    this.form.patchValue({
      primaryKind: primary.mechanism,
      outputKind: primary.outputKind,
      useAlternative: sameKind.length > 0,
      combine: sameKind.length > 0 ? 'lower' : '',
    });
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

    if (template === null) {
      this.storedExtras.set({});
      this.blueprint.set(null);
      return;
    }

    this.storedExtras.set({
      ...(template.blueprintKey !== undefined ? { blueprintKey: template.blueprintKey } : {}),
      ...(template.secondColumn?.branchOn !== undefined
        ? { branchOn: template.secondColumn.branchOn }
        : {}),
      ...(template.share !== undefined ? { share: template.share } : {}),
    });

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
      // Absent reads as `income`, which is what every form stored before the field existed
      // compiled to — so an old product recompiles to byte-identical steps.
      upliftScope: template.uplift?.scope ?? 'income',
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
  ceiling_by_choice: { mechanism: 'choiceTable', outputKind: 'maxAmount' },
};
