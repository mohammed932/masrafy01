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
import { newestFirst } from '@features/ready-methods/method-facts';
import { MoneyInputDirective } from '@core/directives/money-input.directive';
import {
  ChangeDetectionStrategy,
  Component,
  HostListener,
  LOCALE_ID,
  OnInit,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { RouterLink } from '@angular/router';
import { GroupBoardComponent, type BoardAnswer } from '@shared/groups/group-board.component';
import { SearchSelectComponent, type SearchSelectOption } from '@shared/ui/search-select.component';
import { FormArray, FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { DERIVED_FACTS, derivedFactByKey } from '@core/surrogate-facts';
import { suggestedBandsBySlot } from '@shared/income-rule/suggested-bands';
import { BankProgramsApiService } from '@features/bank-programs/bank-programs.api.service';
import { LookupsApiService } from '@features/lookups/lookups.api.service';
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
  type TemplateColumn,
  type TemplateGroup,
  type TemplateCondition,
  type TemplateMechanism,
  type TemplateMechanismKind,
  type MethodTemplate,
} from '@features/bank-programs/bank-programs.types';

/** Which kind of answer a mechanism can read. `null` = it reads none. */
const MECHANISM_FACT_TYPE: Readonly<
  Record<TemplateMechanismKind, 'SINGLE_SELECT' | 'NUMERIC' | null>
> = {
  choiceTable: 'SINGLE_SELECT',
  classTable: 'SINGLE_SELECT',
  numberBand: 'NUMERIC',
  shareOf: 'NUMERIC',
  multipleOf: 'NUMERIC',
  dividedBy: 'NUMERIC',
  flatAmount: null,
};

/**
 * How many FURTHER ways one product may offer.
 *
 * Mirrors the server's own cap (`MAX_WAYS`, six including the first). Stated here so the
 * Add button can withhold itself rather than teach the operator that Add is broken.
 */
const MAX_ALTERNATIVES = 5;

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

/** The ways a NUMBER question can give an income — each an income the bank applies DBR to. */
const NUMBER_WAYS: readonly TemplateMechanismKind[] = [
  'numberBand',
  'shareOf',
  'multipleOf',
  'dividedBy',
];

@Component({
  selector: 'app-product-template-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MoneyInputDirective, NgTemplateOutlet, ReactiveFormsModule, RouterLink, GroupBoardComponent, SearchSelectComponent],
  template: `
    <!-- The product page's Amount and "Who can't get it" steps (v37.0.0, the one-page rate sheet).
         One instance, mounted once by the product page, so an edit survives moving between steps;
         the part input picks which half is on screen. No Save of its own: the page's one Save calls
         saveNow(). -->
    @if (advanced()) {
      <p class="notice" role="status">
        <span i18n="@@spt.advanced"
          >This product's calculation was built step by step, so there is no form for it. You can
          still edit the steps on the product page.</span
        >
      </p>
    } @else if (loading()) {
      <p class="muted" i18n="@@ps.loading">Loading…</p>
    } @else if (part() === 'amount') {
      <section class="blk">
        <h2 i18n="@@ps.decides">What decides the amount?</h2>

        @if (wayCount() > 1) {
          <div class="methods" role="tablist" [attr.aria-label]="methodsAria">
            @for (i of wayIndexes(); track i) {
              <button
                type="button"
                role="tab"
                class="mtab"
                [class.on]="shownWay() === i"
                [attr.aria-selected]="shownWay() === i"
                (click)="openWay.set(i)"
              >
                <b>{{ linkedKey(i) !== '' ? linkedName(i) : methodLabel(i) }}</b>
                <span>{{ wayTitle(i) }}</span>
              </button>
            }
            @if (canAddWay()) {
              <button type="button" class="mtab add" (click)="addWay()">
                <span i18n="@@ps.add_method_short">+ Method</span>
              </button>
            }
          </div>
          <div class="row">
            <span class="muted" i18n="@@ps.banks_use">Banks use</span>
            <div class="seg" role="radiogroup" [attr.aria-label]="waysModeAria">
              <button
                type="button"
                role="radio"
                [attr.aria-checked]="form.controls.waysAre.value === 'exclusive'"
                (click)="setWaysMode('exclusive')"
                i18n="@@ps.one_each"
              >
                one method each
              </button>
              <button
                type="button"
                role="radio"
                [attr.aria-checked]="form.controls.waysAre.value === 'combined'"
                (click)="setWaysMode('combined')"
                i18n="@@ps.lowest_wins"
              >
                all methods, the lowest wins
              </button>
            </div>
          </div>
        }

        @for (i of [shownWay()]; track i) {
          @if (methods().length > 0) {
            <div class="ready" [class.quiet]="wayFactValue(i) !== ''">
              <div class="ready-l">
                @if (linkedKey(i) !== '') {
                  <span i18n="@@ps.ready_method">Surrogate method</span>
                } @else if (wayFactValue(i) === '') {
                  <span i18n="@@ps.use_ready">Use a surrogate method</span>
                } @else {
                  <span i18n="@@ps.replace_ready">Replace with a surrogate method</span>
                }
                <app-search-select
                  [options]="methodOpts()"
                  [value]="linkedKey(i)"
                  [placeholder]="pickOne"
                  [ariaLabel]="methodAria"
                  (changed)="pickMethod(i, $event)"
                />
              </div>
              @if (wayFactValue(i) === '') {
                <span class="muted" i18n="@@ps.or_build"
                  >or build it: pick the questions below.</span
                >
              }
            </div>
          }
          @if (linkedKey(i) !== '') {
            <div class="mcard">
              <div class="mcard-h">
                <span class="mtag" i18n="@@ps.ready_tag">Surrogate method</span>
                <b>{{ linkedName(i) }}</b>
              </div>
              <p class="msum">{{ linkedSummary(i) }}</p>
              <p class="hint" i18n="@@ps.linked_note2">
                Its questions, how and groups come from the method. The amounts below are this
                product's own: change them here.
              </p>
            </div>
          }
          <!-- The shape (questions, how, columns, groups): the product's own, or the method's. -->
          @if (linkedKey(i) === '') {
            <div class="wayset">
              <div class="deciders">
                @if (wayFactValue(i) !== '' && wayFactValue(i) !== '__flat__') {
                  <span class="chip"
                    ><i>1</i>{{ shortLabel(wayFactValue(i)) }}
                    <button
                      type="button"
                      [attr.aria-label]="removeAria"
                      (click)="toggleDecider(i, wayFactValue(i))"
                    >
                      ✕
                    </button></span
                  >
                }
                @if (wayColumn(i); as column) {
                  <span class="chip"
                    ><i>2</i>{{ shortLabel(column.fact) }}
                    <button
                      type="button"
                      [attr.aria-label]="removeAria"
                      (click)="toggleDecider(i, column.fact)"
                    >
                      ✕
                    </button></span
                  >
                }
                <div class="picker">
                  <button
                    type="button"
                    class="add-q"
                    [attr.aria-expanded]="pickerFor() === i"
                    (click)="togglePicker(i)"
                  >
                    @if (tickedCount(i) > 0) {
                      <span i18n="@@ps.change">Change</span>
                    } @else {
                      <span i18n="@@ps.pick_questions">+ Pick questions</span>
                    }
                  </button>
                  @if (pickerFor() === i) {
                    <div class="pop" role="menu">
                      <input
                        class="pop-q"
                        type="search"
                        [value]="pickerQuery()"
                        (input)="pickerQuery.set(val($event))"
                        [attr.aria-label]="searchAria"
                        [placeholder]="searchAria"
                      />
                      <div class="opts">
                        @if (pickList(addedDeciders()).length > 0) {
                          <p class="opt-h" i18n="@@ps.grp_own">This product's questions</p>
                          @for (f of pickList(addedDeciders()); track f.key) {
                            <ng-container
                              *ngTemplateOutlet="
                                opt;
                                context: { $implicit: f.key, label: f.label, i: i }
                              "
                            />
                          }
                        }
                        @if (pickList(fixedDeciders()).length > 0) {
                          <p class="opt-h" i18n="@@ps.grp_fixed">Asked of every customer</p>
                          @for (f of pickList(fixedDeciders()); track f.key) {
                            <ng-container
                              *ngTemplateOutlet="
                                opt;
                                context: { $implicit: f.key, label: f.label, i: i }
                              "
                            />
                          }
                        }
                        @if (pickList(derivedDeciders()).length > 0) {
                          <p class="opt-h" i18n="@@ps.grp_derived">We work these out ourselves</p>
                          @for (f of pickList(derivedDeciders()); track f.key) {
                            <ng-container
                              *ngTemplateOutlet="
                                opt;
                                context: { $implicit: f.key, label: f.label, i: i }
                              "
                            />
                          }
                        }
                      </div>
                      <div class="pop-f">
                        <span class="muted" i18n="@@ps.ticked"
                          >{{ tickedCount(i) }} of 2 ticked</span
                        >
                        <button
                          type="button"
                          class="btn-sm"
                          (click)="pickerFor.set(null)"
                          i18n="@@ps.done"
                        >
                          Done
                        </button>
                      </div>
                    </div>
                  }
                </div>
              </div>

              @if (wayColumn(i); as column) {
                <p class="hint" i18n="@@ps.rows_cols">
                  Rows by {{ shortLabel(wayFactValue(i)) }}, columns by
                  {{ shortLabel(column.fact) }}.
                </p>
              } @else if (wayReady(i) && wayFactValue(i) !== '__flat__') {
                <p class="hint" i18n="@@ps.second_hint">
                  Tick a second question if the amount also depends on it.
                </p>
              } @else if (addedDeciders().length === 0) {
                <p class="hint">
                  <span i18n="@@ps.only_fixed"
                    >Only the questions every customer answers so far.</span
                  >
                  <button
                    type="button"
                    class="link"
                    (click)="goQuestions.emit()"
                    i18n="@@ps.add_own_q"
                  >
                    Add this product's questions
                  </button>
                </p>
              }

              @if (wayIsNumber(i)) {
                <div class="seg" role="radiogroup" [attr.aria-label]="numberWayAria">
                  @for (w of numberWays; track w.kind) {
                    <button
                      type="button"
                      role="radio"
                      [attr.aria-checked]="wayKind(i) === w.kind"
                      (click)="setWayKind(i, w.kind)"
                    >
                      {{ w.label }}
                    </button>
                  }
                </div>
              }
              @if (wayFactValue(i) !== '' && !wayIsNumber(i) && groupable(wayFactValue(i))) {
                <div class="row">
                  <div class="seg" role="radiogroup" [attr.aria-label]="choiceWayAria">
                    <button
                      type="button"
                      role="radio"
                      [attr.aria-checked]="wayKind(i) === 'choiceTable'"
                      (click)="setWayKind(i, 'choiceTable')"
                      i18n="@@spt.v2.per_answer"
                    >
                      One amount per answer
                    </button>
                    <button
                      type="button"
                      role="radio"
                      [attr.aria-checked]="wayKind(i) === 'classTable'"
                      (click)="setWayKind(i, 'classTable')"
                      i18n="@@spt.v2.per_group"
                    >
                      One amount per group
                    </button>
                  </div>
                  @if (wayKind(i) === 'classTable') {
                    <button type="button" class="link" (click)="toggleEditor(i, 'row')">
                      @if (editorOpen() === i + ':row') {
                        <span i18n="@@ps.groups_done">Done with groups</span>
                      } @else {
                        <span i18n="@@ps.groups_edit">Edit groups</span>
                      }
                    </button>
                  }
                </div>
                @if (wayKind(i) === 'classTable' && editorOpen() === i + ':row') {
                  <ng-container *ngTemplateOutlet="groupsEd; context: { i: i, axis: 'row' }" />
                }
              }
              @if (wayColumn(i); as column) {
                @if (groupable(column.fact)) {
                  <div class="row">
                    <span class="muted" i18n="@@ps.columns">Columns:</span>
                    <div class="seg" role="radiogroup" [attr.aria-label]="columnModeAria">
                      <button
                        type="button"
                        role="radio"
                        [attr.aria-checked]="columnMode(column) === 'answer'"
                        (click)="setColumnMode(i, 'answer')"
                        i18n="@@ps.col_answer"
                      >
                        one per answer
                      </button>
                      <button
                        type="button"
                        role="radio"
                        [attr.aria-checked]="columnMode(column) === 'groups'"
                        (click)="setColumnMode(i, 'groups')"
                        i18n="@@ps.col_groups"
                      >
                        one per group
                      </button>
                    </div>
                    @if (columnMode(column) === 'groups') {
                      <button type="button" class="link" (click)="toggleEditor(i, 'col')">
                        @if (editorOpen() === i + ':col') {
                          <span i18n="@@ps.groups_done">Done with groups</span>
                        } @else {
                          <span i18n="@@ps.groups_edit">Edit groups</span>
                        }
                      </button>
                    }
                  </div>
                  @if (columnMode(column) === 'groups' && editorOpen() === i + ':col') {
                    <ng-container *ngTemplateOutlet="groupsEd; context: { i: i, axis: 'col' }" />
                  }
                }
              }
            </div>
          }
          <!-- The amounts: always this product's own, linked or not. -->
          <div class="wayset">
            @if (wayReady(i)) {
              @switch (figShape(i)) {
                @case ('table') {
                  <div class="sheet">
                    <table>
                      <thead>
                        <tr>
                          <th>{{ rowHeader(i) }}</th>
                          @for (c of colsOf(i); track c.slot) {
                            <th class="n">{{ c.label }}</th>
                          }
                        </tr>
                      </thead>
                      <tbody>
                        @for (r of rowsOf(i); track r.key) {
                          <tr>
                            <td>{{ r.label }}</td>
                            @for (c of colsOf(i); track c.slot) {
                              <td class="n">
                                <input
                                  appMoneyInput class="amt"
                                  inputmode="decimal"
                                  [value]="cell(c.slot, r.key)"
                                  (change)="setCell(c.slot, r.key, val($event))"
                                  [placeholder]="bankSets"
                                  [attr.aria-label]="r.label + ' — ' + c.label"
                                />
                              </td>
                            }
                          </tr>
                        }
                      </tbody>
                    </table>
                  </div>
                }
                @case ('ranges') {
                  <div class="sheet">
                    <table>
                      <thead>
                        <tr>
                          <th>{{ factLabel(wayFactValue(i)) }}</th>
                          @for (c of colsOf(i); track c.slot) {
                            <th class="n">{{ c.label }}</th>
                          }
                          <th></th>
                        </tr>
                      </thead>
                      <tbody>
                        @for (b of rangesOf(i); track $index; let k = $index) {
                          <tr>
                            <td>
                              <div class="rng">
                                <input
                                  appMoneyInput class="edge"
                                  inputmode="decimal"
                                  [value]="fmt(b.fromInclusive ?? '')"
                                  (change)="setEdge(i, k, 'fromInclusive', val($event))"
                                  [attr.aria-label]="fromAria"
                                />
                                <span i18n="@@ps.to">to</span>
                                <input
                                  appMoneyInput class="edge"
                                  inputmode="decimal"
                                  [value]="fmt(b.toExclusive ?? '')"
                                  (change)="setEdge(i, k, 'toExclusive', val($event))"
                                  [placeholder]="andUp"
                                  [attr.aria-label]="toAria"
                                />
                              </div>
                            </td>
                            @for (c of colsOf(i); track c.slot) {
                              <td class="n">
                                <input
                                  appMoneyInput class="amt"
                                  inputmode="decimal"
                                  [value]="bandAmount(c.slot, k)"
                                  (change)="setBandAmount(i, c.slot, k, val($event))"
                                  [placeholder]="bankSets"
                                  [attr.aria-label]="c.label"
                                />
                              </td>
                            }
                            <td>
                              <button
                                type="button"
                                class="x"
                                [attr.aria-label]="removeAria"
                                (click)="removeRange(i, k)"
                              >
                                ✕
                              </button>
                            </td>
                          </tr>
                        }
                      </tbody>
                    </table>
                  </div>
                  <button type="button" class="link" (click)="addRange(i)" i18n="@@ps.add_range">
                    + Add a range
                  </button>
                }
                @case ('scalar') {
                  <div class="formula">
                    @for (c of colsOf(i); track c.slot) {
                      <p>
                        @if (colsOf(i).length > 1) {
                          <b>{{ c.label }}:</b>
                        }
                        <span
                          >{{ amountWord() }} = {{ factLabel(wayFactValue(i)) }}
                          {{ scalarSign(i) }}</span
                        >
                        <input
                          appMoneyInput class="amt sm"
                          inputmode="decimal"
                          [value]="scalarOf(c.slot)"
                          (change)="setScalar(i, c.slot, val($event))"
                          [placeholder]="bankSets"
                          [attr.aria-label]="figureAria"
                        />
                        @if (wayKind(i) === 'shareOf') {
                          <span>%</span>
                        }
                      </p>
                    }
                  </div>
                }
                @case ('flat') {
                  <p class="formula-line">
                    <span>{{ amountWord() }}</span>
                    <input
                      appMoneyInput class="amt"
                      inputmode="decimal"
                      [value]="flatOf(i)"
                      (change)="setFlat(i, val($event))"
                      [placeholder]="bankSets"
                      [attr.aria-label]="figureAria"
                    />
                  </p>
                }
              }
            }
          </div>
          @if (wayCount() === 1 && wayReady(0) && canAddWay()) {
            <button type="button" class="link" (click)="addWay()" i18n="@@ps.add_method">
              + Add another method (some banks work it out differently)
            </button>
          }
          @if (wayCount() > 1 && i > 0) {
            <button type="button" class="link danger" (click)="removeWay(i - 1)">
              {{ removeMethodLabel(i) }}
            </button>
          }
        }

        @if (
          form.controls.outputKind.value === 'maxAmount' || form.controls.shareFact.value !== ''
        ) {
          <div class="row">
            <label class="check">
              <input
                type="checkbox"
                [checked]="form.controls.shareFact.value !== ''"
                (change)="toggleShare()"
              />
              <span i18n="@@ps.share">Pay only the share of the unit they own</span>
            </label>
            @if (form.controls.shareFact.value !== '') {
              <span class="muted" i18n="@@ps.share_from">from</span>
              <app-search-select
                class="share-pick"
                [options]="numericOpts()"
                [value]="form.controls.shareFact.value"
                [ariaLabel]="shareAria"
                (changed)="form.controls.shareFact.setValue($event)"
              />
            }
          </div>
        }
      </section>
    } @else {
      <section class="blk">
        <h2 i18n="@@ps.who_cant">Who can't get it?</h2>
        @if (conditions.length === 0) {
          <p class="hint" i18n="@@ps.nobody">Nobody is turned away.</p>
        }
        @for (row of conditions.controls; track row.controls.id.value; let k = $index) {
          @let v = row.getRawValue();
          @let state = ruleState(v);
          <div class="rule" [class.off]="state !== 'on' && state !== 'bank'">
            <div class="rule-l">
              <select
                class="rule-q"
                (change)="setMeasure(k, val($event))"
                [attr.aria-label]="questionAria"
              >
                @for (f of ruleFacts(v.measure); track f.key) {
                  <option [value]="f.key" [selected]="f.key === v.measure">{{ f.label }}</option>
                }
              </select>
              @if (v.op === 'oneOf') {
                <span i18n="@@ps.is">is</span>
                <span class="ticks">
                  @for (o of optionsOf(v.measure); track o.code) {
                    <label [class.on]="!v.expect.includes(o.code)">
                      <input
                        type="checkbox"
                        [checked]="!v.expect.includes(o.code)"
                        (change)="toggleTurnedAway(k, o.code)"
                      />{{ optionLabel(o) }}
                    </label>
                  }
                </span>
              } @else {
                <select (change)="setOp(k, val($event))" [attr.aria-label]="ruleAria">
                  @for (op of opsFor(v.measure); track op) {
                    <option [value]="op" [selected]="op === v.op">{{ ruleOpLabel(op) }}</option>
                  }
                </select>
                @switch (v.op) {
                  @case ('atLeast') {
                    <input
                      appMoneyInput class="amt sm"
                      inputmode="decimal"
                      [value]="ruleFigure(v.id, 'minValue')"
                      (change)="setRuleFigure(v.id, 'minValue', val($event))"
                      [placeholder]="bankSets"
                      [attr.aria-label]="figureAria"
                    />
                  }
                  @case ('atMost') {
                    <input
                      appMoneyInput class="amt sm"
                      inputmode="decimal"
                      [value]="ruleFigure(v.id, 'maxValue')"
                      (change)="setRuleFigure(v.id, 'maxValue', val($event))"
                      [placeholder]="bankSets"
                      [attr.aria-label]="figureAria"
                    />
                  }
                  @case ('between') {
                    <input
                      appMoneyInput class="amt sm"
                      inputmode="decimal"
                      [value]="ruleFigure(v.id, 'minValue')"
                      (change)="setRuleFigure(v.id, 'minValue', val($event))"
                      [placeholder]="bankSets"
                      [attr.aria-label]="fromAria"
                    />
                    <span i18n="@@ps.and">and</span>
                    <input
                      appMoneyInput class="amt sm"
                      inputmode="decimal"
                      [value]="ruleFigure(v.id, 'maxValue')"
                      (change)="setRuleFigure(v.id, 'maxValue', val($event))"
                      [placeholder]="bankSets"
                      [attr.aria-label]="toAria"
                    />
                  }
                  @case ('atLeastShareOf') {
                    <input
                      appMoneyInput class="amt sm"
                      inputmode="decimal"
                      [value]="ruleShare(v.id)"
                      (change)="setRuleShare(v.id, val($event))"
                      [placeholder]="bankSets"
                      [attr.aria-label]="figureAria"
                    />
                    <span i18n="@@ps.pct_of">% of</span>
                    <select
                      (change)="row.controls.otherFact.setValue(val($event))"
                      [attr.aria-label]="questionAria"
                    >
                      <option value="" [selected]="v.otherFact === ''" i18n="@@ps.choose">
                        Choose…
                      </option>
                      @for (f of numericFacts(); track f.key) {
                        @if (f.key !== v.measure) {
                          <option [value]="f.key" [selected]="f.key === v.otherFact">
                            {{ f.label }}
                          </option>
                        }
                      }
                    </select>
                  }
                  @default {
                    <select
                      (change)="row.controls.otherFact.setValue(val($event))"
                      [attr.aria-label]="questionAria"
                    >
                      <option value="" [selected]="v.otherFact === ''" i18n="@@ps.choose">
                        Choose…
                      </option>
                      @for (f of choiceFacts(); track f.key) {
                        <option [value]="f.key" [selected]="f.key === v.otherFact">
                          {{ f.label }}
                        </option>
                      }
                    </select>
                    <span class="muted" i18n="@@ps.bank_figures"
                      >(each bank types the figures)</span
                    >
                  }
                }
              }
            </div>
            <div class="rule-r">
              @if (v.op === 'oneOf') {
                <label class="sw">
                  <input
                    type="checkbox"
                    [checked]="ruleApplies(v.id)"
                    (change)="setRuleApplies(v.id)"
                  />
                  @if (ruleApplies(v.id)) {
                    <span i18n="@@ps.on">On</span>
                  } @else {
                    <span i18n="@@ps.off">Off</span>
                  }
                </label>
              } @else if (state === 'on') {
                <span class="state on" i18n="@@ps.on">On</span>
              } @else if (state === 'offNumber') {
                <span class="state" i18n="@@ps.off_until">Off until a number is typed</span>
              }
              <select
                class="rule-msg"
                (change)="setReason(k, val($event))"
                [attr.aria-label]="tellAria"
              >
                @for (code of reasonCodes; track code) {
                  <option [value]="code" [selected]="code === v.reasonCode">
                    {{ reasonLabel(code) }}
                  </option>
                }
              </select>
              <button
                type="button"
                class="x"
                [attr.aria-label]="removeAria"
                (click)="removeCondition(k)"
              >
                ✕
              </button>
            </div>
            @if (
              v.op === 'oneOf' &&
              ruleApplies(v.id) &&
              v.expect.length === optionsOf(v.measure).length
            ) {
              <p class="hint warn" i18n="@@ps.tick_away">Tick the answers to turn away.</p>
            }
          </div>
        }
        <button type="button" class="link" (click)="addCondition()" i18n="@@ps.add_rule">
          + Add a rule
        </button>
      </section>
    }

    @if (saveError(); as err) {
      <p class="err" role="alert">{{ err }}</p>
    }

    <ng-template #groupsEd let-i="i" let-axis="axis">
      <div class="groups">
        <p class="hint" i18n="@@ps.groups_own">These groups are this product's own.</p>
        <app-group-board
          [groups]="groupsOf(i, axis)"
          [answers]="boardAnswers(axisFact(i, axis))"
          [placements]="placementsFor(axisFact(i, axis))"
          [minGroups]="0"
          [question]="factOf(axisFact(i, axis))?.question?.label ?? null"
          [listType]="factOf(axisFact(i, axis))?.question?.optionsEnumerationType ?? null"
          [isAr]="isAr"
          (renamed)="renameGroup(i, axis, $event.key, $event.labelEn, $event.labelAr)"
          (added)="addGroup(i, axis)"
          (removed)="removeGroup(i, axis, $event)"
          (placed)="place(axisFact(i, axis), $event.code, $event.group)"
        />
      </div>
    </ng-template>

    <ng-template #opt let-key let-label="label" let-i="i">
      <button
        type="button"
        class="opt"
        role="menuitemcheckbox"
        [attr.aria-checked]="deciderRank(i, key) > 0"
        [disabled]="!canPick(i, key)"
        (click)="toggleDecider(i, key)"
      >
        <span class="box" aria-hidden="true">{{ deciderRank(i, key) > 0 ? '✓' : '' }}</span>
        <span class="opt-t"
          >{{ label }}
          @if (pickBlock(i, key); as why) {
            <em>{{ why }}</em>
          }
        </span>
        <small>{{ factKindLabel(key) }}</small>
      </button>
    </ng-template>
  `,
  styles: [
    `
      :host {
        display: flex;
        flex-direction: column;
        gap: var(--space-4);
        min-width: 0;
      }
      .blk {
        background: var(--color-surface-default);
        border: 1px solid var(--color-border-default);
        border-radius: var(--radius-lg);
        padding: var(--space-5) var(--space-5);
        display: flex;
        flex-direction: column;
        gap: var(--space-3);
        align-items: flex-start;
        min-width: 0;
      }
      .blk > * {
        max-width: 100%;
      }
      h2 {
        margin: 0;
        font-size: var(--text-md);
        font-weight: var(--font-weight-semibold);
        color: var(--color-text-primary);
      }
      .hint,
      .muted {
        margin: 0;
        font-size: var(--text-sm);
        color: var(--color-text-secondary);
      }
      .hint.warn {
        color: var(--color-warning);
      }
      .notice {
        margin: 0;
        padding: var(--space-3) var(--space-4);
        border-radius: var(--radius-md);
        background: var(--color-info-bg);
        color: var(--color-text-primary);
      }
      .err {
        margin: 0;
        color: var(--color-error);
        font-size: var(--text-sm);
      }
      .row {
        display: flex;
        flex-wrap: wrap;
        gap: var(--space-2) var(--space-3);
        align-items: center;
      }
      .seg {
        display: inline-flex;
        flex-wrap: wrap;
        border: 1px solid var(--color-border-default);
        border-radius: var(--radius-md);
        overflow: hidden;
        background: var(--color-surface-default);
      }
      .seg button {
        border: 0;
        background: none;
        padding: var(--space-1-5) var(--space-3);
        cursor: pointer;
        color: var(--color-text-primary);
        font: inherit;
      }
      .seg button + button {
        border-inline-start: 1px solid var(--color-border-default);
      }
      .seg button[aria-checked='true'] {
        background: var(--color-brand-primary);
        color: var(--color-text-on-brand);
        font-weight: var(--font-weight-semibold);
      }
      .link {
        border: 0;
        background: none;
        color: var(--color-text-link);
        font: inherit;
        font-weight: var(--font-weight-semibold);
        cursor: pointer;
        padding: var(--space-0-5) 0;
      }
      .link:hover {
        color: var(--color-text-link-hover);
      }
      .link.danger {
        color: var(--color-error);
        font-weight: var(--font-weight-medium);
      }
      .x {
        border: 0;
        background: none;
        color: var(--color-text-secondary);
        cursor: pointer;
        border-radius: var(--radius-sm);
        padding: var(--space-0-5) var(--space-1-5);
        font: inherit;
      }
      .x:hover {
        color: var(--color-error);
        background: var(--color-error-bg);
      }
      .check {
        display: inline-flex;
        gap: var(--space-2);
        align-items: center;
        cursor: pointer;
      }
      .check input,
      .sw input,
      .ticks input {
        accent-color: var(--color-brand-primary);
      }
      select,
      .pop-q,
      .gnames input {
        inline-size: auto;
        border: 1px solid var(--color-border-default);
        border-radius: var(--radius-sm);
        padding: var(--space-1-5) var(--space-2-5);
        background: var(--color-surface-default);
        color: var(--color-text-primary);
        font: inherit;
        max-width: 100%;
      }
      /* a method linked to a ready method: read-only here */
      .wayset {
        border: 0;
        margin: 0;
        padding: 0;
        min-inline-size: 0;
        inline-size: 100%;
        display: flex;
        flex-direction: column;
        gap: var(--space-3);
        align-items: flex-start;
      }
      .wayset:disabled .amt,
      .wayset:disabled .edge,
      .wayset:disabled select {
        background: var(--color-surface-muted);
        color: var(--color-text-primary);
      }
      .mcard {
        inline-size: 100%;
        display: flex;
        flex-direction: column;
        gap: var(--space-1-5);
        padding: var(--space-3) var(--space-4);
        border: 1px solid var(--color-brand-primary);
        border-radius: var(--radius-md);
        background: var(--color-tonal-accent-bg);
      }
      .mcard-h {
        display: flex;
        align-items: center;
        gap: var(--space-2);
        flex-wrap: wrap;
        color: var(--color-text-primary);
        font-size: var(--text-md);
      }
      .mtag {
        font-size: var(--text-xxs);
        font-weight: var(--font-weight-semibold);
        text-transform: uppercase;
        letter-spacing: 0.05em;
        padding: 0 var(--space-2);
        border-radius: var(--radius-pill);
        background: var(--color-brand-primary);
        color: var(--color-text-on-brand);
      }
      .msum {
        margin: 0;
        color: var(--color-text-primary);
        font-size: var(--text-sm);
      }
      .linked {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: var(--space-2) var(--space-3);
        inline-size: 100%;
        padding: var(--space-2-5) var(--space-3);
        border-radius: var(--radius-md);
        background: var(--color-tonal-accent-bg);
        color: var(--color-text-primary);
        font-size: var(--text-sm);
      }
      .linked .link {
        text-decoration: none;
      }
      /* ready methods */
      .ready {
        display: flex;
        flex-wrap: wrap;
        align-items: flex-end;
        gap: var(--space-2) var(--space-3);
        inline-size: 100%;
        padding: var(--space-3);
        border: 1px dashed var(--color-border-strong);
        border-radius: var(--radius-md);
        background: var(--color-surface-muted);
      }
      .ready-l {
        display: flex;
        flex-direction: column;
        gap: var(--space-1);
        font-size: var(--text-sm);
        font-weight: var(--font-weight-semibold);
        color: var(--color-text-primary);
      }
      .ready-l app-search-select {
        inline-size: min(26rem, 80vw);
      }
      /* On a method already built, the picker steps back: no frame, no fill. */
      .ready.quiet {
        border: 0;
        background: none;
        padding: 0;
      }
      .ready .link {
        text-decoration: none;
      }
      /* methods */
      .methods {
        display: flex;
        flex-wrap: wrap;
        gap: var(--space-2);
      }
      .mtab {
        border: 1px solid var(--color-border-default);
        background: var(--color-surface-default);
        border-radius: var(--radius-md);
        padding: var(--space-1-5) var(--space-3);
        text-align: start;
        cursor: pointer;
        display: flex;
        flex-direction: column;
        max-width: 15rem;
        font: inherit;
        color: var(--color-text-primary);
      }
      .mtab span {
        font-size: var(--text-xs);
        color: var(--color-text-secondary);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .mtab.on {
        border-color: var(--color-brand-primary);
        background: var(--color-tonal-accent-bg);
      }
      .mtab.add {
        color: var(--color-text-link);
        font-weight: var(--font-weight-semibold);
        justify-content: center;
        border-style: dashed;
      }
      /* deciders */
      .deciders {
        display: flex;
        flex-wrap: wrap;
        gap: var(--space-2);
        align-items: center;
      }
      .chip {
        display: inline-flex;
        align-items: center;
        gap: var(--space-2);
        border: 1px solid var(--color-brand-primary);
        background: var(--color-tonal-accent-bg);
        border-radius: var(--radius-pill);
        padding: var(--space-1) var(--space-1-5);
        font-weight: var(--font-weight-semibold);
        color: var(--color-text-primary);
      }
      .chip i {
        font-style: normal;
        inline-size: 1.25rem;
        block-size: 1.25rem;
        border-radius: 50%;
        background: var(--color-brand-primary);
        color: var(--color-text-on-brand);
        display: grid;
        place-items: center;
        font-size: var(--text-xxs);
      }
      .chip button {
        border: 0;
        background: none;
        color: var(--color-tonal-accent-ink);
        cursor: pointer;
        padding: 0 var(--space-1);
        font: inherit;
      }
      .picker {
        position: relative;
      }
      .add-q {
        border: 1px dashed var(--color-border-strong);
        background: var(--color-surface-default);
        border-radius: var(--radius-pill);
        padding: var(--space-1-5) var(--space-3);
        cursor: pointer;
        font: inherit;
        font-weight: var(--font-weight-semibold);
        color: var(--color-text-link);
      }
      .pop {
        position: absolute;
        z-index: 20;
        inset-inline-start: 0;
        inset-block-start: calc(100% + var(--space-1-5));
        inline-size: min(26rem, 80vw);
        background: var(--color-surface-elevated);
        border: 1px solid var(--color-border-default);
        border-radius: var(--radius-lg);
        box-shadow: var(--shadow-lg);
        padding: var(--space-2);
      }
      .pop-q {
        inline-size: 100%;
      }
      .opts {
        max-block-size: 18rem;
        overflow-y: auto;
        margin-block-start: var(--space-1-5);
      }
      .opt-h {
        margin: var(--space-2) var(--space-1-5) var(--space-0-5);
        font-size: var(--text-xxs);
        font-weight: var(--font-weight-bold);
        letter-spacing: 0.05em;
        text-transform: uppercase;
        color: var(--color-text-secondary);
      }
      .opt {
        inline-size: 100%;
        text-align: start;
        border: 0;
        background: none;
        padding: var(--space-1-5) var(--space-2);
        border-radius: var(--radius-sm);
        cursor: pointer;
        display: flex;
        align-items: center;
        gap: var(--space-2-5);
        font: inherit;
        color: var(--color-text-primary);
      }
      .opt:hover:not(:disabled) {
        background: var(--color-surface-row-hover);
      }
      .opt:disabled {
        cursor: not-allowed;
        color: var(--color-text-secondary);
      }
      .opt:disabled .box {
        opacity: 0.4;
      }
      .opt small {
        color: var(--color-text-secondary);
        white-space: nowrap;
      }
      .opt-t {
        flex: 1;
        display: flex;
        flex-direction: column;
      }
      .opt-t em {
        font-style: normal;
        font-size: var(--text-xxs);
        color: var(--color-text-secondary);
      }
      .box {
        flex: none;
        inline-size: 1.125rem;
        block-size: 1.125rem;
        border: 1.5px solid var(--color-border-strong);
        border-radius: var(--radius-sm);
        display: grid;
        place-items: center;
        font-size: var(--text-xs);
        color: var(--color-text-on-brand);
      }
      .opt[aria-checked='true'] .box {
        background: var(--color-brand-primary);
        border-color: var(--color-brand-primary);
      }
      .pop-f {
        display: flex;
        justify-content: space-between;
        align-items: center;
        border-block-start: 1px solid var(--color-border-default);
        margin-block-start: var(--space-1-5);
        padding: var(--space-2) var(--space-1) 0;
        font-size: var(--text-sm);
      }
      .btn-sm {
        border: 0;
        border-radius: var(--radius-md);
        background: var(--color-brand-primary);
        color: var(--color-text-on-brand);
        padding: var(--space-1) var(--space-3);
        font: inherit;
        font-weight: var(--font-weight-semibold);
        cursor: pointer;
      }
      /* the rate sheet */
      .sheet {
        max-inline-size: 100%;
        overflow-x: auto;
        border: 1px solid var(--color-border-default);
        border-radius: var(--radius-md);
      }
      table {
        border-collapse: collapse;
      }
      th,
      td {
        padding: var(--space-1-5) var(--space-3);
        text-align: start;
        border-block-end: 1px solid var(--color-border-default);
        vertical-align: middle;
        color: var(--color-text-primary);
      }
      tr:last-child td {
        border-block-end: 0;
      }
      th {
        background: var(--color-surface-muted);
        font-size: var(--text-xs);
        font-weight: var(--font-weight-semibold);
        color: var(--color-text-secondary);
        white-space: nowrap;
      }
      th.n,
      td.n {
        text-align: start;
      }
      .amt,
      .edge {
        inline-size: 10rem;
        border: 1px solid var(--color-border-default);
        border-radius: var(--radius-sm);
        padding: var(--space-1-5) var(--space-2-5);
        text-align: start;
        background: var(--color-surface-default);
        color: var(--color-text-primary);
        font: inherit;
        font-variant-numeric: tabular-nums;
      }
      .amt.sm {
        inline-size: 8rem;
      }
      .edge {
        inline-size: 7.5rem;
      }
      .amt::placeholder,
      .edge::placeholder {
        color: var(--color-text-tertiary);
        font-size: var(--text-xs);
      }
      .rng {
        display: flex;
        align-items: center;
        gap: var(--space-2);
        white-space: nowrap;
        color: var(--color-text-secondary);
      }
      .formula {
        display: flex;
        flex-direction: column;
        gap: var(--space-2);
      }
      .formula p,
      .formula-line {
        margin: 0;
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: var(--space-2);
      }
      input:focus-visible,
      select:focus-visible,
      button:focus-visible {
        outline: var(--focus-ring-width) solid var(--focus-ring-color);
        outline-offset: var(--focus-ring-offset);
      }
      /* own groups */
      .groups {
        inline-size: 100%;
        border: 1px solid var(--color-border-default);
        border-radius: var(--radius-md);
        background: var(--color-surface-muted);
        padding: var(--space-3);
        display: flex;
        flex-direction: column;
        gap: var(--space-2-5);
      }
      .gnames {
        display: flex;
        flex-wrap: wrap;
        gap: var(--space-2);
        align-items: center;
      }
      .gname {
        display: inline-flex;
        gap: var(--space-1);
        align-items: center;
      }
      .gname input {
        inline-size: 13rem;
      }
      .gplace {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(14rem, 1fr));
        gap: var(--space-1-5) var(--space-3);
      }
      .gplace label {
        display: flex;
        justify-content: space-between;
        gap: var(--space-2);
        align-items: center;
        font-size: var(--text-sm);
      }
      /* rules */
      .rule {
        inline-size: 100%;
        border: 1px solid var(--color-border-default);
        border-radius: var(--radius-md);
        padding: var(--space-2-5) var(--space-3);
        display: flex;
        flex-direction: column;
        gap: var(--space-2);
      }
      .rule.off {
        background: var(--color-surface-muted);
      }
      .rule-l,
      .rule-r {
        display: flex;
        flex-wrap: wrap;
        gap: var(--space-2);
        align-items: center;
      }
      .rule-q {
        max-inline-size: 30rem;
      }
      .rule-msg {
        flex: 1 1 16rem;
      }
      .ticks {
        display: flex;
        flex-wrap: wrap;
        gap: var(--space-1-5);
      }
      .ticks label {
        border: 1px solid var(--color-border-default);
        border-radius: var(--radius-pill);
        padding: var(--space-0-5) var(--space-2-5);
        font-size: var(--text-sm);
        cursor: pointer;
        display: inline-flex;
        gap: var(--space-1-5);
        align-items: center;
        background: var(--color-surface-default);
      }
      .ticks label.on {
        border-color: var(--color-error);
        background: var(--color-error-bg);
      }
      .sw {
        display: inline-flex;
        align-items: center;
        gap: var(--space-1-5);
        font-size: var(--text-sm);
        font-weight: var(--font-weight-semibold);
        cursor: pointer;
      }
      .state {
        font-size: var(--text-sm);
        color: var(--color-text-secondary);
      }
      .state.on {
        color: var(--color-success);
        font-weight: var(--font-weight-semibold);
      }
    `,
  ],
})
export class ProductTemplatePage implements OnInit {
  private readonly api = inject(BankProgramsApiService);
  private readonly enums = inject(PlatformEnumerationsService);
  private readonly errors = inject(ErrorCodeService);
  private readonly fb = inject(FormBuilder);
  private readonly lookups = inject(LookupsApiService);
  protected readonly isAr = inject(LOCALE_ID).startsWith('ar');

  protected readonly reasonCodes = GATE_REASON_CODES;

  /** The product this calculation belongs to. The product page always sets it. */
  readonly embeddedKey = input<string | null>(null);
  /** Which half is on screen: the Amount step, or "Who can't get it". */
  readonly part = input<'amount' | 'rules'>('amount');
  /** Emitted after a save, so the product page re-reads what was compiled. */
  readonly saved = output<void>();
  /** "Go to Questions" on an Amount step with nothing to pick from. */
  readonly goQuestions = output<void>();
  /** The ready methods an empty method can start from (v37.0.0). */
  readonly methods = input<readonly MethodTemplate[]>([]);
  /** Question codes a picked method reads that the product does not ask yet. */
  readonly asksNeeded = output<string[]>();

  protected key = '';

  protected readonly loading = signal(true);
  readonly saving = signal(false);
  protected readonly advanced = signal(false);
  /** Anything unsaved here: the shape, a figure, a group, a placement. */
  readonly dirty = signal(false);
  protected readonly saveError = signal<string | null>(null);
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
  /**
   * The question codes the product's Questions step lists. The calculation picks from what the
   * product asks, never adds a question of its own; a fact it already reads stays listed so an
   * older product reopens as it was.
   */
  readonly askedCodes = input<readonly string[] | null>(null);
  private readonly formRev = signal(0);
  /** Only a bound fact can be read. An unbound one has no answer to look anything up by. */
  protected readonly allFacts = computed(() => this.boundFacts().map((f) => this.asAsked(f)));

  /** A fact named the way the customer is asked it, so every picker matches the Questions step. */
  private asAsked(f: RegistryFact): RegistryFact {
    const asked = f.question?.label?.trim();
    return asked ? { ...f, label: asked } : f;
  }

  private readonly boundFacts = computed(() => {
    this.formRev();
    const bound = this.facts().filter((f) => f.question !== null);
    const asked = this.askedCodes();
    if (asked === null) return bound;
    const v = this.form.getRawValue();
    const used = new Set([
      v.primaryFact,
      v.primaryColumn?.fact,
      v.upliftFact,
      v.shareFact,
      ...v.alternatives.flatMap((a) => [a.fact, a.column?.fact]),
      ...v.conditions.flatMap((c) => [c.measure, c.otherFact]),
    ]);
    return bound.filter((f) => asked.includes(f.question!.code) || used.has(f.key));
  });
  protected readonly choiceFacts = computed(() =>
    this.allFacts().filter((f) => f.question?.type === 'SINGLE_SELECT'),
  );
  protected readonly numericFacts = computed(() =>
    this.allFacts().filter((f) => f.question?.type === 'NUMERIC'),
  );
  /** Every choice or number answer this product can read — what "Worked out from" offers. */
  protected readonly decidingFacts = computed(() =>
    this.allFacts().filter(
      (f) => f.question?.type === 'SINGLE_SELECT' || f.question?.type === 'NUMERIC',
    ),
  );

  readonly form = this.fb.nonNullable.group({
    outputKind: this.fb.nonNullable.control<'monthlyIncome' | 'maxAmount'>('monthlyIncome'),
    baselineDbrPercent: this.fb.nonNullable.control(''),
    primaryKind: this.fb.nonNullable.control<TemplateMechanismKind>('choiceTable'),
    primaryFact: this.fb.nonNullable.control(''),
    /** The first way's own split into columns. */
    primaryColumn: this.fb.control<TemplateColumn | null>(null),
    /** The first way's own row groups, when its amounts are per group. */
    primaryGroups: this.fb.control<TemplateGroup[] | null>(null),
    /** The ready method the first way is linked to ('' = its own). */
    primaryMethod: this.fb.nonNullable.control(''),
    alternatives: this.fb.array<ReturnType<ProductTemplatePage['wayGroup']>>([]),
    combine: this.fb.nonNullable.control<'' | 'lower' | 'higher'>(''),
    /** Alternatives a bank picks one of, or terms every bank states (car cross-sell). */
    waysAre: this.fb.nonNullable.control<'exclusive' | 'combined'>('exclusive'),
    /** The percentage of the thing the customer owns, when only their part is lent against. */
    shareFact: this.fb.nonNullable.control(''),
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

  /** One further way of reaching the figure, with its own split into columns. */
  private wayGroup(
    kind: TemplateMechanismKind = 'choiceTable',
    fact = '',
    column: TemplateColumn | null = null,
    groups: TemplateGroup[] | null = null,
    method = '',
  ) {
    return this.fb.nonNullable.group({
      kind: this.fb.nonNullable.control<TemplateMechanismKind>(kind),
      fact: this.fb.nonNullable.control(fact),
      column: this.fb.control<TemplateColumn | null>(column),
      groups: this.fb.control<TemplateGroup[] | null>(groups),
      method: this.fb.nonNullable.control(method),
    });
  }

  ngOnInit(): void {
    this.key = this.embeddedKey() ?? '';
    void this.enums.load('surrogate_fact');
    this.form.valueChanges.subscribe(() => {
      this.dirty.set(true);
      this.formRev.update((n) => n + 1);
      this.schedulePreview();
    });
    void this.load();
  }

  /** The predefined product this form came from — for the brackets a band table is offered. */
  protected readonly blueprint = signal<ProductBlueprint | null>(null);

  private async loadBlueprint(key: string): Promise<void> {
    try {
      const res = await this.api.listProductBlueprints();
      this.blueprint.set(res.data.find((blueprint) => blueprint.key === key) ?? null);
      // The sheet's ranges arrive after the figures: fill any range table still empty.
      this.figures.set(this.withEveryRow(this.figures(), this.wayIndexes()));
    } catch {
      this.blueprint.set(null);
    }
  }

  /** The brackets a published sheet prints, keyed by the box they belong in (server slots). */
  protected readonly suggestedBands = computed<Record<string, IncomeBand[]>>(() => {
    const blueprint = this.blueprint();
    if (blueprint === null) return {};
    return suggestedBandsBySlot(blueprint.suggestedBands, this.compiledSteps());
  });

  // --- live preview: the boxes always match the choices above them -----------

  protected readonly previewing = signal(false);
  private previewTimer: ReturnType<typeof setTimeout> | null = null;
  private previewSeq = 0;

  /**
   * Ask the server what the form compiles to — written nowhere — so a way's figure boxes
   * appear the moment its choices are made. The server stays the one authority on slot ids;
   * a form that cannot compile yet (a way with no question) just keeps the last good shape.
   */
  private schedulePreview(): void {
    if (this.loading() || this.advanced() || this.key === '') return;
    if (this.previewTimer !== null) clearTimeout(this.previewTimer);
    this.previewTimer = setTimeout(() => void this.preview(), 350);
  }

  private async preview(): Promise<void> {
    this.previewTimer = null;
    if (this.localBlock() !== null) return;
    const seq = ++this.previewSeq;
    this.previewing.set(true);
    try {
      const res = await this.api.previewSurrogateProductTemplate(this.key, {
        template: this.toTemplate(),
        stepParams: cleanFigures(this.figures()),
      });
      if (seq !== this.previewSeq) return;
      const rule = res.data.compiled as {
        steps?: RuleStep[];
        gates?: RuleGate[];
        output?: ProductRuleOutput;
      };
      this.compiled.set({
        steps: (rule.steps ?? []).map((s) => ({ ...s })),
        gates: (rule.gates ?? []).map((g) => ({ ...g })),
        output: rule.output ? { ...rule.output } : null,
      });
      this.seedPicked();
    } catch {
      // Kept as it was: Save names the problem.
    } finally {
      if (seq === this.previewSeq) this.previewing.set(false);
    }
  }

  // --- the amount ------------------------------------------------------------

  protected readonly amountIsAria = $localize`:@@spt.v2.amount_is:The amount is`;
  protected readonly waysModeAria = $localize`:@@spt.v2.ways_mode_aria:How banks use the ways`;
  protected readonly columnModeAria = $localize`:@@spt.v2.col_mode_aria:A column per answer or per group`;
  protected readonly choiceWayAria = $localize`:@@spt.choice_way.aria:One figure per answer or per class`;
  protected readonly numberWayAria = $localize`:@@spt.way.aria:How the income follows from the number`;
  protected readonly figureAria = $localize`:@@spt.v2.figure_aria:Figure`;

  protected readonly numberWays: ReadonlyArray<{ kind: TemplateMechanismKind; label: string }> = [
    { kind: 'numberBand', label: $localize`:@@spt.v2.by_ranges:By ranges` },
    { kind: 'shareOf', label: $localize`:@@spt.v2.pct_of_it:% of it` },
    { kind: 'multipleOf', label: $localize`:@@spt.v2.times:Multiplied by` },
    { kind: 'dividedBy', label: $localize`:@@spt.v2.divided:Divided by` },
  ];

  protected toggleCeiling(on: boolean): void {
    this.form.controls.outputKind.setValue(on ? 'maxAmount' : 'monthlyIncome');
    // The baseline only means something for a ceiling. Left behind on an income product it
    // is refused at save, naming a field that is no longer on screen.
    if (!on) this.form.controls.baselineDbrPercent.setValue('');
  }

  protected wayCount(): number {
    this.formRev();
    return 1 + this.alternatives.length;
  }

  protected readonly wayIndexes = computed(() => {
    this.formRev();
    return Array.from({ length: 1 + this.alternatives.length }, (_, i) => i);
  });

  protected readonly openWay = signal(0);

  protected wayIsOpen(i: number): boolean {
    return this.wayCount() === 1 || this.openWay() === i;
  }

  protected toggleWay(i: number): void {
    this.openWay.set(this.openWay() === i ? -1 : i);
  }

  protected wayKind(i: number): TemplateMechanismKind {
    return i === 0
      ? this.form.controls.primaryKind.value
      : (this.alternatives.at(i - 1)?.controls.kind.value ?? 'choiceTable');
  }

  /** The question a way reads, `__flat__` for the same amount for everyone. */
  protected wayFactValue(i: number): string {
    if (this.wayKind(i) === 'flatAmount') return '__flat__';
    return i === 0
      ? this.form.controls.primaryFact.value
      : (this.alternatives.at(i - 1)?.controls.fact.value ?? '');
  }

  protected factOf(key: string): RegistryFact | undefined {
    return this.allFacts().find((f) => f.key === key);
  }

  protected wayIsNumber(i: number): boolean {
    return this.factOf(this.wayFactValue(i))?.question?.type === 'NUMERIC';
  }

  /** The way follows the answer's type: a choice starts on a figure per answer, a number on ranges. */
  protected setWayFact(i: number, key: string): void {
    let kind: TemplateMechanismKind;
    let fact = key;
    if (key === '__flat__') {
      kind = 'flatAmount';
      fact = '';
    } else {
      const type = this.factOf(key)?.question?.type;
      const current = this.wayKind(i);
      kind =
        type === 'NUMERIC'
          ? NUMBER_WAYS.includes(current)
            ? current
            : 'numberBand'
          : 'choiceTable';
    }
    this.writeWay(i, kind, fact);
    this.toSeed.add(i);
    // A way cannot be split by the answer it already reads.
    if (this.wayColumn(i)?.fact === key || kind === 'flatAmount') this.setWayColumn(i, null);
  }

  protected setWayKind(i: number, kind: TemplateMechanismKind): void {
    this.writeWay(i, kind, this.wayFactValue(i));
    this.toSeed.add(i);
    if (kind === 'classTable' && this.rowGroups(i) === null) {
      void this.seedGroups(i, 'row');
    }
    if (kind !== 'classTable') this.setRowGroups(i, null);
  }

  /** Ways whose question or split the operator just chose: their empty tables get a row each. */
  private readonly toSeed = new Set<number>();

  /**
   * One empty row per answer (or one open range) in every table of a way the operator has just
   * set up, so they type amounts instead of first building rows. A row left blank is dropped on
   * save (`cleanFigures`), so it still means "each bank fills it in".
   */
  private seedPicked(): void {
    if (this.toSeed.size === 0) return;
    this.figures.set(this.withEveryRow(this.figures(), [...this.toSeed]));
    this.toSeed.clear();
  }

  /**
   * Every answer listed in each table of these ways — a missing one added as a blank row, in
   * the list's own order after the rows already there — and one open range in an empty range
   * table. Display only: `cleanFigures` drops every blank row before anything is sent.
   */
  private withEveryRow(
    figures: Record<string, StepFigures>,
    ways: readonly number[],
  ): Record<string, StepFigures> {
    const next = { ...figures };
    for (const i of ways) {
      const slots = this.waySlots(i);
      const fact = this.wayFactValue(i);
      for (const step of this.compiledSteps()) {
        if (!slots.has(step.id)) continue;
        if (step.op === 'factChoiceTable' || step.op === 'factParentTable') {
          const keys =
            step.op === 'factParentTable'
              ? (this.rowGroups(i)?.map((g) => g.key) ??
                (this.factOf(fact)?.question?.parentOptions ?? []).map((o) => o.code))
              : this.optionsOf(fact).map((o) => o.code);
          const rows = [...(next[step.id]?.keyTable ?? [])];
          const have = new Set(rows.map((r) => r.key));
          for (const key of keys) if (!have.has(key)) rows.push({ key, incomeEGP: '' });
          if (rows.length > 0) next[step.id] = { ...next[step.id], keyTable: rows };
        } else if (step.op === 'bandTable' && blankBands(next[step.id]?.bands)) {
          // The ranges the bank's sheet prints, when the product came from one; else one open
          // range. Amounts stay empty, so nothing is saved until someone types one.
          const head = this.headOf(i);
          const sheet = this.suggestedBands()[step.id] ?? this.suggestedBands()[head];
          next[step.id] = {
            ...next[step.id],
            bands:
              sheet && sheet.length > 0
                ? sheet.map((b) => ({
                    fromInclusive: b.fromInclusive,
                    toExclusive: b.toExclusive ?? null,
                    incomeEGP: '',
                  }))
                : [{ fromInclusive: '0', toExclusive: null, incomeEGP: '' }],
          };
        }
      }
    }
    return next;
  }

  private writeWay(i: number, kind: TemplateMechanismKind, fact: string): void {
    if (i === 0) {
      this.form.patchValue({ primaryKind: kind, primaryFact: fact });
    } else {
      this.alternatives.at(i - 1)?.patchValue({ kind, fact });
    }
  }

  protected wayColumn(i: number): TemplateColumn | null {
    this.formRev();
    return i === 0
      ? this.form.controls.primaryColumn.value
      : (this.alternatives.at(i - 1)?.controls.column.value ?? null);
  }

  private setWayColumn(i: number, column: TemplateColumn | null): void {
    this.toSeed.add(i);
    if (i === 0) this.form.controls.primaryColumn.setValue(column);
    else this.alternatives.at(i - 1)?.controls.column.setValue(column);
  }

  /** The choice questions a way may be split by — never the one it reads. */
  protected columnFacts(i: number): RegistryFact[] {
    const own = this.wayFactValue(i);
    return this.choiceFacts().filter((f) => f.key !== own);
  }

  /** The product's fixed questions (the page passes them), to group the picker. */
  readonly fixedCodes = input<readonly string[]>([]);

  private isFixedFact(f: RegistryFact): boolean {
    return f.question !== null && this.fixedCodes().includes(f.question.code);
  }

  /** The questions added for this product, first in the picker. */
  protected readonly addedDeciders = computed(() =>
    this.decidingFacts().filter((f) => !this.isFixedFact(f)),
  );

  /** The fixed questions, then what we work out ourselves (a split only). */
  protected readonly otherDeciders = computed<ReadonlyArray<{ key: string; label: string }>>(() => [
    ...this.decidingFacts()
      .filter((f) => this.isFixedFact(f))
      .map((f) => ({ key: f.key, label: f.label })),
    ...DERIVED_FACTS.map((d) => ({ key: d.key, label: this.factLabel(d.key) })),
  ]);

  protected otherPicked(i: number): boolean {
    const picked = [this.wayFactValue(i), this.wayColumn(i)?.fact];
    return this.otherDeciders().some((f) => picked.includes(f.key));
  }

  /** 1 for the answer that sets the rows, 2 for the one that sets the columns, else 0. */
  protected deciderRank(i: number, key: string): number {
    if (this.wayFactValue(i) === key) return 1;
    if (this.wayColumn(i)?.fact === key) return 2;
    return 0;
  }

  private isNumberFact(key: string): boolean {
    return this.factOf(key)?.question?.type === 'NUMERIC';
  }

  private firstPick(i: number): string {
    const v = this.wayFactValue(i);
    return v === '__flat__' ? '' : v;
  }

  /** What may be ticked now: at most two, at most one number, a worked-out answer only second. */
  protected canPick(i: number, key: string): boolean {
    if (this.deciderRank(i, key) > 0) return true;
    const first = this.firstPick(i);
    const second = this.wayColumn(i)?.fact;
    if (second !== undefined) return false;
    if (first === '') return derivedFactByKey(key) === undefined;
    return !(this.isNumberFact(key) && this.isNumberFact(first));
  }

  protected toggleDecider(i: number, key: string): void {
    const first = this.firstPick(i);
    const second = this.wayColumn(i)?.fact;
    if (key === first) {
      // The second moves up to rows if it can; else the way is empty again.
      if (second !== undefined && derivedFactByKey(second) === undefined)
        this.setWayFact(i, second);
      else this.clearWay(i);
      return;
    }
    if (key === second) {
      this.setWayColumn(i, null);
      return;
    }
    if (!this.canPick(i, key)) return;
    if (first === '') {
      this.setWayFact(i, key);
      return;
    }
    // A number always sets the rows (ranges or a sum); a list beside it sets the columns.
    if (this.isNumberFact(key)) {
      this.setWayFact(i, key);
      this.setColumnFact(i, first);
      return;
    }
    this.setColumnFact(i, key);
  }

  protected clearWay(i: number): void {
    this.writeWay(i, 'choiceTable', '');
    this.setWayColumn(i, null);
  }

  protected columnsOfLabel(key: string): string {
    const name = this.factLabel(key);
    return $localize`:@@spt.v2.columns_of:Columns: ${name}:NAME:`;
  }

  /** What "Different amounts by" offers: the choices, plus the one in use if it is not one. */
  protected columnChoices(i: number): ReadonlyArray<{ key: string; label: string }> {
    const list: Array<{ key: string; label: string }> = this.columnFacts(i).map((f) => ({
      key: f.key,
      label: f.label,
    }));
    // What we work out ourselves (a new loan or a top-up, …) splits a table as well as an answer.
    for (const derived of DERIVED_FACTS) {
      if (!list.some((f) => f.key === derived.key))
        list.push({ key: derived.key, label: this.factLabel(derived.key) });
    }
    const current = this.wayColumn(i)?.fact;
    if (current !== undefined && !list.some((f) => f.key === current)) {
      list.push({ key: current, label: this.factLabel(current) });
    }
    return list;
  }

  /** A fact's name, bound to a question or not (new loan or top-up is worked out). */
  protected factLabel(key: string): string {
    const derived = derivedFactByKey(key);
    if (derived !== undefined) {
      return $localize`:@@spt.v2.worked_out_by_us:${derived.label}:NAME: (worked out by us, not asked)`;
    }
    const fact = this.facts().find((f) => f.key === key);
    if (fact) return this.asAsked(fact).label;
    return key;
  }

  protected startColumn(i: number): void {
    const first = this.columnFacts(i)[0];
    if (first) this.setColumnFact(i, first.key);
  }

  /** One column per answer, in the list's own order; the first is the standard column. */
  protected setColumnFact(i: number, key: string): void {
    if (key === '') {
      this.setWayColumn(i, null);
      return;
    }
    this.setWayColumn(i, { fact: key, branches: this.optionsOf(key).map((o) => o.code) });
  }

  protected setColumnMode(i: number, mode: 'answer' | 'groups'): void {
    const current = this.wayColumn(i);
    if (current === null) return;
    const fact = current.fact;
    if (mode === 'answer') {
      this.setWayColumn(i, { fact, branches: this.optionsOf(fact).map((o) => o.code) });
      return;
    }
    if (current.groups === undefined) void this.seedGroups(i, 'col');
  }

  protected readonly groupsOpen = signal(false);

  protected branchName(column: TemplateColumn, branch: string): string {
    return this.branchLabel(column, branch);
  }

  /**
   * The column used when the customer gives no answer — the FIRST one, which keeps the way's
   * bare slot. Moving another to the front moves every column's figures with it, so nothing a
   * person typed is lost or swapped.
   */
  protected setStandardBranch(i: number, branch: string): void {
    const column = this.wayColumn(i);
    if (column === null || column.branches[0] === branch) return;
    const head = this.headOf(i);
    const slotOf = (b: string, branches: readonly string[]) =>
      branches.indexOf(b) === 0 ? head : `${head}__${b}`;
    const branches = [branch, ...column.branches.filter((b) => b !== branch)];
    const before = this.figures();
    const next = { ...before };
    for (const b of column.branches) delete next[slotOf(b, column.branches)];
    for (const b of column.branches) {
      const figure = before[slotOf(b, column.branches)];
      if (figure !== undefined) next[slotOf(b, branches)] = figure;
    }
    this.figures.set(next);
    const groups = column.groups
      ? branches.map((b) => column.groups!.find((g) => g.key === b)!).filter(Boolean)
      : undefined;
    this.setWayColumn(i, { ...column, branches, ...(groups ? { groups } : {}) });
  }

  /** The board that moves a list's answers between its groups, for this product. */
  protected refreshFacts(): void {
    void this.enums.refresh('surrogate_fact');
  }

  // --- this product's own groups (v37.0.0): rows and columns alike ----------------

  /** Its answers come from a list long enough to group (or already grouped). */
  protected groupable(key: string): boolean {
    const q = this.factOf(key)?.question;
    if (q?.type !== 'SINGLE_SELECT' || q.optionsEnumerationType === undefined) return false;
    return (q.parentOptions?.length ?? 0) > 0 || (q.options?.length ?? 0) > 3;
  }

  protected columnMode(column: TemplateColumn): 'answer' | 'groups' {
    return column.branchOn === 'parentClass' ? 'groups' : 'answer';
  }

  protected rowGroups(i: number): TemplateGroup[] | null {
    this.formRev();
    return i === 0
      ? this.form.controls.primaryGroups.value
      : (this.alternatives.at(i - 1)?.controls.groups.value ?? null);
  }

  private setRowGroups(i: number, groups: TemplateGroup[] | null): void {
    if (i === 0) this.form.controls.primaryGroups.setValue(groups);
    else this.alternatives.at(i - 1)?.controls.groups.setValue(groups);
  }

  protected groupsOf(i: number, axis: 'row' | 'col'): TemplateGroup[] {
    return (axis === 'row' ? this.rowGroups(i) : this.wayColumn(i)?.groups) ?? [];
  }

  protected axisFact(i: number, axis: 'row' | 'col'): string {
    return axis === 'row' ? this.wayFactValue(i) : (this.wayColumn(i)?.fact ?? '');
  }

  private setGroupsOf(i: number, axis: 'row' | 'col', groups: TemplateGroup[]): void {
    if (axis === 'row') {
      this.setRowGroups(i, groups);
      return;
    }
    const col = this.wayColumn(i);
    if (col === null) return;
    this.setWayColumn(i, {
      fact: col.fact,
      branchOn: 'parentClass',
      branches: groups.map((g) => g.key),
      groups,
    });
  }

  protected readonly editorOpen = signal<string | null>(null);

  protected toggleEditor(i: number, axis: 'row' | 'col'): void {
    const id = `${i}:${axis}`;
    this.editorOpen.set(this.editorOpen() === id ? null : id);
  }

  /**
   * Make a way's groups this product's own. A list that already has groups (compound classes,
   * city tiers) is copied as it stands — same keys, so every figure stays where it is — with
   * each answer where it is priced today; any other list starts with two groups.
   */
  private async seedGroups(i: number, axis: 'row' | 'col'): Promise<void> {
    const fact = this.axisFact(i, axis);
    const shared = this.factOf(fact)?.question?.parentOptions ?? [];
    await this.ensureList(fact);
    // A list with no groups of its own starts with none: the operator adds and names them.
    const groups: TemplateGroup[] = shared.map((o) => ({
      key: o.code,
      labelEn: o.labelEn,
      labelAr: o.labelAr,
    }));
    if (this.placements()[fact] === undefined) {
      const keys = new Set(groups.map((g) => g.key));
      const now = this.pricedIn()[fact] ?? {};
      this.placements.set({
        ...this.placements(),
        [fact]: Object.fromEntries(
          this.optionsOf(fact).flatMap((o) => {
            const at = now[o.code];
            return at !== undefined && keys.has(at) ? [[o.code, at]] : [];
          }),
        ),
      });
    }
    this.setGroupsOf(i, axis, groups);
    this.editorOpen.set(`${i}:${axis}`);
    this.dirty.set(true);
  }

  protected renameGroup(
    i: number,
    axis: 'row' | 'col',
    key: string,
    en: string | null,
    ar: string | null,
  ): void {
    this.setGroupsOf(
      i,
      axis,
      this.groupsOf(i, axis).map((g) =>
        g.key === key ? { ...g, labelEn: en ?? g.labelEn, labelAr: ar ?? g.labelAr } : g,
      ),
    );
  }

  protected addGroup(i: number, axis: 'row' | 'col'): void {
    const groups = this.groupsOf(i, axis);
    const taken = new Set(groups.map((g) => g.key));
    let n = groups.length + 1;
    // Never re-used: a key is a figures row or slot, and a recycled one would hand a new
    // group the figures of a removed one.
    while (taken.has(`g${n}`)) n += 1;
    this.setGroupsOf(i, axis, [
      ...groups,
      { key: `g${n}`, labelEn: `Group ${n}`, labelAr: `المجموعة ${n}` },
    ]);
  }

  /** A row table keeps one group at least; a column split needs two. */
  protected canRemoveGroup(i: number, axis: 'row' | 'col'): boolean {
    return this.groupsOf(i, axis).length > (axis === 'row' ? 1 : 2);
  }

  protected removeGroup(i: number, axis: 'row' | 'col', key: string): void {
    const fact = this.axisFact(i, axis);
    this.setGroupsOf(
      i,
      axis,
      this.groupsOf(i, axis).filter((g) => g.key !== key),
    );
    const mine = { ...(this.placements()[fact] ?? {}) };
    for (const [code, group] of Object.entries(mine)) if (group === key) delete mine[code];
    this.placements.set({ ...this.placements(), [fact]: mine });
    if (axis === 'row') {
      // Its figures go with it.
      const next = { ...this.figures() };
      for (const slot of this.waySlots(i)) {
        const rows = next[slot]?.keyTable;
        if (rows) next[slot] = { ...next[slot], keyTable: rows.filter((r) => r.key !== key) };
      }
      this.figures.set(next);
    }
  }

  /** The name in the reading language, else the other one. */
  protected groupName(group: TemplateGroup): string {
    const mine = (this.isAr ? group.labelAr : group.labelEn).trim();
    return mine || (this.isAr ? group.labelEn : group.labelAr).trim();
  }

  protected groupNameLabel(index: number): string {
    return $localize`:@@spt.groups.name_aria:Name of group ${index + 1}:N:`;
  }

  /** Per list (fact key): answer code → this product's group key, as on screen (held until Save). */
  private readonly placements = signal<Record<string, Record<string, string>>>({});
  /** Per list: answer code → list row id, for the save. */
  private readonly valueIds = signal<Record<string, Record<string, string>>>({});
  /** Per list: where each answer is priced today — this product's own over the shared list. */
  private readonly pricedIn = signal<Record<string, Record<string, string>>>({});

  /** The answers of a grouped list, as the board lists them — one array per list. */
  private readonly answerCache = new Map<string, { from: unknown; rows: BoardAnswer[] }>();
  protected boardAnswers(fact: string): readonly BoardAnswer[] {
    const options = this.optionsOf(fact);
    const hit = this.answerCache.get(fact);
    if (hit && hit.from === options) return hit.rows;
    const rows = options.map((o) => ({ code: o.code, label: this.optionLabel(o) }));
    this.answerCache.set(fact, { from: options, rows });
    return rows;
  }

  private readonly emptyPlacements: Record<string, string> = {};
  protected placementsFor(fact: string): Record<string, string> {
    return this.placements()[fact] ?? this.emptyPlacements;
  }

  protected placementOf(fact: string, code: string): string {
    return this.placements()[fact]?.[code] ?? '';
  }

  protected place(fact: string, code: string, groupKey: string): void {
    const mine = { ...(this.placements()[fact] ?? {}) };
    if (groupKey === '') delete mine[code];
    else mine[code] = groupKey;
    this.placements.set({ ...this.placements(), [fact]: mine });
    this.dirty.set(true);
  }

  private listTypeOf(key: string): string | null {
    return this.facts().find((f) => f.key === key)?.question?.optionsEnumerationType ?? null;
  }

  /** The list's row ids and where each answer is priced today, read once per list. */
  private async ensureList(fact: string): Promise<void> {
    if (this.valueIds()[fact] !== undefined) return;
    const type = this.listTypeOf(fact);
    if (type === null) return;
    const [own, rows] = await Promise.all([
      this.lookups.productGroups(this.key, type),
      this.lookups.list(type),
    ]);
    this.valueIds.set({
      ...this.valueIds(),
      [fact]: Object.fromEntries(rows.map((r) => [r.key, r.id])),
    });
    const priced: Record<string, string> = {};
    for (const r of rows) {
      const at = own[r.key] ?? r.parentKey;
      if (at) priced[r.key] = at;
    }
    this.pricedIn.set({ ...this.pricedIn(), [fact]: priced });
  }

  /** Every way and column that is per group, as (way, axis). */
  private groupedAxes(): Array<{ i: number; axis: 'row' | 'col' }> {
    const out: Array<{ i: number; axis: 'row' | 'col' }> = [];
    for (const i of this.wayIndexes()) {
      if (this.wayKind(i) === 'classTable' && this.rowGroups(i) !== null)
        out.push({ i, axis: 'row' });
      if (this.wayColumn(i)?.groups !== undefined) out.push({ i, axis: 'col' });
    }
    return out;
  }

  /**
   * After a load: a per-group way or column still on a SHARED list's groups is shown as this
   * product's own — same keys, same names, each answer where it is priced today — so it can
   * be edited here. Nothing is written until Save, and Save writes the same figures.
   */
  private async loadPlacements(): Promise<void> {
    await this.enums.load('surrogate_fact');
    for (const i of this.wayIndexes()) {
      const fact = this.wayFactValue(i);
      const shared = this.factOf(fact)?.question?.parentOptions ?? [];
      if (this.wayKind(i) === 'classTable' && this.rowGroups(i) === null && shared.length > 0) {
        const groups = shared.map((o) => ({ key: o.code, labelEn: o.labelEn, labelAr: o.labelAr }));
        if (i === 0) this.form.controls.primaryGroups.setValue(groups, { emitEvent: false });
        else this.alternatives.at(i - 1)?.controls.groups.setValue(groups, { emitEvent: false });
      }
      const col = this.wayColumn(i);
      if (col && col.branchOn === 'parentClass' && col.groups === undefined) {
        const options = this.factOf(col.fact)?.question?.parentOptions ?? [];
        const groups = col.branches.map((b) => {
          const o = options.find((x) => x.code === b);
          return { key: b, labelEn: o?.labelEn ?? b, labelAr: o?.labelAr ?? b };
        });
        const next = { ...col, groups };
        if (i === 0) this.form.controls.primaryColumn.setValue(next, { emitEvent: false });
        else this.alternatives.at(i - 1)?.controls.column.setValue(next, { emitEvent: false });
      }
    }
    this.formRev.update((n) => n + 1);
    const placements: Record<string, Record<string, string>> = {};
    for (const { i, axis } of this.groupedAxes()) {
      const fact = this.axisFact(i, axis);
      await this.ensureList(fact);
      const keys = new Set(this.groupsOf(i, axis).map((g) => g.key));
      placements[fact] = Object.fromEntries(
        Object.entries(this.pricedIn()[fact] ?? {}).filter(([, g]) => keys.has(g)),
      );
    }
    this.placements.set(placements);
  }

  /** Every answer of each grouped list: its group, or none (back to the shared list). */
  private async savePlacements(): Promise<void> {
    const assignments: Array<{ valueId: string; parentKey: string | null }> = [];
    const done = new Set<string>();
    for (const { i, axis } of this.groupedAxes()) {
      const fact = this.axisFact(i, axis);
      if (done.has(fact)) continue;
      done.add(fact);
      await this.ensureList(fact);
      const ids = this.valueIds()[fact] ?? {};
      const placed = this.placements()[fact] ?? {};
      for (const o of this.optionsOf(fact)) {
        const id = ids[o.code];
        if (id !== undefined) assignments.push({ valueId: id, parentKey: placed[o.code] ?? null });
      }
    }
    if (assignments.length > 0) await this.lookups.setProductGroups(this.key, assignments);
  }

  // --- the ways ----------------------------------------------------------------

  /**
   * The slot ids one way's figures hang off — the same names the server's compiler gives
   * (`waySlot`, `columnSlot`, `wayPickSlot`), so each way's editor shows only its own boxes.
   */
  private readonly slotSets = computed<ReadonlySet<string>[]>(() =>
    this.wayIndexes().map((i) => {
      const kind = this.wayKind(i);
      const fact = this.wayFactValue(i);
      const head =
        i === 0 ? 'primary' : i === 1 ? 'alt' : `alt__${kind === 'flatAmount' ? 'flat' : fact}`;
      const column = this.wayColumn(i);
      if (column === null) return new Set([head]);
      const pick = i === 0 ? 'primary_pick' : i === 1 ? 'alt_pick' : `${head}_pick`;
      return new Set([
        head,
        pick,
        ...column.branches.slice(1).map((branch) => `${head}__${branch}`),
      ]);
    }),
  );

  protected waySlots(i: number): ReadonlySet<string> {
    return this.slotSets()[i] ?? new Set<string>();
  }

  protected wayHasSteps(i: number): boolean {
    const slots = this.waySlots(i);
    return this.compiledSteps().some((s) => slots.has(s.id));
  }

  /** A way whose question is picked (or that needs none) has figures to fill in. */
  protected wayReady(i: number): boolean {
    const fact = this.wayFactValue(i);
    return fact !== '';
  }

  /** The card's first line: what the way reads. */
  protected wayTitle(i: number): string {
    const fact = this.wayFactValue(i);
    if (fact === '') return $localize`:@@spt.v2.way_unset:Not set up yet`;
    if (fact === '__flat__') return $localize`:@@spt.v2.way_flat:The same amount for everyone`;
    return this.factLabel(fact);
  }

  /** The card's second line: how it reads it, and what splits it. */
  protected waySub(i: number): string | null {
    if (this.wayFactValue(i) === '' || this.wayFactValue(i) === '__flat__') return null;
    const how = WAY_HOW[this.wayKind(i)]?.() ?? '';
    const column = this.wayColumn(i);
    if (column === null) return how;
    const name = this.factLabel(column.fact);
    return $localize`:@@spt.v2.way_how_split:${how}:HOW: · different amounts by ${name}:NAME:`;
  }

  /** Ways may be added and removed, never reordered: their slot ids are positional. */
  protected addWay(): void {
    if (!this.canAddWay()) return;
    this.alternatives.push(this.wayGroup());
    this.openWay.set(this.alternatives.length);
  }

  protected removeWay(index: number): void {
    this.alternatives.removeAt(index);
    this.openWay.set(0);
  }

  protected canAddWay(): boolean {
    return this.alternatives.length < MAX_ALTERNATIVES;
  }

  protected wayRemoveLabel(index: number): string {
    const n = index + 2;
    return $localize`:@@spt.addon.alt.remove_aria:Remove way ${n}:index:`;
  }

  /** Each bank picks one, or every bank uses all of them and the lowest wins. */
  protected setWaysMode(mode: 'exclusive' | 'combined'): void {
    this.form.controls.waysAre.setValue(mode);
    if (mode === 'combined' || this.form.controls.combine.value === '') {
      this.form.controls.combine.setValue('lower');
    }
  }

  protected readonly shareOn = signal(false);

  /** Whether "More options" states anything — it opens itself when it does. */
  protected hasExtras(): boolean {
    const v = this.form.getRawValue();
    return v.useUplift || v.iScore || v.shareFact !== '' || v.alternatives.length > 0;
  }

  protected upliftOptions(): ReadonlyArray<{ code: string; labelAr: string; labelEn: string }> {
    return this.optionsOf(this.form.controls.upliftFact.value);
  }

  protected optionLabel(option: { labelAr: string; labelEn: string }): string {
    return this.isAr ? option.labelAr : option.labelEn;
  }

  // --- who can't get it ----------------------------------------------------------

  private conditionGroup(seed: {
    id: string;
    measure: string;
    op: ConditionOp;
    otherFact: string;
    expect: string[];
    reasonCode: GateReasonCode;
  }) {
    return this.fb.nonNullable.group({
      // Never edited. It is a stepParams key, so renaming it orphans whatever figure a bank
      // has entered against it.
      id: this.fb.nonNullable.control(seed.id),
      measure: this.fb.nonNullable.control(seed.measure, Validators.required),
      op: this.fb.nonNullable.control<ConditionOp>(seed.op),
      otherFact: this.fb.nonNullable.control(seed.otherFact),
      /** `oneOf` only: the answers that may have it — every other answer is turned away. */
      expect: this.fb.nonNullable.control<string[]>(seed.expect),
      reasonCode: this.fb.nonNullable.control<GateReasonCode>(seed.reasonCode),
    });
  }

  protected addCondition(): void {
    const taken = new Set(this.conditions.controls.map((c) => c.getRawValue().id));
    let n = this.conditions.length + 1;
    // Never re-used, even after a delete: an id is a figures key.
    while (taken.has(`c${n}`)) n += 1;
    const first = this.numericFacts()[0]?.key ?? '__answer__';
    this.conditions.push(
      this.conditionGroup({
        id: `c${n}`,
        measure: first,
        op: 'atLeast',
        otherFact: '',
        expect: [],
        reasonCode: 'GATE_NOT_MET',
      }),
    );
  }

  protected removeCondition(index: number): void {
    this.conditions.removeAt(index);
  }

  /** A choice is turned away by answer; anything else by a figure. */
  protected setMeasure(index: number, measure: string): void {
    const row = this.conditions.at(index);
    if (!row) return;
    const isChoice = this.factOf(measure)?.question?.type === 'SINGLE_SELECT';
    if (isChoice) {
      this.updateFigure(`cond__${row.controls.id.value}`, (f) => ({ ...f, applies: true }));
    }
    const op: ConditionOp = isChoice
      ? 'oneOf'
      : row.controls.op.value === 'oneOf'
        ? 'atLeast'
        : row.controls.op.value;
    row.patchValue({
      measure,
      op,
      otherFact: this.defaultOther(op, measure),
      expect: isChoice ? this.optionsOf(measure).map((o) => o.code) : [],
    });
  }

  /**
   * The second answer a test needs, picked so a rule is never left half-stated: "a % of" the
   * first OTHER number (a price, preferably), "depends on" the first choice.
   */
  private defaultOther(op: ConditionOp, measure: string): string {
    if (op === 'atLeastShareOf') {
      const others = this.numericFacts().filter((f) => f.key !== measure);
      return (others.find((f) => /price|سعر/i.test(f.label)) ?? others[0])?.key ?? '';
    }
    if (op === 'atLeastPerAnswer' || op === 'atMostPerAnswer') {
      return this.choiceFacts()[0]?.key ?? '';
    }
    return '';
  }

  protected opsFor(measure: string): readonly ConditionOp[] {
    const base: ConditionOp[] = ['atLeast', 'atMost', 'between', 'atLeastShareOf'];
    if (measure === '__answer__') return ['atLeast', 'atMost', 'between'];
    return [...base, 'atLeastPerAnswer', 'atMostPerAnswer'];
  }

  protected ruleOpLabel(op: ConditionOp): string {
    return RULE_OP_LABELS[op]();
  }

  protected toggleTurnedAway(index: number, code: string): void {
    const row = this.conditions.at(index);
    if (!row) return;
    const allowed = row.controls.expect.value;
    row.controls.expect.setValue(
      allowed.includes(code) ? allowed.filter((c) => c !== code) : [...allowed, code],
    );
  }

  private updateFigure(id: string, change: (f: StepFigures) => StepFigures): void {
    const next = { ...this.figures() };
    const updated = change({ ...(next[id] ?? {}) });
    if (Object.keys(updated).length === 0) delete next[id];
    else next[id] = updated;
    this.figures.set(next);
    this.dirty.set(true);
  }

  protected ruleFigure(id: string, field: 'minValue' | 'maxValue'): string {
    return groupDigits(this.figures()[`cond__${id}`]?.[field] ?? '');
  }

  protected setRuleFigure(id: string, field: 'minValue' | 'maxValue', raw: string): void {
    const value = raw.replace(/,/g, '').trim();
    this.updateFigure(`cond__${id}`, (f) => {
      if (value === '') delete f[field];
      else f[field] = value;
      return f;
    });
  }

  protected ruleShare(id: string): string {
    return this.figures()[`cond__${id}__bound`]?.scalar?.value ?? '';
  }

  protected setRuleShare(id: string, raw: string): void {
    const value = raw.replace(/,/g, '').trim();
    this.updateFigure(`cond__${id}__bound`, (f) => {
      if (value === '') delete f.scalar;
      else f.scalar = { value, unit: 'percent' };
      return f;
    });
  }

  /**
   * Whether a rule turns anyone away today. A rule on answers is on when it is switched on; a
   * rule on a number is on once its number is typed; a per-answer rule is each bank's.
   */
  protected ruleState(row: {
    id?: string;
    op?: ConditionOp;
  }): 'on' | 'offChoice' | 'offNumber' | 'bank' {
    const id = row.id ?? '';
    const f = this.figures()[`cond__${id}`];
    switch (row.op) {
      case 'oneOf':
        return f?.applies === true ? 'on' : 'offChoice';
      case 'atLeast':
        return (f?.minValue ?? '') !== '' ? 'on' : 'offNumber';
      case 'atMost':
        return (f?.maxValue ?? '') !== '' ? 'on' : 'offNumber';
      case 'between':
        return (f?.minValue ?? '') !== '' || (f?.maxValue ?? '') !== '' ? 'on' : 'offNumber';
      case 'atLeastShareOf':
        return (this.figures()[`cond__${id}__bound`]?.scalar?.value ?? '') !== ''
          ? 'on'
          : 'offNumber';
      default:
        return 'bank';
    }
  }

  /** A choice rule applies only where it is switched on; the catalog's default is this switch. */
  protected ruleApplies(id: string): boolean {
    return this.figures()[`cond__${id}`]?.applies === true;
  }

  protected setRuleApplies(id: string): void {
    const on = !this.ruleApplies(id);
    this.updateFigure(`cond__${id}`, (f) => {
      if (on) f.applies = true;
      else delete f.applies;
      return f;
    });
  }

  /**
   * The gate reason, in the words the CUSTOMER will read — the same dictionary the app
   * renders it from. Filed `GATE_`-prefixed, except `GATE_NOT_MET`, whose name carries it.
   */
  protected reasonLabel(code: GateReasonCode): string {
    const key = code.startsWith('GATE_') ? code : `GATE_${code}`;
    return this.errors.toLocalizedMessage(key as ErrorCode);
  }

  // --- the plain figure tables (v36.2.0) --------------------------------------

  protected readonly fromAria = $localize`:@@spt.v2.from_col:From`;
  protected readonly toAria = $localize`:@@spt.v2.to_col:Up to`;
  protected readonly fmt = groupDigits;

  protected amountWord(): string {
    return this.form.controls.outputKind.value === 'maxAmount'
      ? $localize`:@@spt.v2.limit:Most they can borrow`
      : $localize`:@@spt.v2.income:Monthly income`;
  }

  protected figShape(i: number): 'table' | 'ranges' | 'scalar' | 'flat' {
    const kind = this.wayKind(i);
    if (kind === 'flatAmount') return 'flat';
    if (kind === 'numberBand') return 'ranges';
    if (kind === 'choiceTable' || kind === 'classTable') return 'table';
    return 'scalar';
  }

  private headOf(i: number): string {
    const kind = this.wayKind(i);
    return i === 0
      ? 'primary'
      : i === 1
        ? 'alt'
        : `alt__${kind === 'flatAmount' ? 'flat' : this.wayFactValue(i)}`;
  }

  /** One amount column per column of the way (or one), each with the slot its figure goes in. */
  protected colsOf(i: number): ReadonlyArray<{ slot: string; label: string }> {
    const head = this.headOf(i);
    const column = this.wayColumn(i);
    if (column === null) return [{ slot: head, label: this.amountWord() }];
    return column.branches.map((branch, index) => ({
      slot: index === 0 ? head : `${head}__${branch}`,
      label: this.branchLabel(column, branch),
    }));
  }

  private branchLabel(column: TemplateColumn, branch: string): string {
    const own = column.groups?.find((g) => g.key === branch);
    if (own) return this.groupName(own);
    if (column.branchOn === 'parentClass') {
      const cls = this.factOf(column.fact)?.question?.parentOptions.find((o) => o.code === branch);
      if (cls) return this.optionLabel(cls);
    }
    const option = this.optionsOf(column.fact).find((o) => o.code === branch);
    return option ? this.optionLabel(option) : branch;
  }

  protected rowHeader(i: number): string {
    return this.wayKind(i) === 'classTable'
      ? $localize`:@@spt.v2.group_col:Group`
      : this.factLabel(this.wayFactValue(i));
  }

  protected rowsOf(i: number): ReadonlyArray<{ key: string; label: string }> {
    const fact = this.wayFactValue(i);
    if (this.wayKind(i) === 'classTable') {
      const own = this.rowGroups(i);
      if (own !== null) return own.map((g) => ({ key: g.key, label: this.groupName(g) }));
      return (this.factOf(fact)?.question?.parentOptions ?? []).map((o) => ({
        key: o.code,
        label: this.optionLabel(o),
      }));
    }
    return this.optionsOf(fact).map((o) => ({ key: o.code, label: this.optionLabel(o) }));
  }

  protected cell(slot: string, key: string): string {
    return groupDigits(this.figures()[slot]?.keyTable?.find((r) => r.key === key)?.incomeEGP ?? '');
  }

  protected setCell(slot: string, key: string, raw: string): void {
    const value = raw.replace(/,/g, '').trim();
    this.updateFigure(slot, (f) => {
      const rows = [...(f.keyTable ?? [])];
      const at = rows.findIndex((r) => r.key === key);
      if (at === -1) rows.push({ key, incomeEGP: value });
      else rows[at] = { ...rows[at]!, incomeEGP: value };
      f.keyTable = rows;
      return f;
    });
  }

  /** The ranges, read off the first column; every column shares them. */
  protected rangesOf(i: number): readonly IncomeBand[] {
    return this.figures()[this.headOf(i)]?.bands ?? [];
  }

  /** Every column of the way carries the same ranges: an edge typed once moves in all of them. */
  private eachColumnBands(
    i: number,
    change: (bands: IncomeBand[], slot: string) => IncomeBand[],
  ): void {
    const edges = this.rangesOf(i);
    const next = { ...this.figures() };
    for (const { slot } of this.colsOf(i)) {
      const own = next[slot]?.bands ?? [];
      const aligned: IncomeBand[] = edges.map((e, k) => ({
        fromInclusive: e.fromInclusive,
        toExclusive: e.toExclusive,
        incomeEGP: own[k]?.incomeEGP ?? '',
      }));
      next[slot] = { ...(next[slot] ?? {}), bands: change(aligned, slot) };
    }
    this.figures.set(next);
    this.dirty.set(true);
  }

  protected setEdge(
    i: number,
    index: number,
    edge: 'fromInclusive' | 'toExclusive',
    raw: string,
  ): void {
    const value = raw.replace(/,/g, '').trim();
    this.eachColumnBands(i, (bands) =>
      bands.map((b, k) =>
        k === index ? { ...b, [edge]: edge === 'toExclusive' && value === '' ? null : value } : b,
      ),
    );
  }

  protected bandAmount(slot: string, index: number): string {
    return groupDigits(this.figures()[slot]?.bands?.[index]?.incomeEGP ?? '');
  }

  protected setBandAmount(i: number, slot: string, index: number, raw: string): void {
    const value = raw.replace(/,/g, '').trim();
    this.eachColumnBands(i, (bands, s) =>
      s === slot ? bands.map((b, k) => (k === index ? { ...b, incomeEGP: value } : b)) : bands,
    );
  }

  protected addRange(i: number): void {
    const last = this.rangesOf(i).at(-1);
    const head = this.headOf(i);
    const start = last?.toExclusive ?? '';
    this.updateFigure(head, (f) => {
      f.bands = [...(f.bands ?? []), { fromInclusive: start, toExclusive: null, incomeEGP: '' }];
      return f;
    });
    this.eachColumnBands(i, (bands) => bands);
  }

  protected removeRange(i: number, index: number): void {
    this.eachColumnBands(i, (bands) => bands.filter((_, k) => k !== index));
  }

  protected scalarSign(i: number): string {
    return this.wayKind(i) === 'dividedBy' ? '÷' : '×';
  }

  protected scalarOf(slot: string): string {
    return groupDigits(this.figures()[slot]?.scalar?.value ?? '');
  }

  protected setScalar(i: number, slot: string, raw: string): void {
    const value = raw.replace(/,/g, '').trim();
    const unit = this.wayKind(i) === 'shareOf' ? 'percent' : 'multiplier';
    this.updateFigure(slot, (f) => {
      if (value === '') delete f.scalar;
      else f.scalar = { value, unit };
      return f;
    });
  }

  protected flatOf(i: number): string {
    return groupDigits(this.figures()[this.headOf(i)]?.valueEGP ?? '');
  }

  protected setFlat(i: number, raw: string): void {
    const value = raw.replace(/,/g, '').trim();
    this.updateFigure(this.headOf(i), (f) => {
      if (value === '') delete f.valueEGP;
      else f.valueEGP = value;
      return f;
    });
  }

  // --- figures -----------------------------------------------------------------

  protected onFigures(figures: Record<string, StepFigures>): void {
    this.figures.set(figures);
  }

  protected markFiguresDirty(): void {
    this.dirty.set(true);
  }

  // --- save / load ---------------------------------------------------------------

  /** What refuses a save on this form, or `null` — checked before a preview too. */
  private localBlock(): string | null {
    const ways = this.wayIndexes();
    const unnamed = ways.find((i) => this.wayFactValue(i) === '');
    if (unnamed !== undefined) {
      return unnamed === 0
        ? $localize`:@@spt.form.block_fact:Choose which answer the calculation reads.`
        : $localize`:@@spt.form.block_alt_fact:Choose which answer way ${unnamed + 1}:index: reads.`;
    }
    const seen = new Set<string>();
    for (const i of ways) {
      const kind = this.wayKind(i);
      const id = `${kind}|${MECHANISM_FACT_TYPE[kind] === null ? '' : this.wayFactValue(i)}`;
      if (seen.has(id)) {
        return $localize`:@@spt.form.block_alt_duplicate:Two ways read the same answer the same way. Remove one, or change what it reads.`;
      }
      seen.add(id);
    }
    for (const i of ways) {
      const column = this.wayColumn(i);
      if (column === null) continue;
      if (column.groups !== undefined) {
        if (column.groups.length < 2) {
          return $localize`:@@spt.form.block_groups:Add at least two groups.`;
        }
        if (column.groups.some((g) => g.labelEn.trim() === '' || g.labelAr.trim() === '')) {
          return $localize`:@@spt.form.block_group_names:Give every group a name in English and Arabic.`;
        }
      } else if (column.branches.length < 2) {
        return $localize`:@@spt.form.block_columns:A second column needs at least two answers picked.`;
      }
    }
    for (const [k, control] of this.conditions.controls.entries()) {
      const c = control.getRawValue();
      const n = k + 1;
      if (c.measure === '') return $localize`:@@ps.block_rule_q:Rule ${n}:N: — pick a question.`;
      if (c.op === 'atLeastShareOf' && c.otherFact === '') {
        return $localize`:@@ps.block_rule_pct:Rule ${n}:N: — pick the answer it is a % of.`;
      }
      if ((c.op === 'atLeastPerAnswer' || c.op === 'atMostPerAnswer') && c.otherFact === '') {
        return $localize`:@@ps.block_rule_per:Rule ${n}:N: — pick what the figure depends on.`;
      }
      if (c.op === 'oneOf' && this.optionsOf(c.measure).length === 0) {
        return $localize`:@@ps.block_rule_q:Rule ${n}:N: — pick a question.`;
      }
    }
    for (const i of ways) {
      const groups = this.wayKind(i) === 'classTable' ? this.rowGroups(i) : null;
      if (groups === null) continue;
      if (groups.length === 0) return $localize`:@@ps.block_no_group:Add at least one group.`;
      if (groups.some((g) => g.labelEn.trim() === '' || g.labelAr.trim() === '')) {
        return $localize`:@@spt.form.block_group_names:Give every group a name in English and Arabic.`;
      }
    }
    const v = this.form.getRawValue();
    if (v.useUplift && (!v.upliftWhen || !v.upliftOtherwise)) {
      return $localize`:@@spt.form.block_uplift:Say which answer earns the bonus and which does not.`;
    }
    if (v.useUplift && v.upliftWhen === v.upliftOtherwise) {
      return $localize`:@@spt.form.block_uplift_same:The two bonus answers have to be different.`;
    }
    return null;
  }

  /** Why Save is refused, in the operator's words. */
  protected blockReason(): string | null {
    if (this.saveError()) return this.saveError();
    if (this.advanced())
      return $localize`:@@spt.form.block_advanced:This calculation was built by hand, so there is no form to save.`;
    return this.localBlock();
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
        stepParams: cleanFigures(this.figures()),
      });
      // Where each answer is filed, for this product only: after the template, which is what
      // makes the group keys this product's own.
      if (this.groupedAxes().length > 0) await this.savePlacements();
      this.absorb(res.data.template, res.data.incomeRule);
      await this.loadPlacements();
      this.figures.set(this.withEveryRow(this.figures(), this.wayIndexes()));
      this.dirty.set(false);
      this.saved.emit();
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
   * Fields of the stored form this screen does NOT ask about, carried across a save — dropping
   * them would be silent: `blueprintKey` makes the form reopen as this product's own.
   */
  private readonly storedExtras = signal<{
    blueprintKey?: string;
    share?: NonNullable<ProductTemplate['share']>;
  }>({});

  /** The form, as the shape the server compiles. */
  private toTemplate(): ProductTemplate {
    const v = this.form.getRawValue();
    const extras = this.storedExtras();
    const single = v.alternatives.length === 0;
    const mechanism = (
      kind: TemplateMechanismKind,
      fact: string,
      column?: TemplateColumn | null,
      groups?: TemplateGroup[] | null,
      methodKey?: string,
    ): TemplateMechanism => ({
      ...(kind === 'flatAmount' ? { kind } : ({ kind, fact } as TemplateMechanism)),
      ...(kind === 'classTable' && groups ? { groups } : {}),
      ...(column ? { column } : {}),
      ...(methodKey ? { methodKey } : {}),
    });

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
              ? ({
                  op: 'oneOf',
                  expect:
                    c.expect.length > 0
                      ? [...c.expect]
                      : this.optionsOf(c.measure).map((o) => o.code),
                } as const)
              : ({ op: c.op } as const);
      return { id: c.id, measure, test, reasonCode: c.reasonCode };
    });

    const share =
      v.shareFact === ''
        ? undefined
        : extras.share !== undefined && extras.share.fact === v.shareFact
          ? extras.share
          : ({ kind: 'statedPercent', fact: v.shareFact, scope: 'income' } as NonNullable<
              ProductTemplate['share']
            >);

    return {
      version: 1,
      outputKind: v.outputKind,
      ...(v.outputKind === 'maxAmount' && v.baselineDbrPercent
        ? { baselineDbrPercent: v.baselineDbrPercent }
        : {}),
      // ONE way: its split is stated on the product, which is how every one-way product was
      // stored and compiles to the very same steps. Several: each way carries its own.
      primary: mechanism(
        v.primaryKind,
        v.primaryFact,
        single ? null : v.primaryColumn,
        v.primaryGroups,
        v.primaryMethod,
      ),
      ...(single && v.primaryColumn ? { secondColumn: v.primaryColumn } : {}),
      ...(!single
        ? {
            alternatives: v.alternatives.map((way) =>
              mechanism(way.kind, way.fact, way.column, way.groups, way.method),
            ),
          }
        : {}),
      ...(!single && v.combine ? { combine: v.combine } : {}),
      ...(!single ? { waysAre: v.waysAre } : {}),
      ...(v.useUplift && v.upliftWhen && v.upliftOtherwise
        ? {
            uplift: {
              fact: v.upliftFact,
              whenOption: v.upliftWhen,
              otherwiseOption: v.upliftOtherwise,
              scope: v.upliftScope,
            },
          }
        : {}),
      ...(share !== undefined ? { share } : {}),
      ...(v.iScore ? { iScore: true } : {}),
      ...(extras.blueprintKey !== undefined ? { blueprintKey: extras.blueprintKey } : {}),
      conditions,
    };
  }

  /** The product page's Save bar: save if there is anything to save, and say whether it landed. */
  async saveNow(): Promise<boolean> {
    if (!this.dirty()) return true;
    if (!this.form.valid || this.blockReason() !== null) return false;
    await this.doSave();
    return !this.dirty() && this.saveError() === null;
  }

  /** Throw away unsaved answers by re-reading what is stored. */
  async discard(): Promise<void> {
    this.saveError.set(null);
    await this.load();
  }

  /** What refuses a save right now, or `null`. */
  saveBlockReason(): string | null {
    if (!this.dirty()) return null;
    return this.form.valid ? this.blockReason() : (this.blockReason() ?? this.invalidLabel);
  }
  private readonly invalidLabel = $localize`:@@spt.embed_invalid:Some answers on the calculation step are missing.`;

  private async load(): Promise<void> {
    this.loading.set(true);
    try {
      const res = await this.api.getSurrogateProductTemplate(this.key);
      this.advanced.set(res.data.advanced);
      this.absorb(res.data.template, res.data.compiled);
      await this.loadPlacements();
      this.figures.set(this.withEveryRow(this.figures(), this.wayIndexes()));
      const fromLibrary = res.data.template?.blueprintKey;
      if (fromLibrary !== undefined) void this.loadBlueprint(fromLibrary);
    } finally {
      this.loading.set(false);
      this.dirty.set(false);
    }
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
      this.form.controls.primaryGroups.setValue(null, { emitEvent: false });
      this.form.controls.primaryMethod.setValue('', { emitEvent: false });
      this.storedExtras.set({});
      this.blueprint.set(null);
      return;
    }

    this.storedExtras.set({
      ...(template.blueprintKey !== undefined ? { blueprintKey: template.blueprintKey } : {}),
      ...(template.share !== undefined ? { share: template.share } : {}),
    });

    // A product-wide split reaches every way — the same steps as each way carrying it.
    const productColumn = template.secondColumn ?? null;
    const ways =
      template.alternatives ?? (template.alternative === undefined ? [] : [template.alternative]);
    this.alternatives.clear({ emitEvent: false });
    for (const way of ways) {
      this.alternatives.push(
        this.wayGroup(
          way.kind,
          way.kind === 'flatAmount' ? '' : way.fact,
          way.column ?? productColumn,
          way.kind === 'classTable' ? (way.groups ?? null) : null,
          way.methodKey ?? '',
        ),
        { emitEvent: false },
      );
    }

    this.conditions.clear({ emitEvent: false });
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
          expect: condition.test.op === 'oneOf' ? [...condition.test.expect] : [],
          reasonCode: condition.reasonCode,
        }),
        { emitEvent: false },
      );
    }

    this.form.patchValue(
      {
        outputKind: template.outputKind,
        baselineDbrPercent: template.baselineDbrPercent ?? '',
        primaryKind: template.primary.kind,
        primaryFact: template.primary.kind === 'flatAmount' ? '' : template.primary.fact,
        primaryColumn: template.primary.column ?? productColumn,
        primaryGroups:
          template.primary.kind === 'classTable' ? (template.primary.groups ?? null) : null,
        primaryMethod: template.primary.methodKey ?? '',
        combine: template.combine ?? '',
        waysAre: template.waysAre ?? 'exclusive',
        shareFact: template.share?.fact ?? '',
        useUplift: template.uplift !== undefined,
        upliftFact: template.uplift?.fact ?? '',
        upliftWhen: template.uplift?.whenOption ?? '',
        upliftOtherwise: template.uplift?.otherwiseOption ?? '',
        // Absent reads as income, which is what every form stored before the field compiled to.
        upliftScope: template.uplift?.scope ?? 'income',
        iScore: template.iScore === true,
      },
      { emitEvent: false },
    );
    this.formRev.update((n) => n + 1);
  }

  // --- the one-page layout (v37.0.0) -------------------------------------------

  protected readonly methodsAria = $localize`:@@ps.methods_aria:Methods`;
  protected readonly removeAria = $localize`:@@ps.remove:Remove`;
  protected readonly searchAria = $localize`:@@ps.search_q:Search questions…`;
  protected readonly bankSets = $localize`:@@ps.bank_sets:bank sets`;
  protected readonly andUp = $localize`:@@ps.and_up:and up`;
  protected readonly shareAria = $localize`:@@ps.share_q:Which answer is the share`;
  protected readonly questionAria = $localize`:@@ps.question:Question`;
  protected readonly ruleAria = $localize`:@@ps.rule:Rule`;
  protected readonly tellAria = $localize`:@@ps.tell:What the customer is told`;

  /** The method on screen — never past the last one. */
  protected shownWay(): number {
    const n = this.wayCount();
    return Math.min(Math.max(this.openWay(), 0), n - 1);
  }

  protected methodLabel(i: number): string {
    const n = i + 1;
    return $localize`:@@ps.method_n:Method ${n}:N:`;
  }

  protected removeMethodLabel(i: number): string {
    const n = i + 1;
    return $localize`:@@ps.remove_method:Remove method ${n}:N:`;
  }

  /** Which method's question picker is open, or null. */
  protected readonly pickerFor = signal<number | null>(null);
  protected readonly pickerQuery = signal('');

  protected togglePicker(i: number): void {
    this.pickerFor.set(this.pickerFor() === i ? null : i);
    this.pickerQuery.set('');
  }

  /** A click anywhere outside the open picker closes it. */
  @HostListener('document:click', ['$event'])
  protected onDocumentClick(event: MouseEvent): void {
    if (this.pickerFor() === null) return;
    // The path as it was when the click happened: a tick re-draws the list, so the button
    // clicked may already be gone from the page by the time the click reaches the document.
    const inPicker = event
      .composedPath()
      .some((el) => el instanceof HTMLElement && el.classList.contains('picker'));
    if (!inPicker) this.pickerFor.set(null);
  }

  protected val(event: Event): string {
    return (event.target as HTMLInputElement | HTMLSelectElement).value;
  }

  protected pickList(
    list: ReadonlyArray<{ key: string; label: string }>,
  ): ReadonlyArray<{ key: string; label: string }> {
    const q = this.pickerQuery().trim().toLowerCase();
    return q === '' ? list : list.filter((f) => f.label.toLowerCase().includes(q));
  }

  protected readonly fixedDeciders = computed(() =>
    this.decidingFacts()
      .filter((f) => this.isFixedFact(f))
      .map((f) => ({ key: f.key, label: f.label })),
  );

  protected readonly derivedDeciders = computed(() =>
    DERIVED_FACTS.map((d) => ({ key: d.key, label: d.label })),
  );

  /** Why a row of the picker can't be ticked right now, in words, or null. */
  protected pickBlock(i: number, key: string): string | null {
    if (this.canPick(i, key)) return null;
    if (this.tickedCount(i) >= 2) return $localize`:@@ps.block_two:Untick one first — two at most`;
    if (this.firstPick(i) === '' && derivedFactByKey(key) !== undefined) {
      return $localize`:@@ps.block_derived:Tick a question above first — this one only adds columns`;
    }
    return $localize`:@@ps.block_numbers:Two numbers can't be used together`;
  }

  /** The ready method method i is linked to, or ''. */
  protected linkedKey(i: number): string {
    this.formRev();
    return i === 0
      ? this.form.controls.primaryMethod.value
      : (this.alternatives.at(i - 1)?.controls.method.value ?? '');
  }

  private setLinked(i: number, key: string): void {
    if (i === 0) this.form.controls.primaryMethod.setValue(key);
    else this.alternatives.at(i - 1)?.controls.method.setValue(key);
  }

  /** "Which compound is your unit in? · One amount per group · columns by Topping up …". */
  protected linkedSummary(i: number): string {
    const parts = [this.shortLabel(this.wayFactValue(i)), WAY_HOW[this.wayKind(i)]?.() ?? ''];
    const column = this.wayColumn(i);
    if (column) {
      const name = this.shortLabel(column.fact);
      parts.push($localize`:@@rm.columns_by:columns by ${name}:NAME:`);
    }
    return parts.filter((x) => x !== '').join(' · ');
  }

  protected linkedName(i: number): string {
    const key = this.linkedKey(i);
    const m = this.methods().find((x) => x.key === key);
    return m ? this.methodLabel2(m) : key;
  }

  /** The box shows the ready method the way is linked to; picking another one replaces it. */
  protected pickMethod(i: number, key: string): void {
    if (key !== '' && key !== this.linkedKey(i)) this.useMethod(i, key);
  }

  protected readonly pickOne = $localize`:@@ps.pick_ready:Pick one…`;
  protected readonly methodAria = $localize`:@@ps.ready_method:Surrogate method`;
  protected readonly methodOpts = computed<SearchSelectOption[]>(() =>
    newestFirst(this.methods()).map((m) => ({ value: m.key, label: this.methodLabel2(m) })),
  );
  protected readonly numericOpts = computed<SearchSelectOption[]>(() =>
    this.numericFacts().map((f) => ({ value: f.key, label: f.label })),
  );

  protected methodLabel2(m: MethodTemplate): string {
    return (this.isAr ? m.labelAr : m.labelEn).trim() || m.labelEn;
  }

  /**
   * Copy a ready method into method i: its question(s), how, columns, groups and default
   * figures. A copy — later edits to the ready method never reach this product. Any question
   * it reads that the product does not ask yet is handed to the page to add.
   */
  protected useMethod(i: number, key: string): void {
    const m = this.methods().find((x) => x.key === key);
    if (!m || m.mechanism.kind === 'flatAmount') return;
    const mech = m.mechanism;
    this.writeWay(i, mech.kind, mech.fact);
    this.toSeed.add(i);
    const column = mech.column ? structuredClone(mech.column) : null;
    this.setWayColumn(i, column);
    this.setRowGroups(
      i,
      mech.kind === 'classTable' && mech.groups ? structuredClone(mech.groups) : null,
    );
    const head = this.headOf(i);
    const next = { ...this.figures() };
    for (const slot of Object.keys(next)) {
      if (slot === head || slot.startsWith(`${head}__`)) delete next[slot];
    }
    for (const [col, figure] of Object.entries(m.figures ?? {})) {
      next[col === '' ? head : `${head}__${col}`] = structuredClone(figure);
    }
    this.figures.set(next);
    this.dirty.set(true);
    // The method's own groups come with their members; a shared list's groups become this
    // product's own, the same keys (no figure moves).
    for (const [fact, list] of Object.entries(m.placements ?? {})) {
      this.placements.set({
        ...this.placements(),
        [fact]: Object.fromEntries(list.map((p) => [p.code, p.group])),
      });
      void this.ensureList(fact);
    }
    if (mech.kind === 'classTable' && !mech.groups) void this.seedGroups(i, 'row');
    if (column && column.branchOn === 'parentClass' && !column.groups) {
      void this.seedGroups(i, 'col');
    }
    const codes = [mech.fact, column?.fact]
      .filter((k): k is string => !!k && derivedFactByKey(k) === undefined)
      .map((k) => this.facts().find((f) => f.key === k)?.question?.code)
      .filter((c): c is string => !!c);
    if (codes.length > 0) this.asksNeeded.emit(codes);
    this.setLinked(i, m.key);
  }

  protected tickedCount(i: number): number {
    const first = this.wayFactValue(i);
    return (first !== '' && first !== '__flat__' ? 1 : 0) + (this.wayColumn(i) ? 1 : 0);
  }

  /** A worked-out answer's plain name, without the "(worked out by us)" note. */
  protected shortLabel(key: string): string {
    return derivedFactByKey(key)?.label ?? this.factLabel(key);
  }

  protected factKindLabel(key: string): string {
    if (this.isNumberFact(key)) return $localize`:@@ps.kind_number:Number`;
    const n = this.optionsOf(key).length;
    return $localize`:@@ps.kind_answers:${n}:N: answers`;
  }

  /** "Pay only the share they own": on picks the answer that reads as a share, else the first number. */
  protected toggleShare(): void {
    const control = this.form.controls.shareFact;
    if (control.value !== '') {
      control.setValue('');
      return;
    }
    const numbers = this.numericFacts();
    const share = numbers.find((f) => /%|percent|share|نسبة/i.test(f.label)) ?? numbers[0];
    if (share) control.setValue(share.key);
  }

  /** What a rule can be about: the product's answers, plus the one it already reads. */
  protected ruleFacts(current: string): ReadonlyArray<{ key: string; label: string }> {
    const list = this.decidingFacts().map((f) => ({ key: f.key, label: f.label }));
    if (current !== '' && !list.some((f) => f.key === current)) {
      list.unshift({
        key: current,
        label:
          current === '__answer__'
            ? $localize`:@@ps.the_amount:The amount we work out`
            : this.factLabel(current),
      });
    }
    return list;
  }

  protected setOp(index: number, op: string): void {
    const row = this.conditions.at(index);
    if (!row) return;
    row.patchValue({
      op: op as ConditionOp,
      otherFact: this.defaultOther(op as ConditionOp, row.controls.measure.value),
    });
  }

  protected setReason(index: number, code: string): void {
    this.conditions.at(index)?.controls.reasonCode.setValue(code as GateReasonCode);
  }

  /**
   * A question the product stops asking leaves the calculation too: out of every method (the
   * method empties, or its second question moves up), out of the rules, out of the share.
   */
  dropFact(key: string): void {
    for (const i of [...this.wayIndexes()].reverse()) {
      if (this.wayFactValue(i) === key || this.wayColumn(i)?.fact === key) this.setLinked(i, '');
      if (this.wayColumn(i)?.fact === key) this.setWayColumn(i, null);
      if (this.wayFactValue(i) === key) this.toggleDecider(i, key);
    }
    for (let k = this.conditions.length - 1; k >= 0; k -= 1) {
      const c = this.conditions.at(k)?.getRawValue();
      if (c && (c.measure === key || c.otherFact === key)) this.conditions.removeAt(k);
    }
    if (this.form.controls.shareFact.value === key) this.form.controls.shareFact.setValue('');
    if (this.form.controls.upliftFact.value === key) {
      this.form.patchValue({
        useUplift: false,
        upliftFact: '',
        upliftWhen: '',
        upliftOtherwise: '',
      });
    }
  }

  /** Every answer the calculation reads — what the page's "Try it" panel asks. */
  readonly tryFacts = computed(() => {
    this.formRev();
    const v = this.form.getRawValue();
    const keys = [
      v.primaryFact,
      v.primaryColumn?.fact,
      ...v.alternatives.flatMap((a) => [a.fact, a.column?.fact]),
      v.shareFact,
      ...v.conditions.flatMap((c) => [c.measure, c.otherFact]),
      v.useUplift ? v.upliftFact : '',
    ].filter((k): k is string => !!k && k !== '__answer__');
    const out: Array<{
      key: string;
      label: string;
      type: 'choice' | 'number';
      derived: boolean;
      options: ReadonlyArray<{ code: string; label: string }>;
    }> = [];
    for (const key of new Set(keys)) {
      const derived = derivedFactByKey(key);
      const number = this.isNumberFact(key);
      if (derived === undefined && !number && this.optionsOf(key).length === 0) continue;
      out.push({
        key,
        label: derived !== undefined ? derived.label : this.factLabel(key),
        type: number ? 'number' : 'choice',
        derived: derived !== undefined,
        options: this.optionsOf(key).map((o) => ({ code: o.code, label: this.optionLabel(o) })),
      });
    }
    return out;
  });

  // --- shared -----------------------------------------------------------------

  protected optionsOf(
    factKey: string,
  ): ReadonlyArray<{ code: string; labelAr: string; labelEn: string }> {
    const derived = derivedFactByKey(factKey);
    if (derived !== undefined) {
      return derived.options.map((o) => ({ code: o.code, labelAr: o.label, labelEn: o.label }));
    }
    return this.allFacts().find((f) => f.key === factKey)?.question?.options ?? [];
  }
}

