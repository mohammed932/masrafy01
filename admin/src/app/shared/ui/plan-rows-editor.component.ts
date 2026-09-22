import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzIconModule, provideNzIconsPatch } from 'ng-zorro-antd/icon';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { DeleteOutline, PlusOutline, ScissorOutline } from '@ant-design/icons-angular/icons';
import { FigureFieldComponent } from '../income-rule/figure-field.component';
import { RailTabsComponent } from './rail-tabs.component';
import type { RailTabItem } from './rail-tabs.component';
import { group } from '../../core/directives/money-format';
import type { PlanDefaults, RegistryFact } from '../../features/bank-programs/bank-programs.types';
import {
  addPlanCase,
  appendPlanBand,
  planColumnFigureCount,
  planRowsAdviceFor,
  planRowsFrom,
  planSlotCell,
  planSlotOnlyFor,
  planSlotShapeOf,
  planSlotValueKind,
  removePlanBand,
  removePlanColumn,
  setPlanBandEdge,
  setPlanCaseDelta,
  setPlanFigure,
  setPlanSlotFigure,
  splitPlanCell,
  splitPlanCellCount,
  PLAN_SLOTS,
} from './plan-rows.rules';
import type {
  PlanAdvice,
  PlanBand,
  PlanCase,
  PlanSlotKey,
  PlanSlotShape,
  PlanTable,
} from './plan-rows.rules';

/**
 * A destructive intent, handed to the host rather than applied.
 *
 * The host already owns the modal service and already knows how many bank programs read
 * these plans — `clearPlanGrid` on the product page is the precedent, and it confirms only
 * when somebody is reading. Applying a delete here would be a second place that decision is
 * made, and the quieter of the two.
 */
export interface PlanRemoveRequest {
  readonly kind: 'row' | 'column';
  /** Already localized — what the dialog names. */
  readonly what: string;
  readonly figuresLost: number;
  /** The plans as they would be. The host commits this, or does not. */
  readonly next: PlanDefaults | null;
}

/** One rendered column: a whole table narrowed to one figure, or one of its cases. */
interface CardColumn {
  readonly slot: PlanSlotKey;
  /** Index into `PlanTable.columns`. */
  readonly columnIndex: number;
  readonly kind: 'one' | 'case';
  /** True on the first column of a slot — the one that carries the heading. */
  readonly leads: boolean;
  readonly cases: readonly PlanCase[];
  readonly conditional: boolean;
}

/** Which part of the plans is on stage. */
type PlanTab = 'steps' | 'figures' | 'cases';

const PLAN_TABS: readonly PlanTab[] = ['steps', 'figures', 'cases'];

/** One deposit step, with enough of its figures to recognise it by. */
interface BandRow {
  readonly index: number;
  readonly band: PlanBand;
  /** Read-only identity, never a second authority: the figures are edited one tab over. */
  readonly summary: string;
}

/** One answer that is priced differently from the rest of its column. */
interface CaseItem {
  readonly columnIndex: number;
  readonly label: string;
  /** The signed move off the base, or `null` when this table states its cases band by band. */
  readonly delta: string | null;
  /** Display only, for the read-only chip: the stored string is never rewritten. */
  readonly sign: string;
  readonly magnitude: string;
  readonly aria: string;
  readonly removeAria: string;
}

interface CaseGroup {
  readonly slot: PlanSlotKey;
  readonly name: string;
  readonly unit: string | null;
  readonly items: readonly CaseItem[];
}

/**
 * THREE TABS: the deposit steps, the figures, and everything that is an exception to them.
 *
 * ─── What was wrong with one table ────────────────────────────────────────────
 *
 * The card had already been narrowed from nine columns to six, and it still read as a
 * spreadsheet wearing a control panel for a hat. Everything an operator can press that is
 * not a figure had been pushed INTO the column headings: three editable delta chips, four
 * "no band fits" links, four "+ a case" links, and four unlabelled buttons that delete an
 * entire priced table — one of them a pixel from "+ a case". Eighteen controls, counted, in
 * the one row whose job is to name five columns.
 *
 * Header cells bottom-align, so a heading stacked five lines deep sat five lines below one
 * stacked two, and the six column NAMES landed at six different heights. Narrowing was never
 * going to fix that, because the width was not the problem: the header was carrying verbs.
 *
 * So every verb left the table. The header is now a single flat line of names with nothing
 * in it that can be pressed, and the things that were crowding it each got somewhere to
 * live: the ladder got a tab with room to draw, and the exceptions got a tab where they can
 * be read as sentences instead of squeezed into a column heading.
 *
 * ─── Why a rail and not a nested stepper ──────────────────────────────────────
 *
 * There IS an order here — bands before figures — which is the argument the income screen
 * did not have when it made this same choice. The rail still wins on the other half: an
 * operator comes back to change ONE rate, and a stepper turns that into a three-step walk
 * with a second Back/Next pair a few hundred pixels under the page's own. A rail also shows
 * all three counts at once, which is precisely what a stepper hides. It is the same
 * component and the same appearance as the owned-lists rail one section up this page.
 *
 * Figures is the tab that opens, because it is where nearly every edit lands.
 *
 * ─── The grids are still the state ────────────────────────────────────────────
 *
 * Not one line of `plan-rows.rules.ts` changed for this. The shape is still derived per read
 * by `planSlotShapeOf`, every verb is still a pure writer returning the caller's own object
 * when nothing moved, and typing the narrowed figure still CASCADES to the cases so a column
 * cannot silently widen back mid-edit. This is a drawing change, so every property those
 * writers were measured against still holds unchanged.
 */
