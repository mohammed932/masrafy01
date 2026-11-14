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
  input,
  output,
  signal,
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { FormArray, FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ParentClassBoardComponent } from '@shared/lookups/parent-class-board.component';
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
  imports: [NgTemplateOutlet, ReactiveFormsModule, ParentClassBoardComponent],
  template: `
    <!-- The product page's Amount and "Who can't get it" steps (v36.2.0). One instance, mounted
         once by the product page, so an edit survives moving between the two; the part input picks
         which half is on screen. No Save of its own: the page's one Save bar calls saveNow(). -->
    <div class="embedded">
      @if (advanced()) {
        <!-- No form to show, and saying so is the honest state. Offering an empty one would
             invite the operator to overwrite a live calculation with a blank shape. -->
        <p class="notice" role="status">
          <span i18n="@@spt.advanced"
            >This product's calculation was built step by step, so there is no form for it. You can
            still edit the steps on the product page.</span
          >
        </p>
      } @else if (part() === 'amount') {
        <ng-container [ngTemplateOutlet]="amountPart" />
      } @else {
        <ng-container [ngTemplateOutlet]="rulesPart" />
      }
      @if (!advanced() && (saveError() || (dirty() && blockReason() !== null))) {
        <div class="embed-actions">
          @if (saveError(); as message) {
            <p class="embed-error" role="alert">{{ message }}</p>
          } @else {
            <p class="embed-hint">{{ blockReason() }}</p>
          }
        </div>
      }
    </div>

    <!-- ── Amount ─────────────────────────────────────────────────────────── -->
    <ng-template #amountPart>
      <form [formGroup]="form" class="stack">
        <section class="block">
          <h2 class="q" i18n="@@spt.v2.amount_is">The amount is</h2>
          <div class="picks" role="radiogroup" [attr.aria-label]="amountIsAria">
            <button
              type="button"
              role="radio"
              class="pick"
              [class.is-on]="form.controls.outputKind.value === 'monthlyIncome'"
              [attr.aria-checked]="form.controls.outputKind.value === 'monthlyIncome'"
              (click)="toggleCeiling(false)"
            >
              <span class="pick-dot" aria-hidden="true"></span>
              <span i18n="@@spt.v2.income">Monthly income</span>
            </button>
            <button
              type="button"
              role="radio"
              class="pick"
              [class.is-on]="form.controls.outputKind.value === 'maxAmount'"
              [attr.aria-checked]="form.controls.outputKind.value === 'maxAmount'"
              (click)="toggleCeiling(true)"
            >
              <span class="pick-dot" aria-hidden="true"></span>
              <span i18n="@@spt.v2.limit">Most they can borrow</span>
            </button>
          </div>
          @if (form.controls.outputKind.value === 'maxAmount') {
            <p class="help" i18n="@@spt.v2.limit_help">
              The amount is the biggest loan they can get.
            </p>
          } @else {
            <p class="help" i18n="@@spt.v2.income_help">
              The amount is a salary we count for them. Each bank then applies its own debt-burden
              limit.
            </p>
          }
        </section>

        <section class="block">
          @if (wayCount() > 1) {
            <h2 class="q" i18n="@@spt.v2.ways_title2">
              Banks price this in {{ wayCount() }} different ways
            </h2>
            <div class="picks" role="radiogroup" [attr.aria-label]="waysModeAria">
              <button
                type="button"
                role="radio"
                class="pick"
                [class.is-on]="form.controls.waysAre.value === 'exclusive'"
                [attr.aria-checked]="form.controls.waysAre.value === 'exclusive'"
                (click)="setWaysMode('exclusive')"
              >
                <span class="pick-dot" aria-hidden="true"></span>
                <span i18n="@@spt.v2.ways_pick2">Each bank uses one of them</span>
              </button>
              <button
                type="button"
                role="radio"
                class="pick"
                [class.is-on]="form.controls.waysAre.value === 'combined'"
                [attr.aria-checked]="form.controls.waysAre.value === 'combined'"
                (click)="setWaysMode('combined')"
              >
                <span class="pick-dot" aria-hidden="true"></span>
                <span i18n="@@spt.v2.ways_lowest2">Use all and take the lowest</span>
              </button>
            </div>
          } @else {
            <h2 class="q" i18n="@@spt.v2.worked_out">How it is worked out</h2>
          }

          <ol class="wcards" role="list">
            @for (i of wayIndexes(); track i) {
              <li class="wcard" [class.is-open]="wayIsOpen(i)">
                @if (wayCount() > 1) {
                  <button
                    type="button"
                    class="wcard-top"
                    [attr.aria-expanded]="wayIsOpen(i)"
                    (click)="toggleWay(i)"
                  >
                    <span class="wcard-n" aria-hidden="true">{{ i + 1 }}</span>
                    <span class="wcard-t">
                      <span class="wcard-title">{{ wayTitle(i) }}</span>
                      @if (waySub(i); as sub) {
                        <span class="wcard-sub">{{ sub }}</span>
                      }
                    </span>
                    <svg class="chev" viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
                      <path
                        d="M4 6l4 4 4-4"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="1.6"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                      />
                    </svg>
                  </button>
                }
                @if (wayIsOpen(i)) {
                  <div class="wcard-body">
                    <label class="field">
                      <span class="label" i18n="@@spt.v2.from">Worked out from</span>
                      <select
                        #wayFactSel
                        class="control"
                        (change)="setWayFact(i, wayFactSel.value)"
                      >
                        <option
                          value=""
                          disabled
                          [selected]="wayFactValue(i) === ''"
                          i18n="@@spt.v2.pick_q"
                        >
                          Pick one of this product's questions…
                        </option>
                        @for (fact of decidingFacts(); track fact.key) {
                          <option [value]="fact.key" [selected]="wayFactValue(i) === fact.key">
                            {{ fact.label }}
                          </option>
                        }
                        <option
                          value="__flat__"
                          [selected]="wayFactValue(i) === '__flat__'"
                          i18n="@@spt.v2.flat"
                        >
                          No question: the same amount for everyone
                        </option>
                      </select>
                      @if (decidingFacts().length === 0) {
                        <span class="help is-warn" i18n="@@spt.q1.no_facts3"
                          >Add a choice or number question in the Questions tab first.</span
                        >
                      }
                    </label>

                    @if (wayIsNumber(i)) {
                      <div class="field is-wide">
                        <span class="label" i18n="@@spt.v2.how">How</span>
                        <div class="picks" role="radiogroup" [attr.aria-label]="numberWayAria">
                          @for (w of numberWays; track w.kind) {
                            <button
                              type="button"
                              role="radio"
                              class="pick"
                              [class.is-on]="wayKind(i) === w.kind"
                              [attr.aria-checked]="wayKind(i) === w.kind"
                              (click)="setWayKind(i, w.kind)"
                            >
                              <span class="pick-dot" aria-hidden="true"></span>
                              <span>{{ w.label }}</span>
                            </button>
                          }
                        </div>
                      </div>
                    } @else if (wayHasClasses(i)) {
                      <div class="field is-wide">
                        <span class="label" i18n="@@spt.v2.how">How</span>
                        <div class="picks" role="radiogroup" [attr.aria-label]="choiceWayAria">
                          <button
                            type="button"
                            role="radio"
                            class="pick"
                            [class.is-on]="wayKind(i) === 'choiceTable'"
                            [attr.aria-checked]="wayKind(i) === 'choiceTable'"
                            (click)="setWayKind(i, 'choiceTable')"
                          >
                            <span class="pick-dot" aria-hidden="true"></span>
                            <span i18n="@@spt.v2.per_answer">One amount per answer</span>
                          </button>
                          <button
                            type="button"
                            role="radio"
                            class="pick"
                            [class.is-on]="wayKind(i) === 'classTable'"
                            [attr.aria-checked]="wayKind(i) === 'classTable'"
                            (click)="setWayKind(i, 'classTable')"
                          >
                            <span class="pick-dot" aria-hidden="true"></span>
                            <span i18n="@@spt.v2.per_group">One amount per group</span>
                          </button>
                        </div>
                      </div>
                      @if (wayKind(i) === 'classTable' && classBoardFor(wayFactValue(i)); as b) {
                        <details class="groups-box">
                          <summary>
                            <span class="groups-sum">{{ groupsLine(wayFactValue(i)) }}</span>
                            <span class="groups-edit" i18n="@@spt.v2.move_groups"
                              >Move answers between groups</span
                            >
                          </summary>
                          <app-parent-class-board
                            [childType]="b.child"
                            [parentType]="b.parent"
                            [productKey]="key"
                            (changed)="refreshFacts()"
                          />
                        </details>
                      }
                    }

                    @if (wayFactValue(i) !== '' && wayFactValue(i) !== '__flat__') {
                      @if (wayColumn(i); as col) {
                        <div class="field is-wide">
                          <span class="label" i18n="@@spt.v2.split_by">Different amounts by</span>
                          <div class="split-row">
                            <select
                              #colSel
                              class="control"
                              (change)="setColumnFact(i, colSel.value)"
                            >
                              <option value="" i18n="@@spt.v2.split_none">Nothing</option>
                              @for (fact of columnChoices(i); track fact.key) {
                                <option [value]="fact.key" [selected]="col.fact === fact.key">
                                  {{ fact.label }}
                                </option>
                              }
                            </select>
                            @if (columnGroupable(col.fact)) {
                              <div
                                class="picks"
                                role="radiogroup"
                                [attr.aria-label]="columnModeAria"
                              >
                                <button
                                  type="button"
                                  role="radio"
                                  class="pick"
                                  [class.is-on]="col.branchOn !== 'parentClass'"
                                  [attr.aria-checked]="col.branchOn !== 'parentClass'"
                                  (click)="setColumnMode(i, 'answer')"
                                >
                                  <span class="pick-dot" aria-hidden="true"></span>
                                  <span i18n="@@spt.v2.col_answer">A column per answer</span>
                                </button>
                                <button
                                  type="button"
                                  role="radio"
                                  class="pick"
                                  [class.is-on]="col.branchOn === 'parentClass'"
                                  [attr.aria-checked]="col.branchOn === 'parentClass'"
                                  (click)="setColumnMode(i, 'groups')"
                                >
                                  <span class="pick-dot" aria-hidden="true"></span>
                                  <span i18n="@@spt.v2.col_group">A column per group</span>
                                </button>
                              </div>
                            }
                          </div>
                          @if (col.groups) {
                            <!-- THIS product's own groups: named here, one column each. -->
                            <details class="groups-box" [open]="groupsOpen()">
                              <summary>
                                <span class="groups-sum">{{ ownGroupsLine(col) }}</span>
                                <span class="groups-edit" i18n="@@spt.v2.edit_groups"
                                  >Edit groups</span
                                >
                              </summary>
                              <div class="groups-body">
                                @for (g of col.groups; track g.key; let gi = $index) {
                                  <div class="group-row">
                                    <input
                                      #gEn
                                      class="control"
                                      [value]="g.labelEn"
                                      placeholder="Name in English"
                                      i18n-placeholder="@@spt.groups.name_en"
                                      [attr.aria-label]="groupNameLabel(gi)"
                                      (input)="renameGroup(i, g.key, gEn.value, null)"
                                    />
                                    <input
                                      #gAr
                                      class="control"
                                      dir="rtl"
                                      [value]="g.labelAr"
                                      placeholder="Name in Arabic"
                                      i18n-placeholder="@@spt.groups.name_ar"
                                      [attr.aria-label]="groupNameLabel(gi)"
                                      (input)="renameGroup(i, g.key, null, gAr.value)"
                                    />
                                    <span class="group-n">{{ groupCountLabel(g.key) }}</span>
                                    <button
                                      type="button"
                                      class="linkish is-danger"
                                      [disabled]="col.groups.length <= 2"
                                      (click)="removeGroup(i, g.key)"
                                      i18n="@@spt.groups.remove"
                                    >
                                      Remove
                                    </button>
                                  </div>
                                }
                                <button
                                  type="button"
                                  class="linkish add-group"
                                  (click)="addGroup(i)"
                                  i18n="@@spt.groups.add"
                                >
                                  Add a group
                                </button>
                                <p class="label" i18n="@@spt.groups.place">
                                  Which group is each answer in?
                                </p>
                                <div class="placements">
                                  @for (option of optionsOf(col.fact); track option.code) {
                                    <label class="placement">
                                      <span>{{ optionLabel(option) }}</span>
                                      <select
                                        #placeSelect
                                        class="control"
                                        (change)="place(option.code, placeSelect.value)"
                                      >
                                        <option value="" i18n="@@spt.groups.none">No group</option>
                                        @for (g of col.groups; track g.key) {
                                          <option
                                            [value]="g.key"
                                            [selected]="placementOf(option.code) === g.key"
                                          >
                                            {{ groupName(g) }}
                                          </option>
                                        }
                                      </select>
                                    </label>
                                  }
                                </div>
                                @if (unplacedCount(col) > 0) {
                                  <p class="help is-warn" i18n="@@spt.v2.unplaced">
                                    {{ unplacedCount(col) }} answer(s) in no group are priced on the
                                    first group's column.
                                  </p>
                                }
                              </div>
                            </details>
                          } @else if (col.branchOn === 'parentClass') {
                            <p class="help">
                              {{ groupsLine(col.fact) }}
                              <button
                                type="button"
                                class="linkish"
                                (click)="setColumnMode(i, 'own')"
                                i18n="@@spt.v2.own_groups"
                              >
                                Make your own groups instead
                              </button>
                            </p>
                          }
                          @if (col.branches.length > 1) {
                            <label class="sentence">
                              <span i18n="@@spt.v2.no_answer_use">If they don't answer, use</span>
                              <select
                                #stdSel
                                class="control"
                                (change)="setStandardBranch(i, stdSel.value)"
                              >
                                @for (b of col.branches; track b) {
                                  <option [value]="b" [selected]="b === col.branches[0]">
                                    {{ branchName(col, b) }}
                                  </option>
                                }
                              </select>
                            </label>
                          }
                        </div>
                      } @else if (columnFacts(i).length > 0) {
                        <button type="button" class="linkish" (click)="startColumn(i)">
                          <span i18n="@@spt.v2.add_split"
                            >+ Different amounts for another answer</span
                          >
                        </button>
                      }
                    }

                    <!-- The figures this way's choices made, right under them. -->
                    @if (wayReady(i)) {
                      <div class="figs">
                        @switch (figShape(i)) {
                          @case ('table') {
                            <div class="ftable-wrap">
                              <table class="ftable">
                                <thead>
                                  <tr>
                                    <th scope="col">{{ rowHeader(i) }}</th>
                                    @for (c of colsOf(i); track c.slot) {
                                      <th scope="col" class="num">{{ c.label }}</th>
                                    }
                                  </tr>
                                </thead>
                                <tbody>
                                  @for (r of rowsOf(i); track r.key) {
                                    <tr>
                                      <th scope="row">{{ r.label }}</th>
                                      @for (c of colsOf(i); track c.slot) {
                                        <td class="num">
                                          <input
                                            #cellIn
                                            class="control is-amt"
                                            inputmode="decimal"
                                            placeholder="—"
                                            [value]="cell(c.slot, r.key)"
                                            [attr.aria-label]="r.label + ' · ' + c.label"
                                            (input)="setCell(c.slot, r.key, cellIn.value)"
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
                            <div class="ftable-wrap">
                              <table class="ftable">
                                <thead>
                                  <tr>
                                    <th scope="col" i18n="@@spt.v2.from_col">From</th>
                                    <th scope="col" i18n="@@spt.v2.to_col">Up to</th>
                                    @for (c of colsOf(i); track c.slot) {
                                      <th scope="col" class="num">{{ c.label }}</th>
                                    }
                                    <th scope="col">
                                      <span class="sr-only" i18n="@@spt.v2.remove_col">Remove</span>
                                    </th>
                                  </tr>
                                </thead>
                                <tbody>
                                  @for (b of rangesOf(i); track $index; let bi = $index) {
                                    <tr>
                                      <td>
                                        <input
                                          #fromIn
                                          class="control is-edge"
                                          inputmode="decimal"
                                          [value]="fmt(b.fromInclusive)"
                                          [attr.aria-label]="fromAria"
                                          (input)="setEdge(i, bi, 'fromInclusive', fromIn.value)"
                                        />
                                      </td>
                                      <td>
                                        <input
                                          #toIn
                                          class="control is-edge"
                                          inputmode="decimal"
                                          placeholder="and above"
                                          i18n-placeholder="@@spt.v2.and_above"
                                          [value]="fmt(b.toExclusive ?? '')"
                                          [attr.aria-label]="toAria"
                                          (input)="setEdge(i, bi, 'toExclusive', toIn.value)"
                                        />
                                      </td>
                                      @for (c of colsOf(i); track c.slot) {
                                        <td class="num">
                                          <input
                                            #bandIn
                                            class="control is-amt"
                                            inputmode="decimal"
                                            placeholder="—"
                                            [value]="bandAmount(c.slot, bi)"
                                            [attr.aria-label]="c.label"
                                            (input)="setBandAmount(i, c.slot, bi, bandIn.value)"
                                          />
                                        </td>
                                      }
                                      <td>
                                        <button
                                          type="button"
                                          class="linkish is-danger"
                                          [disabled]="rangesOf(i).length < 2"
                                          (click)="removeRange(i, bi)"
                                          i18n="@@spt.cond.remove"
                                        >
                                          Remove
                                        </button>
                                      </td>
                                    </tr>
                                  }
                                </tbody>
                              </table>
                            </div>
                            <button type="button" class="linkish" (click)="addRange(i)">
                              <span i18n="@@spt.v2.add_range">+ Add a range</span>
                            </button>
                          }
                          @case ('scalar') {
                            @for (c of colsOf(i); track c.slot) {
                              <p class="sentence">
                                @if (colsOf(i).length > 1) {
                                  <span class="sent-col">{{ c.label }}</span>
                                }
                                <span>{{ amountWord() }} = {{ factLabel(wayFactValue(i)) }}</span>
                                <span class="op">{{ scalarSign(i) }}</span>
                                <input
                                  #scalIn
                                  class="control is-fig"
                                  inputmode="decimal"
                                  placeholder="—"
                                  [value]="scalarOf(c.slot)"
                                  [attr.aria-label]="c.label"
                                  (input)="setScalar(i, c.slot, scalIn.value)"
                                />
                                @if (wayKind(i) === 'shareOf') {
                                  <span class="op">%</span>
                                }
                              </p>
                            }
                          }
                          @case ('flat') {
                            <p class="sentence">
                              <span>{{ amountWord() }} =</span>
                              <input
                                #flatIn
                                class="control is-amt"
                                inputmode="decimal"
                                placeholder="—"
                                [value]="flatOf(i)"
                                [attr.aria-label]="amountWord()"
                                (input)="setFlat(i, flatIn.value)"
                              />
                            </p>
                          }
                        }
                        <p class="help" i18n="@@spt.v2.empty_box">
                          A box left empty is filled in by each bank.
                        </p>
                      </div>
                    }

                    @if (wayCount() > 1 && i > 0) {
                      <button
                        type="button"
                        class="linkish is-danger way-remove"
                        (click)="removeWay(i - 1)"
                        [attr.aria-label]="wayRemoveLabel(i - 1)"
                      >
                        <span i18n="@@spt.v2.remove_way">Remove this way</span>
                      </button>
                    }
                  </div>
                }
              </li>
            }
          </ol>

          @if (canAddWay()) {
            <button type="button" class="way-add" (click)="addWay()">
              <span i18n="@@spt.v2.add_way">+ Add another way</span>
            </button>
          }

          @if (shareOn() || form.controls.shareFact.value !== '') {
            <label class="field">
              <span class="label" i18n="@@spt.v2.share">Then give only the part they own</span>
              <select class="control" formControlName="shareFact">
                <option value="" i18n="@@spt.v2.share_none">No</option>
                @for (fact of numericFacts(); track fact.key) {
                  <option [value]="fact.key">{{ fact.label }}</option>
                }
              </select>
              <span class="help" i18n="@@spt.v2.share_help"
                >Own 50% of the unit → they get half the amount.</span
              >
            </label>
          } @else if (numericFacts().length > 0) {
            <button type="button" class="linkish" (click)="shareOn.set(true)">
              <span i18n="@@spt.v2.share_add">+ Give only the part they own (a % they type)</span>
            </button>
          }
        </section>

        <!-- Rare settings, folded: most products never need them. -->
        <details class="block more" [open]="hasExtras()">
          <summary class="more-head">
            <span class="q" i18n="@@spt.v2.more_settings">More settings</span>
            <span class="more-note" i18n="@@spt.more_note">Optional</span>
          </summary>

          @if (form.controls.outputKind.value === 'maxAmount') {
            <div class="addon">
              <label class="sentence dbr-line">
                <span i18n="@@spt.v2.dbr_line">Worked out at a debt burden of</span>
                <input
                  class="control is-fig"
                  inputmode="decimal"
                  placeholder="—"
                  formControlName="baselineDbrPercent"
                />
                <span class="op">%</span>
              </label>
              <p class="help" i18n="@@spt.v2.dbr_help">
                Leave it as it is unless the bank's sheet says otherwise.
              </p>
            </div>
          }

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
                  <span class="label" i18n="@@spt.addon.uplift.fact2">Which question?</span>
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
                    <span i18n="@@spt.addon.uplift.scope.max">The most the bank will lend</span>
                  </label>
                </fieldset>
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
        </details>
      </form>
    </ng-template>

    <!-- ── Who can't get it ───────────────────────────────────────────────── -->
    <ng-template #rulesPart>
      <form [formGroup]="form" class="stack">
        <section class="block">
          @if (conditions.length === 0) {
            <p class="notice" i18n="@@spt.v2.rules_none">
              No rules: everyone can get this product.
            </p>
          } @else {
            <ul class="conditions" role="list" formArrayName="conditions">
              @for (row of conditions.controls; track row.value.id; let i = $index) {
                <li class="rule" [formGroupName]="i">
                  <span class="rl" i18n="@@spt.v2.turn_away">Turn away if</span>
                  <select #measureSel class="control" (change)="setMeasure(i, measureSel.value)">
                    <option
                      value="__answer__"
                      [selected]="row.value.measure === '__answer__'"
                      i18n="@@spt.v2.measure_answer"
                    >
                      The amount worked out
                    </option>
                    @for (fact of allFacts(); track fact.key) {
                      <option [value]="fact.key" [selected]="row.value.measure === fact.key">
                        {{ fact.label }}
                      </option>
                    }
                  </select>

                  @if (row.value.op === 'oneOf') {
                    <span class="rl" i18n="@@spt.v2.is_any">is any of</span>
                    <div class="checks">
                      @for (option of optionsOf(row.value.measure ?? ''); track option.code) {
                        <label class="check">
                          <input
                            type="checkbox"
                            [checked]="!(row.value.expect ?? []).includes(option.code)"
                            (change)="toggleTurnedAway(i, option.code)"
                          />
                          <span>{{ optionLabel(option) }}</span>
                        </label>
                      }
                    </div>
                  } @else {
                    <span class="rl" aria-hidden="true"></span>
                    <div class="inline">
                      <select class="control" formControlName="op">
                        @for (op of opsFor(row.value.measure ?? ''); track op) {
                          <option [value]="op">{{ ruleOpLabel(op) }}</option>
                        }
                      </select>
                      @switch (row.value.op) {
                        @case ('atLeast') {
                          <input
                            #minIn
                            class="control is-fig"
                            inputmode="decimal"
                            [value]="ruleFigure(row.value.id ?? '', 'minValue')"
                            placeholder="—"
                            [attr.aria-label]="figureAria"
                            (input)="setRuleFigure(row.value.id ?? '', 'minValue', minIn.value)"
                          />
                        }
                        @case ('atMost') {
                          <input
                            #maxIn
                            class="control is-fig"
                            inputmode="decimal"
                            [value]="ruleFigure(row.value.id ?? '', 'maxValue')"
                            placeholder="—"
                            [attr.aria-label]="figureAria"
                            (input)="setRuleFigure(row.value.id ?? '', 'maxValue', maxIn.value)"
                          />
                        }
                        @case ('between') {
                          <input
                            #lowIn
                            class="control is-fig"
                            inputmode="decimal"
                            [value]="ruleFigure(row.value.id ?? '', 'minValue')"
                            placeholder="—"
                            [attr.aria-label]="figureAria"
                            (input)="setRuleFigure(row.value.id ?? '', 'minValue', lowIn.value)"
                          />
                          <span class="unit" i18n="@@spt.v2.and">and</span>
                          <input
                            #highIn
                            class="control is-fig"
                            inputmode="decimal"
                            [value]="ruleFigure(row.value.id ?? '', 'maxValue')"
                            placeholder="—"
                            [attr.aria-label]="figureAria"
                            (input)="setRuleFigure(row.value.id ?? '', 'maxValue', highIn.value)"
                          />
                        }
                        @case ('atLeastShareOf') {
                          <span class="affix">
                            <input
                              #pctIn
                              class="control is-fig"
                              inputmode="decimal"
                              [value]="ruleShare(row.value.id ?? '')"
                              placeholder="—"
                              [attr.aria-label]="figureAria"
                              (input)="setRuleShare(row.value.id ?? '', pctIn.value)"
                            />
                            <span class="unit" i18n="@@spt.v2.pct_of2">% of</span>
                          </span>
                          <select class="control" formControlName="otherFact">
                            <option value="" i18n="@@spt.choose">Choose…</option>
                            @for (fact of numericFacts(); track fact.key) {
                              <option [value]="fact.key">{{ fact.label }}</option>
                            }
                          </select>
                        }
                        @default {
                          <select class="control" formControlName="otherFact">
                            <option value="" i18n="@@spt.choose">Choose…</option>
                            @for (fact of choiceFacts(); track fact.key) {
                              <option [value]="fact.key">{{ fact.label }}</option>
                            }
                          </select>
                        }
                      }
                    </div>
                  }

                  <span class="rl" i18n="@@spt.v2.status">Status</span>
                  <div class="inline">
                    @switch (ruleState(row.value)) {
                      @case ('on') {
                        <span class="state is-on" i18n="@@spt.v2.state_on"
                          >On — these customers are turned away</span
                        >
                        @if (row.value.op === 'oneOf') {
                          <button
                            type="button"
                            class="linkish"
                            (click)="setRuleApplies(row.value.id ?? '')"
                            i18n="@@spt.v2.turn_off"
                          >
                            Turn off
                          </button>
                        }
                      }
                      @case ('offChoice') {
                        <span class="state" i18n="@@spt.v2.state_off">Off</span>
                        <button
                          type="button"
                          class="linkish"
                          (click)="setRuleApplies(row.value.id ?? '')"
                          i18n="@@spt.v2.turn_on"
                        >
                          Turn on
                        </button>
                      }
                      @case ('offNumber') {
                        <span class="state" i18n="@@spt.v2.state_off">Off</span>
                        <span class="help" i18n="@@spt.v2.type_to_turn_on"
                          >Type a number above to turn it on.</span
                        >
                      }
                      @default {
                        <span class="state" i18n="@@spt.v2.state_bank">Each bank sets it</span>
                      }
                    }
                  </div>

                  <span class="rl" i18n="@@spt.v2.tell_them">Tell them</span>
                  <div class="inline">
                    <select class="control" formControlName="reasonCode">
                      @for (code of reasonCodes; track code) {
                        <option [value]="code">{{ reasonLabel(code) }}</option>
                      }
                    </select>
                    <button type="button" class="linkish is-danger" (click)="removeCondition(i)">
                      <span i18n="@@spt.cond.remove">Remove</span>
                    </button>
                  </div>
                </li>
              }
            </ul>
          }

          <button type="button" class="way-add" (click)="addCondition()">
            <span i18n="@@spt.v2.add_rule">+ Add a rule</span>
          </button>
        </section>
      </form>
    </ng-template>
  `,
  styles: [
    `
      :host {
        display: block;
      }
      .more-head {
        display: flex;
        align-items: baseline;
        gap: var(--space-2);
        cursor: pointer;
      }
      .more-head .q {
        font-size: var(--text-base);
      }
      .more-note {
        font-size: var(--text-xs);
        color: var(--color-text-secondary);
      }
      .embedded {
        display: flex;
        flex-direction: column;
        gap: var(--space-4);
      }
      .embed-actions {
        display: flex;
        align-items: center;
        justify-content: flex-end;
        flex-wrap: wrap;
        gap: var(--space-3);
        padding-block-start: var(--space-3);
        border-block-start: 1px solid var(--border-subtle);
      }
      .embed-error,
      .embed-hint {
        margin: 0;
        margin-inline-end: auto;
        font-size: var(--text-sm);
        color: var(--text-secondary);
      }
      .embed-error {
        color: var(--error-strong);
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
      /* An outline, and NOT a primary border. These two rules used to turn the border
         primary on focus — the exact declaration the is-on selected state uses — so tabbing
         across the shapes made every card look picked. The border was compliant on contrast
         (5.37:1 on the card ground); what it was not is distinguishable from the state
         sitting beside it. */
      .pick:focus-visible {
        outline: var(--focus-ring-width) solid var(--focus-ring-color);
        outline-offset: var(--focus-ring-offset);
      }
      .pick.is-on {
        border-color: var(--primary);
        background: var(--primary-subtle);
        color: var(--color-text-primary);
        font-weight: var(--font-semibold);
      }

      /* ── cards: the shape pick, the one real decision on step 1 ─────────── */
      /* ONE LIST, a row per way (v36.1.0): seven equal boxes read as seven things to set up;
         this is one choice, read top to bottom — the same list "Start from" uses. */
      .cards {
        display: flex;
        flex-direction: column;
        border: 1px solid var(--color-border-default);
        border-radius: var(--radius-md);
        background: var(--bg-surface);
        overflow: hidden;
      }
      .card {
        display: flex;
        align-items: baseline;
        gap: var(--space-3);
        padding: var(--space-3) var(--space-4);
        border: 0;
        background: transparent;
        text-align: start;
        font: inherit;
        cursor: pointer;
        transition: background-color var(--motion-duration-fast) var(--motion-easing-standard);
      }
      .card + .card {
        border-block-start: 1px solid var(--color-border-subtle);
      }
      .card:hover {
        background: var(--bg-subtle);
      }
      .card:focus-visible {
        outline: var(--focus-ring-width) solid var(--focus-ring-color);
        outline-offset: calc(-1 * var(--focus-ring-width));
      }
      .card:active {
        background: var(--bg-subtle);
      }
      .card.is-on {
        background: var(--primary-subtle);
      }
      .card-text {
        display: flex;
        flex-wrap: wrap;
        align-items: baseline;
        gap: var(--space-1) var(--space-3);
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
        /* Indented under its add-on — no coloured edge (v36.1.0). */
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
      /* Full row under the selects: a sentence about the way, not a third control. */
      .way-split {
        grid-column: 1 / -1;
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

      .add-group {
        align-self: flex-start;
      }
      .groups {
        display: flex;
        flex-direction: column;
        gap: var(--space-2);
      }
      .group-row {
        display: grid;
        grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) auto;
        gap: var(--space-2);
        align-items: center;
      }
      .placements {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(min(100%, 18rem), 1fr));
        gap: var(--space-2) var(--space-4);
      }
      .placement {
        display: grid;
        grid-template-columns: minmax(0, 1fr) minmax(0, 10rem);
        gap: var(--space-2);
        align-items: center;
        font-size: var(--text-sm);
        color: var(--color-text-primary);
      }
      @media (max-width: 600px) {
        .group-row {
          grid-template-columns: minmax(0, 1fr);
        }
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

      /* ── the ways (v36.2.0): one card each, folded when there are several ───── */
      .wcards {
        list-style: none;
        margin: 0;
        padding: 0;
        display: flex;
        flex-direction: column;
        gap: var(--space-3);
      }
      .wcard {
        border: 1px solid var(--color-border-default);
        border-radius: var(--radius-lg);
        background: var(--bg-surface);
      }
      .wcard-top {
        inline-size: 100%;
        display: grid;
        grid-template-columns: auto minmax(0, 1fr) auto;
        align-items: center;
        gap: var(--space-3);
        padding: var(--space-3) var(--space-4);
        border: 0;
        border-radius: var(--radius-lg);
        background: none;
        font: inherit;
        text-align: start;
        color: var(--color-text-primary);
        cursor: pointer;
        transition: background-color var(--motion-duration-fast) var(--motion-easing-standard);
      }
      .wcard-top:hover {
        background: var(--bg-subtle);
      }
      .wcard-top:focus-visible {
        outline: var(--focus-ring-width) solid var(--focus-ring-color);
        outline-offset: var(--focus-ring-offset);
      }
      .wcard-n {
        display: inline-grid;
        place-items: center;
        inline-size: 1.75rem;
        block-size: 1.75rem;
        border-radius: var(--radius-pill);
        background: var(--bg-muted);
        color: var(--color-text-secondary);
        font-size: var(--text-xs);
        font-weight: var(--font-semibold);
      }
      .wcard.is-open .wcard-n {
        background: var(--primary);
        color: var(--text-on-primary);
      }
      .wcard-t {
        display: flex;
        flex-direction: column;
        gap: 2px;
        min-inline-size: 0;
      }
      .wcard-title {
        font-size: var(--text-sm);
        font-weight: var(--font-semibold);
      }
      .wcard-sub {
        font-size: var(--text-xs);
        color: var(--color-text-secondary);
      }
      .chev {
        color: var(--color-text-tertiary);
        transition: transform var(--motion-duration-fast) var(--motion-easing-standard);
      }
      .wcard.is-open .chev {
        transform: rotate(180deg);
      }
      .wcard-body {
        display: flex;
        flex-direction: column;
        gap: var(--space-5);
        padding: var(--space-5);
      }
      .wcard-top + .wcard-body {
        border-block-start: 1px solid var(--color-border-subtle);
      }
      .way-remove,
      .wcard-body > .linkish,
      .block > .linkish {
        align-self: flex-start;
      }
      .split-row {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: var(--space-3);
      }
      .split-row > .control {
        flex: 1 1 16rem;
        max-inline-size: 34rem;
      }
      .groups-box {
        border: 1px solid var(--color-border-default);
        border-radius: var(--radius-md);
        background: var(--bg-subtle);
      }
      .groups-box > summary {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: var(--space-3);
        padding: var(--space-2-5) var(--space-4);
        font-size: var(--text-sm);
        cursor: pointer;
        list-style: none;
      }
      .groups-box > summary::-webkit-details-marker {
        display: none;
      }
      .groups-box > summary:focus-visible {
        outline: var(--focus-ring-width) solid var(--focus-ring-color);
        outline-offset: var(--focus-ring-offset);
      }
      .groups-sum {
        min-inline-size: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        color: var(--color-text-primary);
      }
      .groups-edit {
        flex: none;
        color: var(--color-text-link);
        font-weight: var(--font-semibold);
      }
      .groups-box[open] .groups-edit {
        color: var(--color-text-secondary);
      }
      .groups-body,
      .groups-box > app-parent-class-board {
        display: flex;
        flex-direction: column;
        gap: var(--space-3);
        padding: 0 var(--space-4) var(--space-4);
      }
      .group-row {
        grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) auto auto;
      }
      .group-n {
        font-size: var(--text-xs);
        color: var(--color-text-secondary);
        white-space: nowrap;
      }

      /* ── who can't get it: one rule, three short lines ──────────────────── */
      .rule {
        display: grid;
        grid-template-columns: 7rem minmax(0, 1fr);
        align-items: center;
        gap: var(--space-3) var(--space-4);
        padding: var(--space-4);
        border: 1px solid var(--color-border-default);
        border-radius: var(--radius-lg);
        background: var(--bg-surface);
      }
      .rule > .control {
        max-inline-size: 34rem;
      }
      .rl {
        font-size: var(--text-xs);
        font-weight: var(--font-semibold);
        color: var(--color-text-secondary);
      }
      .inline {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: var(--space-2) var(--space-3);
      }
      .control.is-fig {
        inline-size: 9rem;
        text-align: end;
        font-variant-numeric: tabular-nums;
      }
      .checks {
        display: flex;
        flex-wrap: wrap;
        gap: var(--space-2);
      }
      .check {
        display: inline-flex;
        align-items: center;
        gap: var(--space-2);
        padding: var(--space-1) var(--space-3);
        border: 1px solid var(--color-border-default);
        border-radius: var(--radius-pill);
        background: var(--bg-surface);
        font-size: var(--text-sm);
        cursor: pointer;
      }
      .check:has(input:checked) {
        border-color: var(--color-error);
        background: var(--color-error-bg);
      }
      .check input {
        accent-color: var(--color-error);
      }
      @media (max-width: 40rem) {
        .rule {
          grid-template-columns: minmax(0, 1fr);
        }
        .rl:empty {
          display: none;
        }
        .group-row {
          grid-template-columns: minmax(0, 1fr) auto;
        }
      }

      /* ── the figures: plain tables, one look for every way ─────────────── */
      .figs {
        display: flex;
        flex-direction: column;
        gap: var(--space-3);
        align-items: flex-start;
      }
      .ftable-wrap {
        max-inline-size: 100%;
        overflow-x: auto;
        border: 1px solid var(--color-border-default);
        border-radius: var(--radius-md);
      }
      .ftable {
        border-collapse: collapse;
        font-size: var(--text-sm);
      }
      .ftable th,
      .ftable td {
        padding: var(--space-2) var(--space-3);
        border-block-end: 1px solid var(--color-border-subtle);
        text-align: start;
        vertical-align: middle;
      }
      .ftable tbody tr:last-child > * {
        border-block-end: 0;
      }
      .ftable thead th {
        background: var(--bg-subtle);
        font-size: var(--text-xs);
        font-weight: var(--font-semibold);
        color: var(--color-text-secondary);
        white-space: nowrap;
      }
      .ftable tbody th {
        font-weight: var(--font-regular, 400);
        color: var(--color-text-primary);
        min-inline-size: 10rem;
      }
      .ftable .num {
        text-align: end;
      }
      .control.is-amt {
        inline-size: 10rem;
        text-align: end;
        font-variant-numeric: tabular-nums;
      }
      .control.is-edge {
        inline-size: 7rem;
        text-align: end;
        font-variant-numeric: tabular-nums;
      }
      .sentence {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: var(--space-2);
        margin: 0;
        font-size: var(--text-sm);
        color: var(--color-text-primary);
      }
      .sent-col {
        min-inline-size: 9rem;
        font-weight: var(--font-semibold);
      }
      .sentence .op {
        color: var(--color-text-secondary);
      }
      .dbr-line {
        cursor: default;
      }
      .sr-only {
        position: absolute;
        inline-size: 1px;
        block-size: 1px;
        overflow: hidden;
        clip: rect(0 0 0 0);
        white-space: nowrap;
      }
      /* "More options" is rare: a quiet fold at the foot, not a section heading. */
      .more .more-head .q {
        font-size: var(--text-sm);
        font-weight: var(--font-semibold);
        color: var(--color-text-secondary);
      }
      .figs > .linkish {
        align-self: flex-start;
      }

      .state {
        display: inline-flex;
        align-items: center;
        padding: 2px var(--space-2);
        border-radius: var(--radius-pill);
        background: var(--bg-muted);
        color: var(--color-text-secondary);
        font-size: var(--text-xs);
        font-weight: var(--font-semibold);
      }
      .state.is-on {
        background: var(--color-success-bg);
        color: var(--color-success);
      }
      @media (prefers-reduced-motion: reduce) {
        .wcard-top,
        .chev {
          transition: none;
        }
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
  private readonly isAr = inject(LOCALE_ID).startsWith('ar');

  protected readonly reasonCodes = GATE_REASON_CODES;

  /** The product this calculation belongs to. The product page always sets it. */
  readonly embeddedKey = input<string | null>(null);
  /** Which half is on screen: the Amount step, or "Who can't get it". */
  readonly part = input<'amount' | 'rules'>('amount');
  /** Emitted after a save, so the product page re-reads what was compiled. */
  readonly saved = output<void>();

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
  ) {
    return this.fb.nonNullable.group({
      kind: this.fb.nonNullable.control<TemplateMechanismKind>(kind),
      fact: this.fb.nonNullable.control(fact),
      column: this.fb.control<TemplateColumn | null>(column),
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

  private factOf(key: string): RegistryFact | undefined {
    return this.allFacts().find((f) => f.key === key);
  }

  protected wayIsNumber(i: number): boolean {
    return this.factOf(this.wayFactValue(i))?.question?.type === 'NUMERIC';
  }

  /** A choice whose answers are filed under shared groups: a figure per group is offered. */
  protected wayHasClasses(i: number): boolean {
    const q = this.factOf(this.wayFactValue(i))?.question;
    return q?.type === 'SINGLE_SELECT' && (q.parentOptions?.length ?? 0) > 0;
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
              ? (this.factOf(fact)?.question?.parentOptions ?? []).map((o) => o.code)
              : this.optionsOf(fact).map((o) => o.code);
          const rows = [...(next[step.id]?.keyTable ?? [])];
          const have = new Set(rows.map((r) => r.key));
          for (const key of keys) if (!have.has(key)) rows.push({ key, incomeEGP: '' });
          if (rows.length > 0) next[step.id] = { ...next[step.id], keyTable: rows };
        } else if (step.op === 'bandTable' && (next[step.id]?.bands ?? []).length === 0) {
          next[step.id] = {
            ...next[step.id],
            bands: [{ fromInclusive: '0', toExclusive: null, incomeEGP: '' }],
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

  /** Its answers come from a list, so they can be put in groups. */
  protected columnGroupable(key: string): boolean {
    const q = this.factOf(key)?.question;
    // Groups pay off on a long list; two or three answers are simply a column each.
    if ((q?.parentOptions?.length ?? 0) > 0) return true;
    return q?.optionsEnumerationType !== undefined && (q.options?.length ?? 0) > 3;
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

  protected setColumnMode(i: number, mode: 'answer' | 'groups' | 'own'): void {
    const current = this.wayColumn(i);
    if (current === null) return;
    const fact = current.fact;
    if (mode === 'answer') {
      this.setWayColumn(i, { fact, branches: this.optionsOf(fact).map((o) => o.code) });
      return;
    }
    const shared = this.factOf(fact)?.question?.parentOptions ?? [];
    if (mode === 'groups' && shared.length > 0) {
      // The list's own groups (the city tiers): a column each.
      this.setWayColumn(i, { fact, branchOn: 'parentClass', branches: shared.map((o) => o.code) });
      return;
    }
    // This product's own groups: two to start, every answer in the first.
    const groups: TemplateGroup[] = [
      { key: 'g1', labelEn: 'Group 1', labelAr: 'المجموعة 1' },
      { key: 'g2', labelEn: 'Group 2', labelAr: 'المجموعة 2' },
    ];
    this.setWayColumn(i, {
      fact,
      branchOn: 'parentClass',
      branches: groups.map((g) => g.key),
      groups,
    });
    this.placements.set(Object.fromEntries(this.optionsOf(fact).map((o) => [o.code, 'g1'])));
    this.groupsOpen.set(true);
    void this.loadValueIds(fact);
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

  /** "Groups: Class AA · Class AB · …" for a list's own groups. */
  protected groupsLine(key: string): string {
    const names = (this.factOf(key)?.question?.parentOptions ?? [])
      .map((o) => this.optionLabel(o))
      .join(' · ');
    return $localize`:@@spt.v2.groups_line:Groups: ${names}:NAMES:`;
  }

  protected ownGroupsLine(column: TemplateColumn): string {
    const names = (column.groups ?? []).map((g) => this.groupName(g)).join(' · ');
    return $localize`:@@spt.v2.groups_line:Groups: ${names}:NAMES:`;
  }

  /** The board that moves a list's answers between its groups, for this product. */
  protected classBoardFor(key: string): { child: string; parent: string } | null {
    const q = this.factOf(key)?.question;
    if (q?.optionsEnumerationType === undefined || q.parentEnumerationType === undefined) {
      return null;
    }
    return { child: q.optionsEnumerationType, parent: q.parentEnumerationType };
  }

  /** A move on the board is written at once; re-read the lists so the group line follows. */
  protected refreshFacts(): void {
    void this.enums.refresh('surrogate_fact');
  }

  // --- this product's own groups (on a column) -------------------------------

  private ownGroupsWay(): number {
    return this.wayIndexes().findIndex((i) => this.wayColumn(i)?.groups !== undefined);
  }

  private mapGroups(i: number, change: (groups: TemplateGroup[]) => TemplateGroup[]): void {
    const col = this.wayColumn(i);
    if (col?.groups === undefined) return;
    const groups = change(col.groups.map((g) => ({ ...g })));
    this.setWayColumn(i, { ...col, branches: groups.map((g) => g.key), groups });
  }

  protected renameGroup(i: number, key: string, en: string | null, ar: string | null): void {
    this.mapGroups(i, (groups) =>
      groups.map((g) =>
        g.key === key ? { ...g, labelEn: en ?? g.labelEn, labelAr: ar ?? g.labelAr } : g,
      ),
    );
  }

  protected addGroup(i: number): void {
    this.mapGroups(i, (groups) => {
      const taken = new Set(groups.map((g) => g.key));
      let n = groups.length + 1;
      // Never re-used: a key is a figures slot, and a recycled one would hand a new group the
      // figures of a removed one.
      while (taken.has(`g${n}`)) n += 1;
      return [...groups, { key: `g${n}`, labelEn: `Group ${n}`, labelAr: `المجموعة ${n}` }];
    });
  }

  protected removeGroup(i: number, key: string): void {
    this.mapGroups(i, (groups) => groups.filter((g) => g.key !== key));
    const next = { ...this.placements() };
    for (const [code, group] of Object.entries(next)) if (group === key) delete next[code];
    this.placements.set(next);
  }

  /** The name in the reading language, else the other one. */
  protected groupName(group: TemplateGroup): string {
    const mine = (this.isAr ? group.labelAr : group.labelEn).trim();
    return mine || (this.isAr ? group.labelEn : group.labelAr).trim();
  }

  protected groupNameLabel(index: number): string {
    return $localize`:@@spt.groups.name_aria:Name of group ${index + 1}:N:`;
  }

  protected groupCountLabel(key: string): string {
    const n = Object.values(this.placements()).filter((g) => g === key).length;
    return $localize`:@@spt.v2.group_count:${n}:N: answer(s)`;
  }

  protected unplacedCount(column: TemplateColumn): number {
    const keys = new Set((column.groups ?? []).map((g) => g.key));
    return this.optionsOf(column.fact).filter((o) => !keys.has(this.placements()[o.code] ?? ''))
      .length;
  }

  /** Answer code to this product's group key, as on screen (held until Save). */
  private readonly placements = signal<Record<string, string>>({});
  /** Answer code to list row id, for the save. */
  private readonly valueIds = signal<Record<string, string>>({});

  protected placementOf(code: string): string {
    return this.placements()[code] ?? '';
  }

  protected place(code: string, groupKey: string): void {
    const next = { ...this.placements() };
    if (groupKey === '') delete next[code];
    else next[code] = groupKey;
    this.placements.set(next);
    this.dirty.set(true);
  }

  private listTypeOf(key: string): string | null {
    return this.facts().find((f) => f.key === key)?.question?.optionsEnumerationType ?? null;
  }

  private async loadValueIds(key: string): Promise<void> {
    const type = this.listTypeOf(key);
    if (type === null) return;
    const rows = await this.lookups.list(type);
    this.valueIds.set(Object.fromEntries(rows.map((r) => [r.key, r.id])));
  }

  /** What this product files each answer under, and the list rows' ids for a save. */
  private async loadPlacements(): Promise<void> {
    await this.enums.load('surrogate_fact');
    const way = this.ownGroupsWay();
    const column = way === -1 ? null : this.wayColumn(way);
    const type = column === null ? null : this.listTypeOf(column.fact);
    if (column === null || type === null) {
      this.placements.set({});
      return;
    }
    const [own, rows] = await Promise.all([
      this.lookups.productGroups(this.key, type),
      this.lookups.list(type),
    ]);
    this.valueIds.set(Object.fromEntries(rows.map((r) => [r.key, r.id])));
    const keys = new Set((column.groups ?? []).map((g) => g.key));
    this.placements.set(
      Object.fromEntries(Object.entries(own).filter(([, group]) => keys.has(group))),
    );
  }

  /** Every answer of the list: its group, or none (which drops a stale own row). */
  private async savePlacements(): Promise<void> {
    const way = this.ownGroupsWay();
    const column = way === -1 ? null : this.wayColumn(way);
    if (column === null) return;
    const type = this.listTypeOf(column.fact);
    if (type === null) return;
    let ids = this.valueIds();
    if (Object.keys(ids).length === 0) {
      const rows = await this.lookups.list(type);
      ids = Object.fromEntries(rows.map((r) => [r.key, r.id]));
      this.valueIds.set(ids);
    }
    const placed = this.placements();
    const assignments = this.optionsOf(column.fact)
      .filter((o) => ids[o.code] !== undefined)
      .map((o) => ({ valueId: ids[o.code]!, parentKey: placed[o.code] ?? null }));
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
    return v.useUplift || v.iScore;
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
    row.patchValue({
      measure,
      op: isChoice
        ? 'oneOf'
        : row.controls.op.value === 'oneOf'
          ? 'atLeast'
          : row.controls.op.value,
      otherFact: '',
      expect: isChoice ? this.optionsOf(measure).map((o) => o.code) : [],
    });
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
    const list =
      this.wayKind(i) === 'classTable'
        ? (this.factOf(fact)?.question?.parentOptions ?? [])
        : this.optionsOf(fact);
    return list.map((o) => ({ key: o.code, label: this.optionLabel(o) }));
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
      if (this.ownGroupsWay() !== -1) await this.savePlacements();
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
    ): TemplateMechanism => ({
      ...(kind === 'flatAmount' ? { kind } : ({ kind, fact } as TemplateMechanism)),
      ...(column ? { column } : {}),
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
      primary: mechanism(v.primaryKind, v.primaryFact, single ? null : v.primaryColumn),
      ...(single && v.primaryColumn ? { secondColumn: v.primaryColumn } : {}),
      ...(!single
        ? { alternatives: v.alternatives.map((way) => mechanism(way.kind, way.fact, way.column)) }
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