/** No ranges yet, or only the single open range an empty table is drawn with. */
function blankBands(bands: readonly IncomeBand[] | undefined): boolean {
  if (bands === undefined || bands.length === 0) return true;
  const [only] = bands;
  return (
    bands.length === 1 &&
    only !== undefined &&
    String(only.incomeEGP ?? '').trim() === '' &&
    (only.fromInclusive ?? '0') === '0' &&
    (only.toExclusive ?? null) === null
  );
}

/** The figures with every blank row taken out — a blank box means "each bank fills it in". */
function cleanFigures(figures: Record<string, StepFigures>): Record<string, StepFigures> {
  const out: Record<string, StepFigures> = {};
  for (const [id, f] of Object.entries(figures)) {
    const copy: StepFigures = { ...f };
    if (copy.keyTable) {
      copy.keyTable = copy.keyTable.filter((r) => String(r.incomeEGP ?? '').trim() !== '');
      if (copy.keyTable.length === 0) delete copy.keyTable;
    }
    if (copy.bands) {
      copy.bands = copy.bands.filter((b) => String(b.incomeEGP ?? '').trim() !== '');
      if (copy.bands.length === 0) delete copy.bands;
    }
    if (Object.keys(copy).length > 0) out[id] = copy;
  }
  return out;
}