@Component({
  selector: 'app-plan-rows-editor',
  standalone: true,
  imports: [
    FormsModule,
    FigureFieldComponent,
    RailTabsComponent,
    NzButtonModule,
    NzIconModule,
    NzSelectModule,
  ],
  providers: [provideNzIconsPatch([DeleteOutline, PlusOutline, ScissorOutline])],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (table(); as t) {
      <div class="prt">
        <app-rail-tabs
          appearance="segmented"
          idPrefix="prt"
          [uniform]="true"
          [items]="tabs()"
          [activeId]="tab()"
          [ariaLabel]="tabsAria"
          (select)="onTab($event)"
        />

        <div
          class="prt__panel"
          [id]="'prt-panel-' + tab()"
          role="tabpanel"
          [attr.aria-labelledby]="'prt-tab-' + tab()"
        >
          @switch (tab()) {
            <!-- ─── ① THE DEPOSIT STEPS ─────────────────────────────────────── -->
            @case ('steps') {
              <div class="prt__steps">
                <p class="prt__lede" i18n="@@spd.plan_table.steps_lede">
                  Every plan starts at a deposit. The bar draws where each step sits between nothing
                  down and the whole price.
                </p>

                <!-- A TRACK, not a stub. The old bar painted only its own filled span on
                     transparent, so at 3px under a field it read as an underline artifact
                     rather than as a position on 0-100%. The unpainted track is the half
                     that carries the meaning. -->
                <div class="prt__ladder" aria-hidden="true">
                  @for (row of t.rows; track $index) {
                    <span
                      class="prt__seg"
                      [style.--from.%]="ladderFrom(row.band)"
                      [style.--span.%]="ladderSpan(row.band)"
                    ></span>
                  }
                </div>
                <div class="prt__scale" aria-hidden="true">
                  <span>0%</span>
                  <span>100%</span>
                </div>

                @if (uncoveredNote(); as note) {
                  <p class="prt__note">
                    {{ note }}
                    @if (uncoveredRefused()) {
                      <span i18n="@@spd.plan_table.uncovered_reject"
                        >A customer putting less down is turned away.</span
                      >
                    }
                  </p>
                }

                <ul class="prt__bands" role="list">
                  @for (row of bandRows(); track row.index) {
                    <li class="prt__band">
                      <app-figure-field
                        [fieldId]="'plan-band-' + row.index"
                        [value]="row.band.fromInclusive"
                        (valueChange)="onEdge(row.index, $event)"
                        unit="%"
                        [ariaLabel]="edgeAria(row.index)"
                      />
                      <span class="prt__band-to">{{ bandTail(row.band) }}</span>
                      <span class="prt__band-sum">{{ row.summary }}</span>
                      @if (t.rows.length > 1) {
                        <button
                          type="button"
                          class="prt__x"
                          [attr.aria-label]="removeRowAria(row.index)"
                          (click)="askRemoveRow(row.index)"
                        >
                          <span nz-icon nzType="delete" aria-hidden="true"></span>
                        </button>
                      }
                    </li>
                  }
                </ul>

                <div class="prt__add">
                  <label class="prt__micro" for="prt-new-band" i18n="@@spd.plan_table.add_band"
                    >Add a band from</label
                  >
                  <app-figure-field
                    fieldId="prt-new-band"
                    [value]="newBand()"
                    (valueChange)="newBand.set($event)"
                    unit="%"
                    [ariaLabel]="addBandAria"
                  />
                  <button
                    nz-button
                    nzType="dashed"
                    nzSize="small"
                    type="button"
                    [disabled]="!canAddBand()"
                    (click)="onAddBand()"
                  >
                    <span nz-icon nzType="plus" aria-hidden="true"></span>
                    <span i18n="@@spd.plan_table.add_band_do">Add</span>
                  </button>
                </div>
              </div>
            }

            <!-- ─── ② THE FIGURES ───────────────────────────────────────────── -->
            @case ('figures') {
              <div class="prt__figures">
                <!-- SAID ONCE, ABOVE THE TABLE. These were three editable chips inside the
                     RATE heading, which is what made that heading five lines tall and every
                     other column name sit at a different height. Read-only here; the
                     Exceptions tab is where they are typed. -->
                @if (caseGroups().length > 0) {
                  <div class="prt__strips">
                    <h4 class="prt__micro" i18n="@@spd.plan_table.sec_cases">
                      Some answers get their own figure
                    </h4>
                    @for (g of caseGroups(); track g.slot) {
                      <p class="prt__strip">
                        <span class="prt__strip-name">{{ g.name }}</span>
                        @for (item of g.items; track item.columnIndex) {
                          <span class="prt__chip">
                            {{ item.label }}
                            @if (item.delta !== null) {
                              <b class="prt__chip-n">{{ item.sign }}{{ item.magnitude }}</b>
                            } @else {
                              <b class="prt__chip-n" i18n="@@spd.plan_table.per_band"
                                >band by band</b
                              >
                            }
                          </span>
                        }
                        <button
                          type="button"
                          class="prt__link"
                          (click)="goCases()"
                          i18n="@@spd.plan_table.change"
                        >
                          Change
                        </button>
                      </p>
                    }
                  </div>
                }

                <!-- AN ILLUSTRATION, AND SAID TO BE ONE. Typed here, stored nowhere, sent
                     nowhere, and it turns every share into the money it means. Empty by
                     default, because a share is the one figure on this card an operator
                     cannot sanity-check by looking at it.

                     ABOVE the table, because it annotates it: a control you set before
                     reading is useless below what it changes, and it sat under 460px of
                     rows where nobody looking at a share would find it. -->
                <div class="prt__price">
                  <label class="prt__micro" for="prt-price" i18n="@@spd.plan_table.price"
                    >Show it for a car at</label
                  >
                  <app-figure-field
                    fieldId="prt-price"
                    [value]="price()"
                    (valueChange)="price.set($event)"
                    unit="EGP"
                    [money]="true"
                    [ariaLabel]="priceAria"
                  />
                </div>

                <!-- The table scrolls in ITS OWN box: five columns is wider than a phone, and
                     the house measures page overflow at 0 on every screen. -->
                <div class="prt__scroll">
                  <table class="prt__table">
                    <thead>
                      <tr>
                        <th class="prt__dep-head" scope="col">
                          <span class="prt__head-name" i18n="@@spd.plan_table.deposit"
                            >Down payment</span
                          >
                        </th>
                        @for (column of cardColumns(); track $index) {
                          <th class="prt__head" scope="col">
                            <span class="prt__head-name">{{ headName(column) }}</span>
                          </th>
                        }
                        <th class="prt__act-head"></th>
                      </tr>
                    </thead>

                    <tbody>
                      @for (row of t.rows; track $index; let r = $index) {
                        <tr>
                          <!-- The band is READ here and typed on the Steps tab. As a text
                               box it put an input on every row of a table of figures; as a
                               chip it names the plan and takes the operator to the one
                               place a boundary is moved. -->
                          <th class="prt__dep" scope="row">
                            <button
                              type="button"
                              class="prt__bandchip"
                              [attr.aria-label]="editBandAria(r)"
                              (click)="goBand(r)"
                            >
                              {{ bandChip(row.band) }}
                            </button>
                            @if (rowMoney(r); as money) {
                              <span class="prt__money">{{ money }}</span>
                            }
                          </th>

                          @for (column of cardColumns(); track $index; let c = $index) {
                            @if (showsCell(r, c)) {
                              <td class="prt__cell" [attr.rowspan]="spanOf(r, c)">
                                <app-figure-field
                                  [fieldId]="'plan-' + column.slot + '-' + c + '-' + r"
                                  [value]="cellValue(r, c)"
                                  (valueChange)="onFigure(r, c, $event)"
                                  [unit]="unitOf(column.slot)"
                                  [money]="isMoney(column.slot)"
                                  [tone]="cellValue(r, c) === '' ? 'blank' : 'default'"
                                  [ariaLabel]="cellAria(r, c)"
                                  placeholder="—"
                                  [placeholderNote]="blankNote"
                                />

                                <!-- ONE line, always the same height. These were three
                                     stacked blocks, so the row carrying a condition stood
                                     half again as tall as its neighbours and the table lost
                                     its rhythm. It truncates; the full text is on the cell's
                                     accessible name and on the Exceptions tab. -->
                                <span class="prt__sub">
                                  @if (subLine(r, c); as line) {
                                    <span class="prt__sub-text" [attr.title]="subTitle(r, c)">{{
                                      line
                                    }}</span>
                                  }
                                  @if (isCovering(r, c)) {
                                    <button
                                      type="button"
                                      class="prt__split"
                                      [attr.aria-label]="splitAria(r, c)"
                                      (click)="onSplit(r, c)"
                                    >
                                      <span nz-icon nzType="scissor" aria-hidden="true"></span>
                                    </button>
                                  }
                                </span>
                              </td>
                            }
                          }

                          <td class="prt__act">
                            @if (t.rows.length > 1) {
                              <button
                                type="button"
                                class="prt__x is-quiet"
                                [attr.aria-label]="removeRowAria(r)"
                                (click)="askRemoveRow(r)"
                              >
                                <span nz-icon nzType="delete" aria-hidden="true"></span>
                              </button>
                            }
                          </td>
                        </tr>
                      }
                    </tbody>
                  </table>
                </div>

                <!-- WHAT IS NOT HERE, SAID IN WORDS. The unstated tables used to be ghost
                     columns inside the table; they are one sentence under it now. Starting
                     one is "Edit one table at a time" on the page that hosts this card. -->
                @if (unstatedSlots(); as waiting) {
                  @if (waiting.length > 0) {
                    <p class="prt__foot">
                      <span>{{ unstatedLabel() }}</span>
                    </p>
                  }
                }
              </div>
            }

            <!-- ─── ③ THE EXCEPTIONS ────────────────────────────────────────── -->
            @case ('cases') {
              <div class="prt__cases">
                @if (caseGroups().length > 0 || variableSlots().length > 0) {
                  <section class="prt__sec">
                    <h4 class="prt__micro" i18n="@@spd.plan_table.sec_cases">
                      Some answers get their own figure
                    </h4>

                    @for (g of caseGroups(); track g.slot) {
                      <p class="prt__sec-name">{{ g.name }}</p>
                      <ul class="prt__rows" role="list">
                        @for (item of g.items; track item.columnIndex) {
                          <li class="prt__row">
                            <span class="prt__row-name">{{ item.label }}</span>
                            @if (item.delta !== null) {
                              <app-figure-field
                                [fieldId]="'plan-delta-' + item.columnIndex"
                                [value]="item.delta"
                                (valueChange)="onDelta(g.slot, item.columnIndex, $event)"
                                [unit]="g.unit"
                                [signed]="true"
                                [ariaLabel]="item.aria"
                              />
                            } @else {
                              <span class="prt__row-note" i18n="@@spd.plan_table.per_band"
                                >band by band</span
                              >
                            }
                            <button
                              type="button"
                              class="prt__x"
                              [attr.aria-label]="item.removeAria"
                              (click)="askRemoveColumn(item.columnIndex)"
                            >
                              <span nz-icon nzType="delete" aria-hidden="true"></span>
                            </button>
                          </li>
                        }
                      </ul>
                    }

                    @if (caseGroups().length > 0) {
                      <p class="prt__hint" i18n="@@spd.plan_table.delta_hint">
                        A minus takes the figure down for that answer and a plus puts it up. It
                        moves every band at once.
                      </p>
                    }

                    @if (variableSlots().length > 0) {
                      <!-- A VISIBLE NAME over each, and no placeholder standing in for one.
                           antd paints its placeholder at 2.0:1 in light mode, so a control
                           named only by one is a control an operator cannot read; the same
                           words above the box are body-grade ink and survive being picked. -->
                      <div class="prt__picker">
                        <span class="prt__pickwrap">
                          <span class="prt__micro">{{ caseSlotLabel }}</span>
                          <nz-select
                            class="prt__pick"
                            [ngModel]="caseSlot()"
                            (ngModelChange)="openCase($event)"
                            [ngModelOptions]="{ standalone: true }"
                            [attr.aria-label]="caseSlotAria"
                          >
                            @for (slot of variableSlots(); track slot) {
                              <nz-option [nzValue]="slot" [nzLabel]="headNameOf(slot)"></nz-option>
                            }
                          </nz-select>
                        </span>
                        <span class="prt__pickwrap">
                          <span class="prt__micro">{{ caseFactLabel }}</span>
                          <nz-select
                            class="prt__pick"
                            nzShowSearch
                            [ngModel]="caseFact()"
                            (ngModelChange)="onCaseFact($event)"
                            [ngModelOptions]="{ standalone: true }"
                            [nzDisabled]="caseSlot() === null"
                            [attr.aria-label]="caseFactAria"
                          >
                            @for (fact of caseFacts(); track fact.key) {
                              <nz-option [nzValue]="fact.key" [nzLabel]="fact.label"></nz-option>
                            }
                          </nz-select>
                        </span>
                        <span class="prt__pickwrap">
                          <span class="prt__micro">{{ caseOptionLabel }}</span>
                          <nz-select
                            class="prt__pick"
                            [ngModel]="caseOption()"
                            (ngModelChange)="caseOption.set($event)"
                            [ngModelOptions]="{ standalone: true }"
                            [nzDisabled]="caseFact() === null"
                            [attr.aria-label]="caseOptionAria"
                          >
                            @for (option of caseOptions(); track option.code) {
                              <nz-option
                                [nzValue]="option.code"
                                [nzLabel]="option.label"
                              ></nz-option>
                            }
                          </nz-select>
                        </span>
                        <button
                          nz-button
                          nzType="dashed"
                          nzSize="small"
                          type="button"
                          [disabled]="!canAddCase()"
                          (click)="onAddCase()"
                        >
                          <span nz-icon nzType="plus" aria-hidden="true"></span>
                          <span i18n="@@spd.plan_table.vary_add">Add the case</span>
                        </button>
                      </div>
                    }
                  </section>
                }
              </div>
            }
          }
        </div>

        <!-- WHAT THE CARD CANNOT SHOW BY BEING LOOKED AT, and shown on every tab so a
             refusal is never behind a closed one. Advice, never a gate — the server accepts
             every one of these, and a mirror that refused them would tell an operator their
             card is unsavable with nothing to fix. -->
        @if (advice().length > 0) {
          <ul class="prt__advice" role="status">
            @for (item of advice(); track $index) {
              <li>{{ adviceLabel(item) }}</li>
            }
          </ul>
        }
      </div>
    }
  `,
  styles: [
    `
      .prt {
        display: grid;
        gap: var(--space-4);
      }

      .prt__panel {
        display: grid;
        gap: var(--space-3);
      }

      .prt__steps,
      .prt__figures,
      .prt__cases {
        display: grid;
        gap: var(--space-3);
      }

      .prt__lede,
      .prt__note,
      .prt__hint {
        margin: 0;
        max-inline-size: 62ch;
        color: var(--color-text-secondary);
        font-size: var(--text-sm);
      }

      .prt__hint {
        font-size: var(--text-xs);
      }

      .prt__note {
        font-size: var(--text-xs);
      }

      /* ─── THE LADDER ───────────────────────────────────────────────────────
         A track and the steps on it. The unpainted part is the point: on this product
         nothing is stated below 20%, and that gap is the only one the projection can
         produce, because rows are built from consecutive edges. */
      .prt__ladder {
        position: relative;
        block-size: 12px;
        border-radius: var(--radius-pill);
        background: var(--color-surface-muted);
        overflow: hidden;
      }

      /* Logical, so RTL mirrors itself. The old bar used transform: scaleX(-1), which only
         worked while it had nothing inside it to flip. */
      .prt__seg {
        position: absolute;
        inset-block: 0;
        inset-inline-start: var(--from);
        inline-size: var(--span);
        background: color-mix(in oklab, var(--primary) 28%, transparent);
        border-inline-start: 2px solid var(--primary);
      }

      .prt__scale {
        display: flex;
        justify-content: space-between;
        color: var(--color-text-secondary);
        font-size: var(--text-xs);
        font-variant-numeric: tabular-nums;
      }

      /* ─── THE BAND LIST ────────────────────────────────────────────────────── */
      .prt__bands,
      .prt__rows {
        display: grid;
        gap: 0;
        margin: 0;
        padding: 0;
        list-style: none;
      }

      .prt__band {
        display: flex;
        align-items: center;
        flex-wrap: wrap;
        gap: var(--space-2) var(--space-3);
        padding-block: var(--space-2);
        border-block-end: 1px solid var(--border-subtle);
      }

      .prt__band-to {
        color: var(--color-text-secondary);
        font-size: var(--text-sm);
      }

      .prt__band-sum {
        margin-inline-start: auto;
        color: var(--color-text-secondary);
        font-size: var(--text-xs);
        font-variant-numeric: tabular-nums;
      }

      .prt__add {
        display: flex;
        align-items: center;
        flex-wrap: wrap;
        gap: var(--space-2);
      }

      .prt__micro {
        margin: 0;
        color: var(--color-text-secondary);
        font-size: var(--text-xs);
        font-weight: var(--font-semibold);
        letter-spacing: 0.06em;
        text-transform: uppercase;
      }

      /* ─── THE DELTA STRIP ──────────────────────────────────────────────────── */
      .prt__strips {
        display: grid;
        gap: var(--space-1);
      }

      .prt__strip {
        display: flex;
        align-items: center;
        flex-wrap: wrap;
        gap: var(--space-1) var(--space-2);
        margin: 0;
        font-size: var(--text-xs);
      }

      .prt__strip-name {
        color: var(--color-text-secondary);
        font-weight: var(--font-semibold);
      }

      /* The house text-chip: a chip darkens its own ground, so its words are secondary ink
         and never tertiary. */
      .prt__chip {
        display: inline-flex;
        align-items: baseline;
        gap: var(--space-1);
        padding-inline: var(--space-2);
        padding-block: 1px;
        border-radius: var(--radius-pill);
        background: var(--color-surface-muted);
        color: var(--color-text-secondary);
        white-space: nowrap;
      }

      .prt__chip-n {
        color: var(--color-text-primary);
        font-weight: var(--font-semibold);
        font-variant-numeric: tabular-nums;
      }

      /* ─── THE TABLE ────────────────────────────────────────────────────────── */
      .prt__scroll {
        overflow-x: auto;
      }

      .prt__table {
        width: 100%;
        border-collapse: collapse;
      }

      .prt__table th,
      .prt__table td {
        padding: var(--space-2);
        text-align: start;
        vertical-align: top;
      }

      /* BASELINE, not bottom. Bottom-aligning cells whose contents were five, three and two
         lines tall is what put the six column names at six different heights; there is
         nothing in a heading now but the name, and this keeps it that way if anything is
         ever added back. */
      .prt__table thead th {
        vertical-align: baseline;
        border-block-end: 1px solid var(--color-border-default);
      }

      .prt__head-name {
        display: block;
        font-size: var(--text-xs);
        font-weight: var(--font-semibold);
        letter-spacing: 0.04em;
        text-transform: uppercase;
        /* Secondary, never tertiary: tertiary measures 3.83:1 on a card in light mode, and
           every one of these names a figure somebody is about to type. */
        color: var(--color-text-secondary);
        white-space: nowrap;
      }

      .prt__table tbody td,
      .prt__table tbody th {
        border-block-end: 1px solid var(--border-subtle);
      }

      .prt__table tbody tr:hover {
        background: var(--bg-subtle);
      }

      .prt__dep {
        white-space: nowrap;
      }

      /* The deposit, in money, on the row it belongs to. It used to be half a sentence
         inside the We-finance CELL, which put the deposit the customer pays in the column
         about what the bank lends and left the band -- the thing the figure is derived
         from -- saying nothing. */
      .prt__money {
        display: block;
        margin-block-start: var(--space-1);
        color: var(--color-text-secondary);
        font-size: var(--text-xs);
        font-variant-numeric: tabular-nums;
        font-weight: var(--font-normal);
      }

      .prt__price {
        display: flex;
        align-items: center;
        gap: var(--space-2) var(--space-3);
        flex-wrap: wrap;
      }

      .prt__foot {
        display: flex;
        align-items: baseline;
        gap: var(--space-2);
        flex-wrap: wrap;
        margin: 0;
        color: var(--color-text-secondary);
        font-size: var(--text-xs);
      }

      .prt__bandchip {
        display: inline-flex;
        align-items: center;
        min-block-size: 28px;
        padding-inline: var(--space-3);
        border: 1px solid transparent;
        border-radius: var(--radius-pill);
        background: var(--color-surface-muted);
        color: var(--color-text-primary);
        font: inherit;
        font-size: var(--text-sm);
        font-weight: var(--font-semibold);
        font-variant-numeric: tabular-nums;
        white-space: nowrap;
        cursor: pointer;
      }

      .prt__bandchip:hover {
        border-color: var(--color-border-strong);
      }

      .prt__bandchip:focus-visible {
        outline: var(--focus-ring-width) solid var(--focus-ring-color);
        outline-offset: var(--focus-ring-offset);
      }

      /* ONE line under every figure, whether it has anything to say or not. Reserving it is
         what keeps the rows the same height; the alternative is a table whose rhythm depends
         on which cell happens to carry a sentence. */
      .prt__sub {
        display: flex;
        align-items: center;
        gap: var(--space-1);
        min-block-size: 1.25rem;
        margin-block-start: var(--space-1);
        max-inline-size: 15rem;
        color: var(--color-text-secondary);
        font-size: var(--text-xs);
        font-variant-numeric: tabular-nums;
      }

      .prt__sub-text {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .prt__dep-head,
      .prt__act-head,
      .prt__act {
        inline-size: 1%;
        white-space: nowrap;
      }

      /* ─── BUTTONS ──────────────────────────────────────────────────────────── */
      .prt__x,
      .prt__split {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        inline-size: 1.5rem;
        block-size: 1.5rem;
        padding: 0;
        border: 0;
        border-radius: var(--radius-sm);
        background: none;
        color: var(--color-text-secondary);
        cursor: pointer;
      }

      .prt__x:hover,
      .prt__split:hover {
        background: var(--color-surface-muted);
        color: var(--color-text-primary);
      }

      .prt__x:focus-visible,
      .prt__split:focus-visible {
        outline: var(--focus-ring-width) solid var(--focus-ring-color);
        outline-offset: var(--focus-ring-offset);
      }

      /* Recedes until the row is under the pointer or holds the caret. OPACITY only, never
         display or visibility, so it stays in the tab order and a keyboard reaches it
         without a mouse ever moving. */
      .prt__split,
      .prt__x.is-quiet {
        opacity: 0.55;
        transition: opacity var(--motion-duration-fast) var(--motion-easing-standard);
      }

      .prt__table tbody tr:hover .prt__x.is-quiet,
      .prt__table tbody tr:focus-within .prt__x.is-quiet,
      .prt__cell:hover .prt__split,
      .prt__cell:focus-within .prt__split,
      .prt__split:focus-visible {
        opacity: 1;
      }

      .prt__link {
        padding: 0;
        border: 0;
        background: none;
        font: inherit;
        font-size: var(--text-xs);
        color: var(--primary);
        cursor: pointer;
      }

      .prt__link:hover {
        color: var(--primary-hover);
        text-decoration: underline;
        text-underline-offset: 0.2em;
      }

      .prt__link:focus-visible {
        outline: var(--focus-ring-width) solid var(--focus-ring-color);
        outline-offset: var(--focus-ring-offset);
        border-radius: var(--radius-sm);
      }

      /* ─── THE EXCEPTIONS TAB ───────────────────────────────────────────────── */
      .prt__sec {
        display: grid;
        gap: var(--space-2);
        padding-block: var(--space-3);
        border-block-start: 1px solid var(--border-subtle);
      }

      .prt__sec:first-child {
        padding-block-start: 0;
        border-block-start: 0;
      }

      .prt__sec-name {
        margin: 0;
        color: var(--color-text-primary);
        font-size: var(--text-sm);
        font-weight: var(--font-semibold);
      }

      /* CAPPED, because the bin belongs to the row. The auto inline-start margin below pushes
         the delete to the end of the row, and the row was the card's full width -- so on a
         1440 screen the bin for "China +2" sat 740px from the field it removes, over empty
         ground, aligned with four other bins for four other things. Capped at 46rem it is
         still end-aligned and still one straight column, and it is beside its own figure. */
      .prt__row {
        display: flex;
        align-items: center;
        flex-wrap: wrap;
        gap: var(--space-2) var(--space-3);
        max-inline-size: 46rem;
        padding-block: var(--space-2);
        border-block-end: 1px solid var(--border-subtle);
      }

      .prt__row-name {
        min-inline-size: 10rem;
        color: var(--color-text-primary);
        font-size: var(--text-sm);
        font-weight: var(--font-semibold);
      }

      .prt__row-note {
        color: var(--color-text-secondary);
        font-size: var(--text-xs);
      }

      .prt__row > .prt__x,
      .prt__row > button[nz-button] {
        margin-inline-start: auto;
      }

      .prt__picker {
        display: flex;
        align-items: flex-end;
        flex-wrap: wrap;
        gap: var(--space-2) var(--space-3);
        padding-block-start: var(--space-2);
      }

      .prt__pickwrap {
        display: grid;
        gap: var(--space-1);
      }

      .prt__pick {
        min-width: 11rem;
      }

      /* ─── ADVICE ───────────────────────────────────────────────────────────── */
      .prt__advice {
        display: grid;
        gap: var(--space-1);
        margin: 0;
        padding: var(--space-2) var(--space-3);
        padding-inline-start: var(--space-5);
        border-radius: var(--radius-sm);
        background: var(--color-warning-bg);
        /* The wash carries the state; the words stay primary ink, because warning ink on its
           own wash measures 2.53:1. */
        color: var(--color-text-primary);
        font-size: var(--text-xs);
      }

      /* A pointer can hit a 24px icon button; a thumb cannot — and a thumb has no hover, so
         nothing that recedes may recede here. */
      @media (hover: none) {
        .prt__x,
        .prt__split,
        .prt__link {
          min-inline-size: 44px;
          min-block-size: 44px;
        }

        .prt__split,
        .prt__x.is-quiet {
          opacity: 1;
        }
      }

      @media (prefers-reduced-motion: reduce) {
        .prt__split,
        .prt__x.is-quiet {
          transition: none;
        }
      }
    `,
  ],
})
export class PlanRowsEditorComponent {
  readonly grids = input.required<PlanDefaults | null>();
  readonly facts = input.required<readonly RegistryFact[]>();

  readonly gridsChange = output<PlanDefaults | null>();
  readonly removeRequest = output<PlanRemoveRequest>();

  /** The whole model: a projection of the grids, recomputed on every read. */
  readonly table = computed<PlanTable | null>(() => planRowsFrom(this.grids()));

  private readonly isAr = document.documentElement.lang.startsWith('ar');

  /** Figures opens, because that is where nearly every edit lands. */
  protected readonly tab = signal<PlanTab>('figures');

  protected readonly newBand = signal('');
  /** Typed for the worked example, stored nowhere and sent nowhere. */
  protected readonly price = signal('');
  protected readonly caseSlot = signal<PlanSlotKey | null>(null);
  protected readonly caseFact = signal<string | null>(null);
  protected readonly caseOption = signal<string | null>(null);

  protected readonly blankNote = $localize`:@@spd.plan_table.blank_note:Blank — this table says nothing for that band, so each bank's own figure stands.`;
  // Visible labels, not placeholders — see the picker's own note in the template.
  protected readonly caseFactLabel = $localize`:@@spd.plan_table.pick_answer:Which answer`;
  protected readonly caseOptionLabel = $localize`:@@spd.plan_table.pick_case:Which one`;
  protected readonly caseFactAria = $localize`:@@spd.plan_table.pick_answer_aria:Which answer it changes with`;
  protected readonly caseOptionAria = $localize`:@@spd.plan_table.pick_case_aria:Which answer gets its own figure`;
  protected readonly caseSlotLabel = $localize`:@@spd.plan_table.pick_slot:Which figure`;
  protected readonly caseSlotAria = $localize`:@@spd.plan_table.pick_slot_aria:Which figure changes with the answer`;
  protected readonly addBandAria = $localize`:@@spd.plan_table.add_band_aria:The new band starts at this percent`;
  protected readonly priceAria = $localize`:@@spd.plan_table.price_aria:Car price for the worked example, in pounds`;
  protected readonly tabsAria = $localize`:@@spd.plan_table.tabs_aria:Which part of the plans to edit`;

  // ─── THE RAIL ──────────────────────────────────────────────────────────────

  protected readonly tabs = computed<readonly RailTabItem[]>(() => [
    {
      id: 'steps',
      label: $localize`:@@spd.plan_table.tab_steps:Deposit steps`,
      count: this.table()?.rows.length ?? 0,
      countLabel: $localize`:@@spd.plan_table.count_bands:steps`,
    },
    {
      id: 'figures',
      label: $localize`:@@spd.plan_table.tab_figures:Figures`,
      count: this.figureBoxCount(),
      countLabel: $localize`:@@spd.plan_table.count_figures:figures`,
    },
    {
      id: 'cases',
      label: $localize`:@@spd.plan_table.tab_cases:Exceptions`,
      count: this.exceptionCount(),
      countLabel: $localize`:@@spd.plan_table.count_cases:exceptions`,
    },
  ]);

  protected onTab(id: string): void {
    const next = PLAN_TABS.find((candidate) => candidate === id);
    if (next !== undefined) this.tab.set(next);
  }

  protected goCases(): void {
    this.tab.set('cases');
  }

  /**
   * Take the operator to the one place a boundary is moved, and put the caret in it.
   *
   * The panel for the other tab is not in the DOM yet when this runs, so the focus waits a
   * turn. `rail-tabs` reaches for `getElementById` the same way when its arrow keys move.
   */
  protected goBand(rowIndex: number): void {
    this.tab.set('steps');
    setTimeout(() => document.getElementById(`plan-band-${rowIndex}`)?.focus(), 0);
  }

  /** What the Figures tab actually draws — the boxes on screen, not the cells behind them. */
  private figureBoxCount(): number {
    const t = this.table();
    if (t === null) return 0;
    let n = 0;
    t.rows.forEach((_row, r) => {
      this.cardColumns().forEach((column, c) => {
        if (this.showsCell(r, c)) n += 1;
      });
    });
    return n;
  }

  /** The tables this product does not state — no column, one sentence, one way in. */
  protected readonly unstatedSlots = computed<readonly PlanSlotKey[]>(() => {
    const t = this.table();
    if (t === null) return [];
    return PLAN_SLOTS.filter((slot) => !t.slots.includes(slot));
  });

  protected unstatedLabel(): string {
    const names = this.unstatedSlots().map((slot) => this.headNameOf(slot));
    const list = names.join(' · ');
    return $localize`:@@spd.plan_table.unstated:Not stated here, so each bank's own figure stands: ${list}:tables:.`;
  }

  private exceptionCount(): number {
    return this.caseGroups().reduce((n, g) => n + g.items.length, 0);
  }

  // ─── SHAPE ─────────────────────────────────────────────────────────────────

  private readonly shapes = computed<ReadonlyMap<PlanSlotKey, PlanSlotShape>>(() => {
    const t = this.table();
    const out = new Map<PlanSlotKey, PlanSlotShape>();
    if (t === null) return out;
    for (const slot of t.slots) out.set(slot, planSlotShapeOf(t, slot));
    return out;
  });

  /**
   * The columns actually drawn: one per STATED figure, except where a table's cases cannot
   * be said in one line — then that table alone keeps a column per case.
   *
   * An unstated table draws NO column. It used to keep a narrow ghost one holding a dashed
   * "State it", on the reasoning that the card should be the same width on every product and
   * the way to start a table should be where its figure would go. Measured, that column cost
   * 119px of a 1062px table to hold one button — and, because it was a single cell spanning
   * every row, it carried no bottom border, so it BROKE the row rule of every row in the
   * table into two disconnected segments. A table of five plans that does not draw five rows
   * is a worse trade than a column that is not there. The note under this table names the
   * ones that are waiting; starting one is "Edit one table at a time" on the host page.
   */
  protected readonly cardColumns = computed<readonly CardColumn[]>(() => {
    const t = this.table();
    if (t === null) return [];
    const out: CardColumn[] = [];
    for (const slot of PLAN_SLOTS) {
      const shape = this.shapes().get(slot);
      if (shape === undefined) continue;
      if (shape.kind === 'detailed') {
        shape.columns.forEach((columnIndex, index) => {
          out.push({
            slot,
            columnIndex,
            kind: 'case',
            leads: index === 0,
            cases: [],
            conditional: false,
          });
        });
        continue;
      }
      out.push({
        slot,
        columnIndex: shape.baseColumn,
        kind: 'one',
        leads: true,
        cases: shape.kind === 'simple' ? shape.cases : [],
        conditional: shape.kind === 'condition',
      });
    }
    return out;
  });

  protected readonly advice = computed<readonly PlanAdvice[]>(() => {
    const t = this.table();
    return t === null ? [] : planRowsAdviceFor(t);
  });

  // ─── TAB ①: THE DEPOSIT STEPS ──────────────────────────────────────────────

  protected readonly bandRows = computed<readonly BandRow[]>(() => {
    const t = this.table();
    if (t === null) return [];
    return t.rows.map((row, index) => ({
      index,
      band: row.band,
      summary: this.rowSummary(index),
    }));
  });

  /**
   * Enough of a row's figures to recognise which plan it is, while the eye is on the ladder.
   *
   * READ-ONLY and deliberately not a second authority: it is composed from the same
   * `planSlotCell` the Figures tab types into, so it cannot disagree with it.
   */
  private rowSummary(rowIndex: number): string {
    const t = this.table();
    if (t === null) return '';
    const parts: string[] = [];
    for (const slot of t.slots) {
      const shape = this.shapes().get(slot);
      if (shape === undefined) continue;
      const value = planSlotCell(t, shape, rowIndex)?.value ?? '';
      if (value === '') continue;
      const unit = this.unitOf(slot);
      const shown = this.isMoney(slot) ? group(value) : value;
      parts.push(unit === null ? shown : `${shown}${unit === '%' ? '' : ' '}${unit}`);
    }
    return parts.join(' · ');
  }

  /** The one gap the projection can produce: below the lowest band nothing is stated. */
  protected uncoveredNote(): string | null {
    const first = this.table()?.rows[0]?.band;
    if (first === undefined) return null;
    const from = Number(first.fromInclusive);
    if (!Number.isFinite(from) || from <= 0) return null;
    return $localize`:@@spd.plan_table.uncovered:Nothing is stated below ${first.fromInclusive}:from:%.`;
  }

  protected uncoveredRefused(): boolean {
    return this.table()?.onNoMatch['rateByFact'] === 'reject';
  }

  // ─── TAB ③: THE EXCEPTIONS ─────────────────────────────────────────────────

  protected readonly caseGroups = computed<readonly CaseGroup[]>(() => {
    const t = this.table();
    if (t === null) return [];
    const out: CaseGroup[] = [];
    for (const slot of t.slots) {
      const shape = this.shapes().get(slot);
      if (shape === undefined) continue;
      const items: CaseItem[] = [];
      if (shape.kind === 'simple') {
        for (const item of shape.cases) {
          const label = this.caseLabel(slot, item);
          const raw = item.delta.trim();
          items.push({
            columnIndex: item.columnIndex,
            label,
            delta: item.delta,
            sign: raw.startsWith('-') ? '−' : '+',
            magnitude: raw.replace(/^[-+]/, ''),
            aria: this.deltaAria(slot, item),
            removeAria: this.removeCaseAria(label),
          });
        }
      } else if (shape.kind === 'detailed') {
        // A case that is not a uniform move keeps its own column on the Figures tab, so
        // there is no one delta to type here — but it is still the operator's to remove,
        // and until now nothing anywhere offered that.
        shape.columns.forEach((columnIndex, index) => {
          if (index === 0) return;
          const column = t.columns[columnIndex];
          if (column === undefined) return;
          const label = this.extraLabel(slot, column.extra);
          items.push({
            columnIndex,
            label,
            delta: null,
            sign: '',
            magnitude: '',
            aria: '',
            removeAria: this.removeCaseAria(label),
          });
        });
      }
      if (items.length > 0) {
        items.sort((a, b) => a.columnIndex - b.columnIndex);
        out.push({ slot, name: this.headNameOf(slot), unit: this.unitOf(slot), items });
      }
    }
    return out;
  });

  /** The tables a case can be added to: stated, and not already stating one per band. */
  protected readonly variableSlots = computed<readonly PlanSlotKey[]>(() =>
    (this.table()?.slots ?? []).filter((slot) => this.canVary(slot)),
  );

  // ─── LABELS ────────────────────────────────────────────────────────────────

  protected headNameOf(slot: PlanSlotKey): string {
    switch (slot) {
      case 'rateByFact':
        return $localize`:@@spd.plan_table.col_rate:Rate`;
      case 'maxMonthsByFact':
        return $localize`:@@spd.plan_table.col_max_months:Longest term`;
      case 'minMonthsByFact':
        return $localize`:@@spd.plan_table.col_min_months:Shortest term`;
      case 'ltvCeilingByFact':
        return $localize`:@@spd.plan_table.col_ltv:We finance`;
      case 'minAmountByFact':
        return $localize`:@@spd.plan_table.col_floor:Smallest loan`;
    }
  }

  protected headName(column: CardColumn): string {
    if (column.kind !== 'case' || column.leads) return this.headNameOf(column.slot);
    return this.extraLabel(column.slot, this.table()?.columns[column.columnIndex]?.extra ?? []);
  }

  protected unitOf(slot: PlanSlotKey): string | null {
    switch (planSlotValueKind(slot)) {
      case 'ratePercent':
      case 'sharePercent':
        return '%';
      case 'months':
        return $localize`:@@spd.plan_table.unit_months:mo`;
      case 'amountEGP':
        return null;
    }
  }

  protected isMoney(slot: PlanSlotKey): boolean {
    return planSlotValueKind(slot) === 'amountEGP';
  }

  /** What one case is for, read off the keys the stored table holds. No option code lives here. */
  private extraLabel(slot: PlanSlotKey, extra: readonly (string | null)[]): string {
    const axes = this.table()?.extraAxes[slot] ?? [];
    const parts: string[] = [];
    extra.forEach((code, index) => {
      if (code === null) return;
      parts.push(this.optionLabel(axes[index]?.factKey ?? '', code));
    });
    return parts.join(' · ');
  }

  private optionLabel(factKey: string, code: string): string {
    const fact = this.facts().find((f) => f.key === factKey);
    const option = fact?.question?.options.find((o) => o.code === code);
    if (option === undefined) return code;
    return this.isAr ? option.labelAr : option.labelEn;
  }

  protected caseLabel(slot: PlanSlotKey, item: PlanCase): string {
    return this.extraLabel(slot, item.extra);
  }

  /** The upper edge, said in words — it is the next band's floor, so it is never typed. */
  protected bandTail(band: PlanBand): string {
    return band.toExclusive === null
      ? $localize`:@@spd.plan_table.and_above:and above`
      : $localize`:@@spd.plan_table.up_to:up to ${band.toExclusive}:to:%`;
  }

  /** The compact form, for the row header on the Figures tab. */
  protected bandChip(band: PlanBand): string {
    return band.toExclusive === null
      ? $localize`:@@spd.plan_table.chip_open:${band.fromInclusive}:from:%+`
      : $localize`:@@spd.plan_table.chip_range:${band.fromInclusive}:from:–${band.toExclusive}:to:%`;
  }

  private bandLabel(band: PlanBand): string {
    return band.toExclusive === null
      ? $localize`:@@spd.plan_table.band_open:${band.fromInclusive}:from:% and above`
      : $localize`:@@spd.plan_table.band_range:${band.fromInclusive}:from:% to under ${band.toExclusive}:to:%`;
  }

  protected ladderFrom(band: PlanBand): number {
    return Math.max(0, Math.min(100, Number(band.fromInclusive) || 0));
  }

  protected ladderSpan(band: PlanBand): number {
    const to = band.toExclusive === null ? 100 : Number(band.toExclusive);
    return Math.max(1, Math.min(100, (Number.isFinite(to) ? to : 100) - this.ladderFrom(band)));
  }

  // ─── CELLS ─────────────────────────────────────────────────────────────────

  private cellOf(rowIndex: number, columnIndex: number) {
    const t = this.table();
    const column = this.cardColumns()[columnIndex];
    if (t === null || column === undefined) return null;
    if (column.kind === 'case') return t.rows[rowIndex]?.cells[column.columnIndex] ?? null;
    const shape = this.shapes().get(column.slot);
    return shape === undefined ? null : planSlotCell(t, shape, rowIndex);
  }

  protected cellValue(rowIndex: number, columnIndex: number): string {
    return this.cellOf(rowIndex, columnIndex)?.value ?? '';
  }

  protected showsCell(rowIndex: number, columnIndex: number): boolean {
    const origin = this.cellOf(rowIndex, columnIndex)?.origin;
    if (origin === undefined) return false;
    return origin.kind !== 'covering' || origin.isFirstRow;
  }

  protected spanOf(rowIndex: number, columnIndex: number): number | null {
    const origin = this.cellOf(rowIndex, columnIndex)?.origin;
    return origin !== undefined && origin.kind === 'covering' && origin.span > 1
      ? origin.span
      : null;
  }

  protected isCovering(rowIndex: number, columnIndex: number): boolean {
    return this.spanOf(rowIndex, columnIndex) !== null;
  }

  protected coversLabel(rowIndex: number, columnIndex: number): string {
    const origin = this.cellOf(rowIndex, columnIndex)?.origin;
    if (origin === undefined || origin.kind !== 'covering') return '';
    return this.bandLabel(origin.band);
  }

  /**
   * Everything a cell has to add, on ONE line.
   *
   * These were three stacked blocks, so a row carrying a condition stood half again as tall
   * as its neighbours. Joined and truncated, the row keeps its height; the untruncated text
   * is on the cell's accessible name, on the title, and on the Exceptions tab.
   */
  protected subLine(rowIndex: number, columnIndex: number): string | null {
    const parts = this.subParts(rowIndex, columnIndex, true);
    return parts.length === 0 ? null : parts.join(' · ');
  }

  protected subTitle(rowIndex: number, columnIndex: number): string | null {
    const parts = this.subParts(rowIndex, columnIndex, false);
    return parts.length === 0 ? null : parts.join(' · ');
  }

  private subParts(rowIndex: number, columnIndex: number, short: boolean): string[] {
    const parts: string[] = [];
    const only = short
      ? this.onlyForShort(rowIndex, columnIndex)
      : this.onlyForLabel(rowIndex, columnIndex);
    if (only !== null) parts.push(only);
    if (this.isCovering(rowIndex, columnIndex)) {
      parts.push(this.coversLabel(rowIndex, columnIndex));
    }
    return parts;
  }

  /** The restriction without the refusal — the long half lives one tab over. */
  private onlyForShort(rowIndex: number, columnIndex: number): string | null {
    const codes = this.onlyForCodes(rowIndex, columnIndex);
    if (codes === null) return null;
    const only = codes.labels.join(' · ');
    return $localize`:@@spd.plan_table.only_for:Only for ${only}:only:`;
  }

  private onlyForCodes(
    rowIndex: number,
    columnIndex: number,
  ): { labels: string[]; factKey: string; codes: readonly string[] } | null {
    const t = this.table();
    const column = this.cardColumns()[columnIndex];
    if (t === null || column === undefined || !column.conditional) return null;
    const shape = this.shapes().get(column.slot);
    if (shape === undefined) return null;
    const codes = planSlotOnlyFor(t, shape, rowIndex);
    if (codes.length === 0) return null;
    const factKey = (t.extraAxes[column.slot] ?? [])[0]?.factKey ?? '';
    return { labels: codes.map((code) => this.optionLabel(factKey, code)), factKey, codes };
  }

  /**
   * The answers a row's figure is restricted to, and — when the table turns a miss away —
   * the answer it therefore refuses.
   *
   * The refusal is the half nine columns could not state at all: it is not in the table, it
   * is the option list MINUS what the table names, and it is the difference between "we
   * finance 80% here" and "in this band we do not lend to renters".
   */
  protected onlyForLabel(rowIndex: number, columnIndex: number): string | null {
    const t = this.table();
    const column = this.cardColumns()[columnIndex];
    const found = this.onlyForCodes(rowIndex, columnIndex);
    if (t === null || column === undefined || found === null) return null;
    const only = found.labels.join(' · ');
    if (t.onNoMatch[column.slot] !== 'reject') {
      return $localize`:@@spd.plan_table.only_for:Only for ${only}:only:`;
    }
    const all = this.facts().find((f) => f.key === found.factKey)?.question?.options ?? [];
    const refused = all
      .filter((option) => !found.codes.includes(option.code))
      .map((option) => (this.isAr ? option.labelAr : option.labelEn));
    if (refused.length === 0) {
      return $localize`:@@spd.plan_table.only_for:Only for ${only}:only:`;
    }
    return $localize`:@@spd.plan_table.only_for_not:Only for ${only}:only: — not ${refused.join(' · ')}:refused:`;
  }

  /**
   * What a financed share means in money, for a car price the operator typed.
   *
   * An illustration and nothing else: it is arithmetic on one row, it is stored nowhere, and
   * it is empty until somebody asks for it. It exists because a share is the one figure on
   * this card an operator cannot sanity-check by looking at it.
   */
  protected rowMoney(rowIndex: number): string | null {
    const price = Number(this.price());
    if (!Number.isFinite(price) || price <= 0) return null;
    const row = this.table()?.rows[rowIndex];
    if (row === undefined) return null;

    const from = Number(row.band.fromInclusive);
    if (!Number.isFinite(from) || from < 0) return null;
    const down = Math.round((price * from) / 100);

    // The share is the row's own, read through the column the table actually draws — not
    // assumed to be at any index, because a slot the product does not state draws none.
    const c = this.cardColumns().findIndex(
      (column) => column.slot === 'ltvCeilingByFact' && column.leads,
    );
    const share = c < 0 ? Number.NaN : Number(this.cellValue(rowIndex, c));
    if (!Number.isFinite(share) || share <= 0) {
      return $localize`:@@spd.plan_table.money_down:deposit ${group(String(down))}:down:`;
    }
    const financed = Math.round((price * share) / 100);
    return $localize`:@@spd.plan_table.money_row:deposit ${group(String(down))}:down: · finances ${group(String(financed))}:financed:`;
  }

  // ─── ACCESSIBLE NAMES ──────────────────────────────────────────────────────
  // A screen reader in forms mode reads the input alone, so every box carries its band and
  // its column — never a row NUMBER, which says nothing about which plan it is.

  protected cellAria(rowIndex: number, columnIndex: number): string {
    const t = this.table();
    const column = this.cardColumns()[columnIndex];
    const row = t?.rows[rowIndex];
    if (row === undefined || column === undefined) return '';
    const band = this.bandLabel(row.band);
    const name = this.headName(column);
    const base = $localize`:@@spd.plan_table.cell_aria:${band}:band:, ${name}:column:`;
    // The condition is not decoration on this cell: it is who the figure is for, and the
    // visible chip is truncated. Said in full here, where nothing clips.
    const only = this.onlyForLabel(rowIndex, columnIndex);
    return only === null ? base : `${base} — ${only}`;
  }

  protected edgeAria(rowIndex: number): string {
    const n = rowIndex + 1;
    return $localize`:@@spd.plan_table.edge_aria:Band ${n}:n: starts at this percent`;
  }

  protected editBandAria(rowIndex: number): string {
    const band = this.table()?.rows[rowIndex]?.band;
    const label = band === undefined ? '' : this.bandLabel(band);
    return $localize`:@@spd.plan_table.edit_band_aria:Change the ${label}:band: band`;
  }

  protected deltaAria(slot: PlanSlotKey, item: PlanCase): string {
    const name = this.headNameOf(slot);
    const what = this.caseLabel(slot, item);
    return $localize`:@@spd.plan_table.delta_aria:How much ${name}:table: moves for ${what}:case:`;
  }

  protected removeCaseAria(what: string): string {
    return $localize`:@@spd.plan_table.remove_case_aria:Stop pricing ${what}:case: differently`;
  }

  protected removeRowAria(rowIndex: number): string {
    const band = this.table()?.rows[rowIndex]?.band;
    const label = band === undefined ? '' : this.bandLabel(band);
    return $localize`:@@spd.plan_table.remove_row_aria:Remove the ${label}:band: band`;
  }

  protected splitAria(rowIndex: number, columnIndex: number): string {
    const name = this.cellAria(rowIndex, columnIndex);
    return $localize`:@@spd.plan_table.split_aria:State ${name}:cell: band by band`;
  }

  protected adviceLabel(item: PlanAdvice): string {
    const band = this.table()?.rows[item.rowIndex]?.band;
    const label = band === undefined ? '' : this.bandLabel(band);
    switch (item.kind) {
      case 'no_rate':
        return $localize`:@@spd.plan_table.advice_no_rate:${label}:band: has no rate, so nobody putting that down is quoted at all.`;
      case 'refused': {
        const name = this.headNameOf(item.slot);
        return $localize`:@@spd.plan_table.advice_refused:${label}:band: is priced, but ${name}:table: states nothing for it and turns those customers away.`;
      }
      case 'share_total':
        return $localize`:@@spd.plan_table.advice_total:${label}:band: down plus what is financed comes to ${item.total}:total:%, not 100.`;
    }
  }

  // ─── THE CASE PICKER ───────────────────────────────────────────────────────

  protected canVary(slot: PlanSlotKey): boolean {
    return this.shapes().get(slot)?.kind !== 'detailed';
  }

  protected openCase(slot: PlanSlotKey): void {
    this.caseSlot.set(slot);
    this.caseFact.set(null);
    this.caseOption.set(null);
  }

  /**
   * The answers a case can be keyed by: every registry fact with a list behind it.
   *
   * A band on the picked answer is not offered — a range is a second dimension of rows and a
   * case is one key, so the projection refuses such a table and the card would fall back to
   * the free-form editor the moment it was built.
   */
  protected readonly caseFacts = computed<ReadonlyArray<{ key: string; label: string }>>(() =>
    this.facts()
      .filter(
        (fact) => fact.question?.type === 'SINGLE_SELECT' || fact.question?.type === 'MULTI_SELECT',
      )
      .map((fact) => ({ key: fact.key, label: fact.label })),
  );

  protected readonly caseOptions = computed<ReadonlyArray<{ code: string; label: string }>>(() => {
    const key = this.caseFact();
    const slot = this.caseSlot();
    if (key === null || slot === null) return [];
    const taken = new Set(
      (this.table()?.columns ?? [])
        .filter((column) => column.slot === slot)
        .flatMap((column) => column.extra.filter((code): code is string => code !== null)),
    );
    return (this.facts().find((f) => f.key === key)?.question?.options ?? [])
      .filter((option) => !taken.has(option.code))
      .map((option) => ({ code: option.code, label: this.isAr ? option.labelAr : option.labelEn }));
  });

  protected onCaseFact(key: string): void {
    this.caseFact.set(key);
    this.caseOption.set(null);
  }

  protected canAddCase(): boolean {
    return this.caseSlot() !== null && this.caseFact() !== null && this.caseOption() !== null;
  }

  protected onAddCase(): void {
    const t = this.table();
    const slot = this.caseSlot();
    const fact = this.caseFact();
    const option = this.caseOption();
    if (t === null || slot === null || fact === null || option === null) return;
    this.emit(addPlanCase(this.grids(), t, slot, fact, option));
    this.caseOption.set(null);
  }

  // ─── VERBS ─────────────────────────────────────────────────────────────────

  protected onFigure(rowIndex: number, columnIndex: number, raw: string): void {
    const t = this.table();
    const column = this.cardColumns()[columnIndex];
    if (t === null || column === undefined) return;
    if (column.kind === 'case') {
      this.emit(setPlanFigure(this.grids(), t, rowIndex, column.columnIndex, raw));
      return;
    }
    this.emit(setPlanSlotFigure(this.grids(), t, column.slot, rowIndex, raw));
  }

  protected onDelta(slot: PlanSlotKey, columnIndex: number, delta: string): void {
    const t = this.table();
    if (t === null) return;
    this.emit(setPlanCaseDelta(this.grids(), t, slot, columnIndex, delta));
  }

  protected onEdge(rowIndex: number, raw: string): void {
    const t = this.table();
    if (t === null) return;
    this.emit(setPlanBandEdge(this.grids(), t, rowIndex, raw));
  }

  protected onSplit(rowIndex: number, columnIndex: number): void {
    const t = this.table();
    const column = this.cardColumns()[columnIndex];
    if (t === null || column === undefined || column.columnIndex < 0) return;
    if (splitPlanCellCount(t, rowIndex, column.columnIndex) < 2) return;
    this.emit(splitPlanCell(this.grids(), t, rowIndex, column.columnIndex));
  }

  /**
   * A band may only be added ABOVE the card's top one, which needs that band to be
   * open-ended — that is the cell the new edge closes and copies.
   */
  protected canAddBand(): boolean {
    const raw = this.newBand().trim();
    if (raw === '') return false;
    const n = Number(raw);
    if (!Number.isFinite(n)) return false;
    const rows = this.table()?.rows ?? [];
    const last = rows[rows.length - 1];
    if (last === undefined || last.band.toExclusive !== null) return false;
    return n > Number(last.band.fromInclusive);
  }

  protected onAddBand(): void {
    const t = this.table();
    if (t === null || !this.canAddBand()) return;
    this.emit(appendPlanBand(this.grids(), t, this.newBand().trim()));
    this.newBand.set('');
  }

  protected askRemoveRow(rowIndex: number): void {
    const t = this.table();
    const row = t?.rows[rowIndex];
    if (t === null || row === undefined) return;
    this.removeRequest.emit({
      kind: 'row',
      what: this.bandLabel(row.band),
      figuresLost: row.cells.filter((cell) => cell.value !== '').length,
      next: removePlanBand(this.grids(), t, rowIndex),
    });
  }

  protected askRemoveColumn(columnIndex: number): void {
    const t = this.table();
    const column = t?.columns[columnIndex];
    if (t === null || column === undefined) return;
    this.removeRequest.emit({
      kind: 'column',
      what: this.extraLabel(column.slot, column.extra),
      figuresLost: planColumnFigureCount(t, columnIndex),
      next: removePlanColumn(this.grids(), t, columnIndex),
    });
  }

  /** Nothing moved means nothing is emitted — the host's dirty flag stays where it was. */
  private emit(next: PlanDefaults | null): void {
    if (next === this.grids()) return;
    this.gridsChange.emit(next);
  }
}