/** 1000000 → 1,000,000 for reading; anything not a plain number is shown as typed. */
function groupDigits(raw: string): string {
  return /^\d+(\.\d+)?$/.test(raw)
    ? Number(raw).toLocaleString('en-US', { maximumFractionDigits: 4 })
    : raw;
}

/** How a way reads its answer, as the card's second line says it. */
const WAY_HOW: Partial<Record<TemplateMechanismKind, () => string>> = {
  choiceTable: () => $localize`:@@spt.v2.per_answer:One amount per answer`,
  classTable: () => $localize`:@@spt.v2.per_group:One amount per group`,
  numberBand: () => $localize`:@@spt.v2.by_ranges:By ranges`,
  shareOf: () => $localize`:@@spt.v2.how_pct:A percentage of it`,
  multipleOf: () => $localize`:@@spt.v2.times:Multiplied by`,
  dividedBy: () => $localize`:@@spt.v2.divided:Divided by`,
};

/** "Turn away if … is less than …" — the condition read from the side of who is refused. */
const RULE_OP_LABELS: Readonly<Record<ConditionOp, () => string>> = {
  atLeast: () => $localize`:@@spt.v2.op_less:is less than`,
  atMost: () => $localize`:@@spt.v2.op_more:is more than`,
  between: () => $localize`:@@spt.v2.op_outside:is not between`,
  atLeastShareOf: () => $localize`:@@spt.v2.op_less_share2:is less than a % of another answer`,
  oneOf: () => $localize`:@@spt.v2.op_is:is`,
  atLeastPerAnswer: () => $localize`:@@spt.v2.op_less_per:is less than a figure that depends on`,
  atMostPerAnswer: () => $localize`:@@spt.v2.op_more_per:is more than a figure that depends on`,
};
