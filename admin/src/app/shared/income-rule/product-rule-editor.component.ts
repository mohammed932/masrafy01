import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  model,
  output,
  signal,
} from '@angular/core';
import { NzIconModule, provideNzIconsPatch } from 'ng-zorro-antd/icon';
import { FormsModule } from '@angular/forms';
import { NzSwitchModule } from 'ng-zorro-antd/switch';
import { RailTabsComponent, type RailTabItem } from '@shared/ui';
import { CheckCircleOutline, CheckOutline, DownOutline } from '@ant-design/icons-angular/icons';
import {
  STEP_OP_SHAPE,
  gateIsConfigured,
  factKeysReadBy,
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
  type ValueRef,
} from '@features/bank-programs/bank-programs.types';
import { slotsKeyedByList } from './figure-slots';
import { derivedFactByKey } from '@core/surrogate-facts';
import { FigureFieldComponent } from './figure-field.component';
import { IncomeBandsEditorComponent } from './income-bands-editor.component';
import { IncomeKeyTableComponent } from './income-key-table.component';

/** One editable figure inside a row. Two of them when a step reads a column per answer. */
/**
 * One frozen empty per shape. An unconfigured table is the DESIGNED normal state here (a
 * bank fills one derivation of four), so `?? []` handed ~8 children a fresh array on every
 * change-detection tick — each one failing `Object.is`, marking an OnPush child dirty and
 * re-running its computeds to render the same empty state.
 */
// Typed mutable so every existing signature keeps working, FROZEN so the shared instance
// cannot be mutated by accident — the children always publish a fresh array.
const NO_ROWS = Object.freeze([]) as unknown as IncomeKeyTableRow[];
const NO_BANDS = Object.freeze([]) as unknown as IncomeBand[];

/** The key a fact's PARENT list is memoised under, kept out of the fact's own namespace. */
function parentKeyOf(factKey: string): string {
  return `${factKey}\u0000parent`;
}

interface FigureSlot {
  /** The step or gate id these figures are stored under. */
  id: string;
  /** Which column this is, when a row has more than one. `null` for a single slot. */
  label: string | null;
  shape: 'keyTable' | 'bands' | 'scalar' | 'minmax' | 'applies' | 'none';
  /** For a key-table slot: the option codes the keys must come from, when known. */
  keyOptions: readonly { key: string; labelEn: string; labelAr: string }[] | null;
  /** The trailing affix on a typed figure. `null` when the kind cannot be proved. */
  unit: string | null;
  /**
   * Whether a TYPED figure (a scalar or a gate bound) groups its thousands — A27, and the
   * same treatment every table cell beside it already gets. A percentage or a multiplier is
   * not money and stays ungrouped; an unproved kind groups, because grouping a two-digit
   * month count changes nothing and leaving a seven-digit floor as `2000000` costs a misread.
   */
  money: boolean;
  /** What the value column holds. A pipeline's tables are never monthly incomes. */
  valueLabel: string;
  /**
   * A `pickByFact` pair of KEY TABLES rendered as one table with two value columns —
   * same keys, two readings of them. `null` for every other slot.
   */
  secondId: string | null;
  secondLabel: string | null;
  configured: boolean;
}

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
  /**
   * What tells this row apart from its siblings — which answer it is keyed by, which
   * figure it is measured on. Load-bearing, not decoration: four of the compound rule's
   * gates carry the same reason code and so the same title, and without this the operator
   * reads "Minimum the customer must have paid" four times with nothing to choose between.
   */
  qualifier: string;
  /** How the figure is used, when that is not obvious from the title. */
  hint: string;
  slots: FigureSlot[];
  /** The bank may leave this blank — a derivation or a condition it declines. */
  optional: boolean;
  configured: boolean;
  /** Blank-and-optional rows fold away; anything with figures in it, or owed, stays open. */
  collapsible: boolean;
  /** What the row says about itself when it carries no figures. `''` when it does. */
  state: string;
  /** `true` on a program that owes this figure — the one row state that is a problem. */
  owed: boolean;
}

interface RowGroup {
  key: 'chain' | 'alternative' | 'adjustment' | 'condition';
  title: string;
  hint: string;
  count: string;
  rows: EditorRow[];
}

/** One line of the arithmetic, in the closed summary at the foot of the editor. */
interface FlowLine {
  /** Its position in the run, and the number the lines that read it refer to it by. */
  n: number;
  title: string;
  /** What tells it from an identically-titled twin — the column of a pick that it fills. */
  qualifier: string;
  /** The ordinals of the earlier lines it reads. */
  from: readonly number[];
  /** Read by a condition and by nothing else, so it legitimately sits past the answer. */
  gateOnly: boolean;
  /** The line the whole pipeline exists to produce. */
  answer: boolean;
}

/**
 * A product rule — the compound-ownership guarantee, the car-ownership loan — in the two
 * halves it is actually authored in.
 *
 * ─── Why one component and not two ────────────────────────────────────────────
 *
 * `variant` decides which half is editable, exactly as it does on the income-assumption
 * section this sits inside:
 *
 *   'catalog'  the program NAME's own rule. The pipeline is shown as a readable summary, and
 *              the figures are the DEFAULTS every bank under the name starts from — editable
 *              here, and copied into a new program's editor on open.
 *   'program'  a bank's rule. The pipeline is shown the same way, and each step it may state
 *              a figure for gets the editor its op calls for.
 *
 * Both variants edit figures; what differs is whose they are, and the words used for a blank
 * one. Neither authors STRUCTURE; see the scope cut below.
 *
 * ─── Why the rule is GROUPED and not listed ───────────────────────────────────
 *
 * The compound rule is twenty steps and ten gates, and rendering them as one numbered ladder
 * — which is what this component did first — told the operator nothing: eleven of the steps
 * are arithmetic with nothing to type, four of the remaining nine are alternative ways to
 * reach the SAME figure of which each bank fills exactly one, and a step that exists only to
 * be compared against by a gate rendered as far from that gate as the list is long. Thirty
 * rows of equal weight, eight of them repeating the same empty-table paragraph.
 *
 * So the rows are grouped by what the operator has to DECIDE, all of it derived from the
 * rule itself (never a stored label, never a hardcoded step id):
 *
 *   chain        takes figures and nothing offers an alternative to it — always used.
 *   alternative  a `coalesce` of steps names them; exactly one gets filled.
 *   adjustment   a `coalesce` that also offers a `{const}` fallback names them — blank is a
 *                legitimate answer and means "no adjustment".
 *   condition    the gates. A gate that compares against a step carries THAT step's editor,
 *                so the requirement and the table stating it are one row.
 *
 * The arithmetic falls out of the actionable list into a closed disclosure at the foot, where
 * it still reads as the whole calculation for anyone checking the product.
 *
 * ─── One deliberate scope cut, stated ─────────────────────────────────────────
 *
 * Neither variant lets an operator AUTHOR a pipeline — add a step, pick an op, wire a
 * reference. Adding a new PRODUCT is still an API or seed action
 * (`PUT admin/bank-programs/surrogate-products/:key/template`, from the form at
 * `/program-catalog/products/:key/calculation`).
 * A graph editor is its own feature and would be a worse one built in a hurry beside this.
 *
 * FIGURES are a different matter and both variants edit them, through the same three
 * editors. On the catalog they are the DEFAULTS every bank under the name starts from; on a
 * program they are that bank's own. The structure stays the catalog's either way — the
 * catalog page does not post `steps`/`gates`/`output` back, and a bank program is stripped
 * of them on save — so one screen editing amounts can never rewrite the product.
 */
@Component({
  selector: 'app-product-rule-editor',
  standalone: true,
  imports: [
    NzIconModule,
    RailTabsComponent,
    FigureFieldComponent,
    IncomeBandsEditorComponent,
    IncomeKeyTableComponent,
    NzSwitchModule,
    FormsModule,
  ],
  providers: [provideNzIconsPatch([CheckCircleOutline, CheckOutline, DownOutline])],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="rule" [class.is-inline]="layout() === 'inline'">
      <!-- What the rule produces. Said first, because every figure below is in service of it.
           Inline it is withheld: the same sentence over every list on the page would be four
           copies of one idea before the first box. -->
      @if (layout() === 'full') {
        <p class="lede">
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
      }

      <!-- The questions the whole pipeline turns on, in one line. The operator's first
           question about an unfamiliar product is "what does it ask the customer?", and
           until now the only answer was to read twenty step titles. -->
      @if (layout() === 'full' && readsFacts().length > 0) {
        <p class="reads">
          <span class="reads-label" i18n="@@product_rule.reads">Reads the answers</span>
          @for (f of shownFacts(); track f) {
            <span class="chip">{{ f }}</span>
          }
          <!-- Capped at one line. Thirteen chips over three rows pushed the first
               decision below the fold to answer a question the operator asks once. -->
          @if (hiddenFactCount() > 0) {
            <button type="button" class="chip is-more" (click)="allFacts.set(true)">
              {{ moreFactsLabel() }}
            </button>
          }
        </p>
      }

      @if (layout() === 'full' && variant() === 'program' && activeDerivation(); as active) {
        <p class="live">
          <span nz-icon nzType="check-circle" nzTheme="outline" aria-hidden="true"></span>
          <span i18n="@@product_rule.active_derivation"
            >This bank works the ceiling out from: {{ active }}</span
          >
        </p>
      }

      <!-- One group on stage, picked on a rail — NOT an inner stepper. A stepper
           claims an order these groups do not have: fill exactly one of the four
           derivations, then optionally an adjustment, then optionally a condition. The
           operator usually touches one row and leaves. A rail also shows every group's
           count at once, which is the thing a stepper hides, and it degrades to nothing
           when a product has one group (the car rule) instead of to a one-step rail. -->
      @if (showsRail()) {
        <app-rail-tabs
          [items]="groupTabs()"
          [activeId]="activeGroup()"
          [ariaLabel]="groupsAria"
          idPrefix="rule-grp"
          appearance="segmented"
          (select)="pickedGroup.set($event)"
        />
      }

      @for (group of shownGroups(); track group.key) {
        <!-- The panel the rail's tabs name. Without the id and the role, every tab pointed
             its aria-controls at an element that did not exist, and the group content sat
             outside the tab semantics entirely. -->
        <section
          class="grp"
          [id]="showsRail() ? 'rule-grp-panel-' + group.key : null"
          [attr.role]="showsRail() ? 'tabpanel' : null"
          [attr.aria-labelledby]="showsRail() ? 'rule-grp-tab-' + group.key : null"
        >
          @if (showsGroupHeads()) {
            <header class="grp-head">
              <h5 class="grp-title">{{ group.title }}</h5>
              <span class="grp-count">{{ group.count }}</span>
            </header>
          }
          @if (group.hint && layout() === 'full') {
            <p class="grp-hint">{{ group.hint }}</p>
          }

          <ul class="rows">
            @for (row of group.rows; track row.id) {
              <li
                class="row"
                [class.is-set]="row.configured"
                [class.is-owed]="row.owed"
                [class.is-open]="isOpen(row)"
              >
                @if (row.collapsible) {
                  <button
                    type="button"
                    class="row-head is-toggle"
                    [attr.aria-expanded]="isOpen(row)"
                    (click)="toggle(row.id)"
                  >
                    <span class="mark" aria-hidden="true">
                      <span nz-icon nzType="check" nzTheme="outline"></span>
                    </span>
                    <span class="row-name">
                      <span class="row-title">{{ row.title }}</span>
                      @if (row.qualifier) {
                        <span class="row-qualifier">{{ row.qualifier }}</span>
                      }
                    </span>
                    @if (row.state) {
                      <span class="row-state">{{ row.state }}</span>
                    }
                    <span class="caret" aria-hidden="true">
                      <span nz-icon nzType="down" nzTheme="outline"></span>
                    </span>
                  </button>
                } @else {
                  <div class="row-head">
                    <span class="mark" aria-hidden="true">
                      <span nz-icon nzType="check" nzTheme="outline"></span>
                    </span>
                    <span class="row-name">
                      <span class="row-title">{{ row.title }}</span>
                      @if (row.qualifier) {
                        <span class="row-qualifier">{{ row.qualifier }}</span>
                      }
                    </span>
                    @if (row.state) {
                      <span class="row-state" [class.is-owed]="row.owed">{{ row.state }}</span>
                    }
                  </div>
                }

                @if (isOpen(row)) {
                  <!-- A named group, because a screen reader in forms mode reads only the
                       field's own label — and ten conditions each offering "At least" are
                       ten identical fields until the group says which condition it is. -->
                  <div class="row-body" role="group" [attr.aria-label]="row.title">
                    @if (row.hint) {
                      <p class="row-hint">{{ row.hint }}</p>
                    }
                    @for (slot of row.slots; track slot.id) {
                      <div class="slot">
                        @if (slot.label) {
                          <p class="slot-label">{{ slot.label }}</p>
                        }
                        @switch (slot.shape) {
                          @case ('keyTable') {
                            <app-income-key-table
                              [rows]="tableFor(slot.id)"
                              (rowsChange)="setTable(slot.id, $event)"
                              [keyOptions]="slot.keyOptions"
                              [valueLabel]="slot.valueLabel"
                              [secondRows]="slot.secondId ? tableFor(slot.secondId) : null"
                              (secondRowsChange)="setSecondTable(slot.secondId, $event)"
                              [secondLabel]="slot.secondLabel"
                            ></app-income-key-table>
                          }
                          @case ('bands') {
                            <app-income-bands-editor
                              [bands]="bandsFor(slot.id)"
                              (bandsChange)="setBands(slot.id, $event)"
                              [unit]="slot.unit"
                              [valueLabel]="slot.valueLabel"
                              [suggested]="suggestedFor(slot.id)"
                            ></app-income-bands-editor>
                          }
                          @case ('scalar') {
                            <app-figure-field
                              [fieldId]="slot.id + '-value'"
                              [value]="scalarFor(slot.id)"
                              [unit]="slot.unit"
                              [money]="slot.money"
                              [ariaLabel]="row.title"
                              (valueChange)="setScalar(slot.id, $event)"
                            />
                          }
                          @case ('minmax') {
                            <div class="figure-pair">
                              @if (wantsMin(slot.id)) {
                                <app-figure-field
                                  [fieldId]="slot.id + '-min'"
                                  [label]="atLeastLabel"
                                  [value]="minFor(slot.id)"
                                  [unit]="slot.unit"
                                  [money]="slot.money"
                                  (valueChange)="setBound(slot.id, 'minValue', $event)"
                                />
                              }
                              @if (wantsMax(slot.id)) {
                                <app-figure-field
                                  [fieldId]="slot.id + '-max'"
                                  [label]="atMostLabel"
                                  [value]="maxFor(slot.id)"
                                  [unit]="slot.unit"
                                  [money]="slot.money"
                                  (valueChange)="setBound(slot.id, 'maxValue', $event)"
                                />
                              }
                            </div>
                          }
                          @case ('none') {
                            <!-- Arithmetic over earlier steps: the figure is worked out, so
                                 there is nothing here for a bank to state. Said in words
                                 rather than rendered as an empty field, which used to be a
                                 money box writing a scalar the engine never reads. -->
                            <p class="slot-none" i18n="@@product_rule.slot.derived">
                              This figure is worked out from the steps above, so there is nothing to
                              type here.
                            </p>
                          }
                          @case ('applies') {
                            <!-- nz-switch, the repo's ONE UI library, rather than a third
                                 hand-rolled track-and-thumb with its own geometry and its own
                                 RTL translate hack (CLAUDE.md: ng-zorro is the single library
                                 repo-wide). -->
                            <span class="applies">
                              <span [id]="slot.id + '-applies'">{{ appliesLabel() }}</span>
                              <nz-switch
                                [ngModel]="appliesFor(slot.id)"
                                (ngModelChange)="toggleApplies(slot.id)"
                                [ngModelOptions]="{ standalone: true }"
                                [attr.aria-labelledby]="slot.id + '-applies'"
                              ></nz-switch>
                            </span>
                          }
                        }
                      </div>
                    }
                  </div>
                }
              </li>
            }
          </ul>
        </section>
      }

      <!-- The arithmetic, out of the way but never hidden: it is the only place the whole
           product reads as one calculation, and a reviewer checking what a bank's figures
           are multiplied by has nowhere else to look.

           Each line carries its ordinal, what tells it from an identically-titled twin, and
           the ordinals it reads. A bare list of op titles did not: the compound rule says
           "A table of ranges" three times and "A percentage of an earlier figure" four, and
           rows 5 and 6 were the same eight words back to back. -->
      @if (layout() === 'full' && flow().length > 0) {
        <details class="flow">
          <summary>
            <span nz-icon nzType="down" nzTheme="outline" aria-hidden="true"></span>
            <span i18n="@@product_rule.flow_summary">The whole calculation, step by step</span>
            <span class="flow-count" aria-hidden="true">{{ flow().length }}</span>
          </summary>
          <!-- Explicit role: Safari drops list semantics from a list-style:none list. -->
          <ol class="flow-list" role="list">
            @for (line of flow(); track line.n) {
              <li class="flow-line" [class.is-answer]="line.answer">
                <span class="flow-n" aria-hidden="true">{{ line.n }}</span>
                <span class="flow-body">
                  <span class="flow-title">{{ line.title }}</span>
                  @if (line.qualifier !== '') {
                    <span class="flow-qual">{{ line.qualifier }}</span>
                  }
                  @if (line.from.length > 0) {
                    <span class="flow-from" [attr.aria-label]="fromLabel(line.from)">
                      <span class="flow-arrow" aria-hidden="true">&#8593;</span>
                      @for (ref of line.from; track ref) {
                        <span class="flow-ref" aria-hidden="true">{{ ref }}</span>
                      }
                    </span>
                  }
                  @if (line.gateOnly) {
                    <span class="flow-tag" i18n="@@product_rule.flow.gate_only"
                      >read by a condition</span
                    >
                  }
                  @if (line.answer) {
                    <span class="flow-tag is-answer" i18n="@@product_rule.flow.answer"
                      >the answer</span
                    >
                  }
                </span>
              </li>
            }
          </ol>
        </details>
      }

      <!-- Withheld inline: the block above each list says the same thing in fewer words, and
           this note would otherwise repeat once per list on the page. -->
      @if (layout() === 'full' && variant() === 'catalog') {
        <p class="note" i18n="@@product_rule.catalog_note">
          These are the steps every bank selling this name runs, and the amounts each one starts
          from. A bank can keep these or type its own on its own program.
        </p>
      }
    </div>
  `,
  styles: [
    `
      /* Every value below is a token that exists. The first cut of this file reached for
         --surface-sunken / --surface-raised / --font-size-sm / --font-size-xs /
         --line-height-relaxed / --color-warning-text, none of which the theme defines, so
         the step discs had no disc, the tags had no chip, and every hint rendered at body
         size — the whole section collapsed into one flat grey column (A18). */
      .rule {
        display: flex;
        flex-direction: column;
        gap: var(--space-5);
      }

      /* Nested under a list panel that already frames and names it, so the gap closes and
         the rows sit flush — the surrounding block draws the hairline. */
      .rule.is-inline {
        gap: var(--space-3);
      }

      .lede,
      .note {
        margin: 0;
        max-inline-size: 72ch;
        color: var(--color-text-secondary);
        font-size: var(--text-sm);
        line-height: var(--leading-relaxed);
      }

      .note {
        padding-block-start: var(--space-3);
        border-block-start: 1px solid var(--border-subtle);
        color: var(--color-text-tertiary);
        font-size: var(--text-xs);
      }

      /* The questions, as chips. Membership, not a table: the operator is checking that a
         name they recognise is in the list, which is a scan, not a read. */
      .reads {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: var(--space-2);
        margin: 0;
      }

      /* Secondary, not tertiary: measured at 3.83:1 on this surface in light mode, and a
         12px uppercase micro-label is the worst case for it. */
      .reads-label {
        color: var(--color-text-secondary);
        font-size: var(--text-xs);
        font-weight: var(--font-semibold);
        letter-spacing: var(--tracking-wide);
        text-transform: uppercase;
      }

      /* --bg-muted, not --color-surface-elevated: that token resolves to --bg-subtle, which
         IS this panel's own ground — so the chips had no chip, and the row read as one
         run-on line of words rather than as a list of the answers the product turns on. */
      .chip {
        padding: var(--space-0-5) var(--space-2);
        border-radius: var(--radius-pill);
        background: var(--bg-muted);
        color: var(--color-text-secondary);
        font-size: var(--text-xs);
        white-space: nowrap;
      }
      /* Reads as one more chip, behaves as a button — which is exactly what it is. */
      .chip.is-more {
        border: 1px dashed var(--color-border-strong);
        background: none;
        font: inherit;
        font-size: var(--text-xs);
        cursor: pointer;
      }
      .chip.is-more:hover {
        color: var(--color-brand-primary);
        border-color: var(--color-brand-primary);
      }
      .chip.is-more:focus-visible {
        outline: var(--focus-ring-width) solid var(--color-border-focus);
        outline-offset: var(--focus-ring-offset);
      }

      /* Which derivation is live. The single most useful line on a bank's own rule, so it
         gets the one saturated accent on the screen. */
      .live {
        display: flex;
        align-items: center;
        gap: var(--space-2);
        margin: 0;
        padding: var(--space-2) var(--space-3);
        border-inline-start: var(--rule-width-accent) solid var(--color-success);
        border-radius: var(--radius-sm);
        background: var(--color-success-bg);
        color: var(--color-text-primary);
        font-size: var(--text-sm);
      }

      .live [nz-icon] {
        color: var(--color-success);
      }

      /* --- one group ------------------------------------------------------- */
      .grp {
        display: flex;
        flex-direction: column;
        gap: var(--space-1);
      }

      .grp-head {
        display: flex;
        align-items: baseline;
        justify-content: space-between;
        gap: var(--space-3);
      }

      .grp-title {
        margin: 0;
        color: var(--color-text-secondary);
        font-size: var(--text-xs);
        font-weight: var(--font-semibold);
        letter-spacing: var(--tracking-wide);
        text-transform: uppercase;
      }

      .grp-count {
        color: var(--color-text-tertiary);
        font-size: var(--text-xs);
        font-variant-numeric: tabular-nums;
      }

      .grp-hint {
        margin: 0 0 var(--space-1);
        max-inline-size: 72ch;
        color: var(--color-text-tertiary);
        font-size: var(--text-xs);
        line-height: var(--leading-relaxed);
      }

      /* Hairlines, not cards. This editor already sits inside a card on both hosts, and a
         bordered box per row would be the third frame around one number. */
      .rows {
        display: flex;
        flex-direction: column;
        margin: 0;
        padding: 0;
        list-style: none;
        border-block-start: 1px solid var(--border-subtle);
      }

      .row {
        border-block-end: 1px solid var(--border-subtle);
      }

      .row-head {
        display: grid;
        grid-template-columns: auto minmax(0, 1fr) auto auto;
        align-items: center;
        gap: var(--space-3);
        inline-size: 100%;
        /* 2.75rem of real target, the same as the table row actions next to it. */
        min-block-size: 2.75rem;
        padding: var(--space-2) 0;
        border: 0;
        background: none;
        text-align: start;
        font: inherit;
        color: inherit;
      }

      .row-head.is-toggle {
        cursor: pointer;
      }

      .row-head.is-toggle:hover .row-title {
        color: var(--color-brand-primary);
      }

      .row-head.is-toggle:focus-visible {
        outline: var(--focus-ring-width) solid var(--color-border-focus);
        outline-offset: calc(var(--focus-ring-offset) * -1);
        border-radius: var(--radius-sm);
      }

      /* The state mark carries three answers at a glance: set, offered-and-blank, owed. */
      .mark {
        display: grid;
        place-items: center;
        inline-size: 1.25rem;
        block-size: 1.25rem;
        border-radius: 50%;
        border: 1px dashed var(--color-border-strong);
        color: transparent;
        font-size: 0.625rem;
        transition:
          background-color var(--motion-duration-fast) var(--motion-easing-standard),
          border-color var(--motion-duration-fast) var(--motion-easing-standard);
      }

      .row.is-set .mark {
        border-style: solid;
        border-color: var(--color-brand-primary);
        background: var(--color-brand-primary);
        color: var(--color-brand-primary-contrast);
      }

      .row.is-owed .mark {
        border-style: solid;
        border-color: var(--color-warning);
        background: var(--color-warning-bg);
      }

      .row-name {
        display: flex;
        flex-wrap: wrap;
        align-items: baseline;
        gap: var(--space-2);
        min-inline-size: 0;
      }

      .row-title {
        color: var(--color-text-primary);
        font-size: var(--text-sm);
        font-weight: var(--font-weight-medium);
        transition: color var(--motion-duration-fast) var(--motion-easing-standard);
      }

      .row:not(.is-set) .row-title {
        color: var(--color-text-secondary);
        font-weight: var(--font-weight-regular);
      }

      .row-qualifier {
        color: var(--color-text-tertiary);
        font-size: var(--text-xs);
      }

      .row-state {
        color: var(--color-text-tertiary);
        font-size: var(--text-xs);
        white-space: nowrap;
      }

      .row-state.is-owed {
        padding: 0 var(--space-2);
        border-radius: var(--radius-pill);
        background: var(--color-warning-bg);
        color: var(--color-text-primary);
      }

      .caret {
        display: grid;
        place-items: center;
        color: var(--color-text-tertiary);
        font-size: var(--text-xs);
        transition: transform var(--motion-duration-base) var(--motion-easing-standard);
      }

      .row.is-open .caret {
        transform: rotate(180deg);
      }

      /* Indented to the title, so the figures read as belonging to the row above rather
         than as a new block. */
      .row-body {
        display: flex;
        flex-direction: column;
        gap: var(--space-3);
        /* Logical, not a 4-value shorthand: the start-side indent lines the body up under
           the row's own title, and the physical form indented from the WRONG edge in RTL
           (A19). */
        padding-block: 0 var(--space-4);
        padding-inline: calc(1.25rem + var(--space-3)) 0;
        animation: rule-row-in var(--motion-duration-base) var(--motion-easing-standard) both;
      }

      .row-hint {
        margin: 0;
        max-inline-size: 72ch;
        color: var(--color-text-tertiary);
        font-size: var(--text-xs);
        line-height: var(--leading-relaxed);
      }

      .slot {
        display: flex;
        flex-direction: column;
        gap: var(--space-2);
      }

      .slot-none {
        margin: 0;
        color: var(--color-text-tertiary);
        font-size: var(--text-sm);
      }

      .slot-label {
        margin: 0;
        color: var(--color-text-secondary);
        font-size: var(--text-xs);
        font-weight: var(--font-semibold);
      }

      /* Two bounds side by side. A between-gate is one requirement, and stacking its
         floor above its ceiling reads as two conditions. */
      .figure-pair {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: var(--space-4);
      }

      /* A switch, not a pill that toggles: the two states of a condition are on and off,
         and the same idiom already says so on the loan-type gate one card below. */
      .applies {
        display: inline-flex;
        align-items: center;
        gap: var(--space-2);
        color: var(--color-text-secondary);
        font-size: var(--text-sm);
        cursor: pointer;
      }

      .applies:focus-visible {
        outline: var(--focus-ring-width) solid var(--color-border-focus);
        outline-offset: var(--focus-ring-offset);
        border-radius: var(--radius-pill);
      }

      /* --- the arithmetic -------------------------------------------------- */
      .flow > summary {
        display: inline-flex;
        align-items: center;
        gap: var(--space-2);
        /* Pulled back by its own padding so the label still starts on the panel's edge
           while the hit area and the hover surface extend past it. */
        margin-inline-start: calc(-1 * var(--space-2));
        padding: var(--space-1) var(--space-2);
        border-radius: var(--radius-sm);
        color: var(--color-text-secondary);
        font-size: var(--text-xs);
        font-weight: var(--font-medium);
        cursor: pointer;
        list-style: none;
        transition:
          color var(--motion-duration-base) var(--motion-easing-standard),
          background var(--motion-duration-base) var(--motion-easing-standard);
      }

      .flow > summary::-webkit-details-marker {
        display: none;
      }

      .flow > summary:hover {
        background: var(--color-surface-elevated);
        color: var(--color-text-primary);
      }

      .flow > summary:focus-visible {
        outline: var(--focus-ring-width) solid var(--color-border-focus);
        outline-offset: var(--focus-ring-offset);
      }

      .flow > summary [nz-icon] {
        font-size: 0.625rem;
        transition: transform var(--motion-duration-base) var(--motion-easing-standard);
      }

      .flow[open] > summary [nz-icon] {
        transform: rotate(180deg);
      }

      /* What the closed state has to say for itself: twenty steps and three are a very
         different offer, and the label alone reads the same either way. */
      .flow-count {
        min-inline-size: 2ch;
        padding: 0 var(--space-1);
        border-radius: var(--radius-pill);
        background: var(--color-surface-elevated);
        color: var(--color-text-tertiary);
        font-variant-numeric: tabular-nums;
        text-align: center;
      }

      /* Numbered by a grid column, not by a list marker: an outside marker is laid out to
         the LEFT of the box, so "20." hung further out than "1." and the digits ran ragged
         past the start edge of the panel that contains them. A fixed 2ch column with
         tabular figures aligns them exactly, inside the box, in both directions. */
      .flow-list {
        display: flex;
        flex-direction: column;
        gap: var(--space-0-5);
        margin: var(--space-2) 0 0;
        padding-block: var(--space-1);
        padding-inline: var(--space-3) 0;
        /* Subordinate to the editor above it, said with a rule rather than another box —
           this panel already sits in a card, and a card in a card is a hierarchy failure. */
        border-inline-start: 1px solid var(--border-subtle);
        list-style: none;
        color: var(--color-text-tertiary);
        font-size: var(--text-xs);
        line-height: var(--leading-relaxed);
      }

      .flow-line {
        display: grid;
        grid-template-columns: 2ch minmax(0, 1fr);
        gap: var(--space-2);
        align-items: baseline;
      }

      .flow-n {
        text-align: end;
        font-variant-numeric: tabular-nums;
        color: var(--color-text-tertiary);
      }

      .flow-body {
        display: flex;
        flex-wrap: wrap;
        align-items: baseline;
        gap: var(--space-1) var(--space-2);
        min-inline-size: 0;
      }

      .flow-title {
        color: var(--color-text-secondary);
      }

      /* The literal glyph, not a CSS escape: this stylesheet is a template literal, and
         a backslash escape in one is read by TypeScript before CSS ever sees it. */
      .flow-qual::before {
        content: '·';
        margin-inline-end: var(--space-1);
      }

      /* Which earlier lines this one reads. The numerals alone, because they point at the
         numerals in the gutter — a worded "reads step 5 and step 6" would be four times the
         ink to say what two digits already say, on every second line. */
      .flow-from {
        display: inline-flex;
        align-items: baseline;
        gap: var(--space-1);
        font-variant-numeric: tabular-nums;
      }

      .flow-arrow {
        font-size: 0.875em;
      }

      /* Inked at SECONDARY, not the tertiary the surrounding line runs at: a chip darkens
         the ground under its own text, and tertiary on it lands at 3.5:1. Same pairing the
         fact chips at the top of this panel already use. */
      .flow-ref {
        min-inline-size: 2ch;
        padding: 0 var(--space-1);
        border-radius: var(--radius-sm);
        background: var(--color-surface-elevated);
        color: var(--color-text-secondary);
        text-align: center;
      }

      .flow-tag {
        padding: 0 var(--space-1);
        border-radius: var(--radius-sm);
        background: var(--color-surface-elevated);
        color: var(--color-text-secondary);
      }

      /* The accent is the BACKGROUND. Accent ink on the accent tint is 3.3:1 in light mode,
         and the tint plus the weight already single this line out. */
      .flow-tag.is-answer {
        background: var(--color-tonal-accent-bg);
        color: var(--color-text-primary);
        font-weight: var(--font-medium);
      }

      .flow-line.is-answer .flow-n,
      .flow-line.is-answer .flow-title {
        color: var(--color-text-primary);
        font-weight: var(--font-medium);
      }

      @keyframes rule-row-in {
        from {
          opacity: 0;
          transform: translateY(calc(var(--space-0-5) * -1));
        }
        to {
          opacity: 1;
          transform: none;
        }
      }

      /* Reuses the row keyframe: opening the summary is the same gesture as opening a row,
         and it runs once, on open, because that is when the content is created. */
      .flow[open] > .flow-list {
        animation: rule-row-in var(--motion-duration-base) var(--motion-easing-standard);
      }

      @media (prefers-reduced-motion: reduce) {
        .row-body,
        .flow[open] > .flow-list {
          animation: none;
        }
        .caret,
        .flow > summary,
        .flow > summary [nz-icon] {
          transition: none;
        }
      }

      @media (max-width: 640px) {
        .row-head {
          grid-template-columns: auto minmax(0, 1fr) auto;
        }
        /* The state moves under the title rather than squeezing it to two words. */
        .row-state {
          grid-column: 2;
          grid-row: 2;
        }
        .row-body {
          padding-inline-start: 0;
        }
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

  /**
   * Render only the figures keyed by ONE value list, or every figure when `null`.
   *
   * The product page mounts this editor a second time under each list of answers, so the
   * operator types "an apartment supports 400,000" beside the word Apartment rather than
   * two screens away under a step id. Same component, same store, same Save — a second
   * editor that knew how to name a figure would be a second authority on what it means.
   *
   * Filtered by SLOT, never by row: a pick whose two columns read different facts is one
   * row with two list homes, and filtering by row would print both columns under both lists.
   */
  readonly onlyKeyedBy = input<string | null>(null);

  /**
   * `inline` drops the frame — the rail, the group hints, the lede, the fact chips and the
   * read-only flow — and keeps the figures.
   *
   * Everything it removes is said by the panel this is nested inside, and a box in a box in
   * a box is what the row layout below already exists to avoid.
   */
  readonly layout = input<'full' | 'inline'>('full');

  /**
   * The slots one list keys, or `null` for "every slot" — which is every caller but the
   * product page's per-list mounts, so their behaviour is unchanged by construction.
   */
  private readonly shownSlotIds = computed<ReadonlySet<string> | null>(() => {
    const type = this.onlyKeyedBy();
    if (type === null) return null;
    const ids = new Set<string>();
    for (const slot of slotsKeyedByList(this.steps(), this.gates(), this.facts(), type)) {
      ids.add(slot.id);
      if (slot.secondId !== null) ids.add(slot.secondId);
    }
    return ids;
  });

  /** The fact registry, so a step can be titled by the question it reads. */
  readonly facts = input<readonly RegistryFact[]>([]);

  /** Raised whenever a figure changes, so the host can mark the form dirty. */
  readonly figuresTouched = output<void>();

  /**
   * Brackets a published sheet prints, keyed by the STEP ID they belong in.
   *
   * Keyed by slot and matched by string equality, because the slot is what the server named
   * when it compiled the product — a mapping worked out here would be a second statement of
   * the rule that decides where a bank's figures live. Empty for every caller but a product
   * created from the predefined library.
   */
  readonly suggestedBands = input<Readonly<Record<string, IncomeBand[]>>>({});

  /** The brackets offered for one box, or none. */
  protected suggestedFor(stepId: string): readonly IncomeBand[] {
    return this.suggestedBands()[stepId] ?? [];
  }

  /**
   * Which blank-and-optional rows the operator has opened.
   *
   * Only they fold: a row carrying figures shows them (that is what the operator came to
   * read), and a row a program still owes stays open because folding it away is how it
   * gets forgotten. An id stays in this set once added, so deleting the last row of a
   * table does not yank the editor out from under the pointer.
   */
  private readonly opened = signal<ReadonlySet<string>>(new Set<string>());

  protected toggle(id: string): void {
    const next = new Set(this.opened());
    if (next.has(id)) next.delete(id);
    else next.add(id);
    this.opened.set(next);
  }

  protected isOpen(row: EditorRow): boolean {
    // Inline, every row is open: a blank optional row folds behind "No default set", which
    // is right on a screen listing a whole calculation and wrong under the list of answers
    // the operator opened in order to type into it.
    if (this.layout() === 'inline') return true;
    return !row.collapsible || this.opened().has(row.id);
  }

  /** How many answer chips fit on one line before the row starts stacking. */
  private static readonly FACT_CHIPS = 8;

  /** Set once the operator asks for the rest; there is nothing to collapse back to. */
  protected readonly allFacts = signal(false);

  protected readonly shownFacts = computed(() =>
    this.allFacts()
      ? this.readsFacts()
      : this.readsFacts().slice(0, ProductRuleEditorComponent.FACT_CHIPS),
  );

  protected readonly hiddenFactCount = computed(
    () => this.readsFacts().length - this.shownFacts().length,
  );

  protected moreFactsLabel(): string {
    const count = this.hiddenFactCount();
    return $localize`:@@product_rule.reads_more:+${count}:COUNT: more`;
  }

  protected readonly groupsAria = $localize`:@@product_rule.groups_aria:What this rule needs set`;
  // Same ids as before, moved off the template so the field component can render them as a
  // real `for`-associated label rather than a span the input happens to sit next to.
  protected readonly atLeastLabel = $localize`:@@product_rule.gate.at_least:At least`;
  protected readonly atMostLabel = $localize`:@@product_rule.gate.at_most:At most`;

  /**
   * Which group is on stage. Empty until the operator picks, so it always follows the
   * rule's own first group — a stored id would go stale the moment a product's structure
   * changed under it, and point at a group that no longer exists.
   */
  protected readonly pickedGroup = signal<string>('');

  protected readonly activeGroup = computed<string>(() => {
    const groups = this.groups();
    const picked = this.pickedGroup();
    if (groups.some((g) => g.key === picked)) return picked;
    return groups[0]?.key ?? '';
  });

  protected readonly groupTabs = computed<RailTabItem[]>(() =>
    this.groups().map((g) => ({
      id: g.key,
      label: g.title,
      // No `count`: `note` is already "2 of 4 set", so a trailing number repeated the total
      // and read as a stray figure spliced onto the title ("Ways to work the figure out 4").
      note: g.count,
      // A group holding a figure this PROGRAM owes is the only warnable state; on the
      // catalog nothing is owed, so nothing warns.
      warn: g.rows.some((r) => r.owed),
      warnLabel: $localize`:@@product_rule.group_warn:Needs figures`,
    })),
  );

  /** The one group the rail has on stage — or all of them when there is no rail. */
  protected readonly shownGroups = computed(() => {
    const groups = this.groups();
    // Inline there is no rail to switch with, so every surviving group renders. Filtering to
    // one would hide figures the list keys with nothing on screen saying so.
    if (this.layout() === 'inline') return groups;
    if (groups.length <= 1) return groups;
    const active = this.activeGroup();
    return groups.filter((g) => g.key === active);
  });

  /** The rail, and the frame it belongs to, exist only in the full layout. */
  protected readonly showsRail = computed(
    () => this.layout() === 'full' && this.groupTabs().length > 1,
  );

  /** A group names itself when no rail does — and inline, only when there is more than one. */
  protected readonly showsGroupHeads = computed(() =>
    this.layout() === 'inline' ? this.shownGroups().length > 1 : this.groupTabs().length <= 1,
  );

  private readonly factByKey = computed(() => new Map(this.facts().map((f) => [f.key, f])));

  private readonly stepById = computed(() => new Map(this.steps().map((s) => [s.id, s])));

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
   * Every answer this pipeline reads, in the words the operator sees on the questionnaire.
   *
   * Derived from the rule exactly as the backend's `factsReadBy` is — a second list of "the
   * questions this product needs" could only drift out of step with the rule that reads them.
   */
  protected readonly readsFacts = computed<string[]>(() =>
    factKeysReadBy(this.steps(), this.gates()).map((key) => this.factLabel(key)),
  );

  /**
   * The two kinds of `coalesce` membership, which look identical in the blob and mean
   * opposite things to the operator.
   *
   *   alternatives  a coalesce of STEPS ONLY. Every bank fills exactly one; a blank one is
   *                 another bank's way of working the same figure out.
   *   adjustments   a coalesce that also offers a `{const}`. Blank is a real answer — the
   *                 fallback applies and the figure passes through unchanged.
   */
  private readonly coalesceMembers = computed(() => {
    const alternatives = new Set<string>();
    const adjustments = new Set<string>();
    for (const step of this.steps()) {
      if (step.op !== 'coalesce') continue;
      const refs = stepRefs(step);
      const target = refs.some((ref) => 'const' in ref) ? adjustments : alternatives;
      for (const ref of refs) if ('step' in ref) target.add(ref.step);
    }
    return { alternatives, adjustments };
  });

  /** Steps that exist only to be compared against — they render ON the gate that reads them. */
  private readonly gateInputIds = computed(() => {
    const ids = new Map<string, string>();
    for (const gate of this.gates()) {
      if (gate.kind === 'number' && gate.right !== undefined && 'step' in gate.right) {
        ids.set(gate.right.step, gate.id);
      }
    }
    return ids;
  });

  /**
   * What each step's figures actually MEASURE, read off the steps that consume them.
   *
   * "Assumed monthly income (EGP)" is the eleven single-fact methods' column, and on a
   * pipeline it is simply false: the multi-unit table holds 100 and 95, the car table
   * holds 70 / 60 / 50, the compound cap table holds millions of pounds. Three columns
   * headed the same way, one of them right. A figure's kind is not stored anywhere — but
   * it is implied exactly, by the arithmetic that reads it: the SECOND input of a
   * `percentOf` is a percentage, of a `multiply` a multiplier, and everything else is
   * money. A `coalesce` or a `pickByFact` passes its value straight through, so its
   * members inherit whatever the consumer said.
   */
  private readonly valueKinds = computed(() => {
    const kinds = new Map<string, 'percent' | 'multiplier'>();
    const mark = (id: string, kind: 'percent' | 'multiplier', depth = 0): void => {
      if (depth > 4) return;
      kinds.set(id, kind);
      const step = this.stepById().get(id);
      if (step === undefined) return;
      if (step.op !== 'coalesce' && step.op !== 'pickByFact') return;
      for (const ref of stepRefs(step)) if ('step' in ref) mark(ref.step, kind, depth + 1);
    };
    for (const step of this.steps()) {
      const refs = stepRefs(step);
      if (refs.length < 2) continue;
      const kind =
        step.op === 'multiply'
          ? ('multiplier' as const)
          : step.op === 'percentOf' || step.op === 'upliftPercent'
            ? ('percent' as const)
            : null;
      if (kind === null) continue;
      for (const ref of refs.slice(1)) if ('step' in ref) mark(ref.step, kind);
    }
    // A gate's right-hand table is compared against its left, so it is measured in the
    // same thing — which is how a required-down-payment BAND table is known to hold
    // percentages when nothing multiplies by it.
    for (const gate of this.gates()) {
      if (gate.kind !== 'number' || gate.right === undefined) continue;
      if (!('step' in gate.right) || !('step' in gate.left)) continue;
      const leftKind = kinds.get(gate.left.step);
      if (leftKind !== undefined) mark(gate.right.step, leftKind);
    }
    return kinds;
  });

  private valueLabelFor(stepId: string): string {
    switch (this.valueKinds().get(stepId)) {
      case 'percent':
        return $localize`:@@product_rule.col.percent:Percentage (%)`;
      case 'multiplier':
        return $localize`:@@product_rule.col.multiplier:Multiplier (×)`;
      default:
        return $localize`:@@product_rule.col.amount:Amount (EGP)`;
    }
  }

  /** A `pickByFact` column → the step that picks it. A column never renders on its own. */
  private readonly columnHeads = computed(() => {
    const heads = new Map<string, string>();
    for (const step of this.steps()) {
      if (step.op !== 'pickByFact') continue;
      for (const ref of stepRefs(step)) if ('step' in ref) heads.set(ref.step, step.id);
    }
    return heads;
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
    const { alternatives } = this.coalesceMembers();
    for (const step of this.steps()) {
      if (step.op !== 'coalesce') continue;
      // ALTERNATIVES only. An ADJUSTMENT is a coalesce too (a table beside a `{const}`
      // fallback), and scanning those made the screen answer "this bank works the ceiling
      // out from: do you own more than one unit?" — a policy multiplier named as the
      // derivation, on a program that derives nothing at all.
      if (!stepRefs(step).some((ref) => 'step' in ref && alternatives.has(ref.step))) continue;
      for (const ref of stepRefs(step)) {
        if ('step' in ref && this.reachesFigures(ref.step, configured)) {
          const chosen = this.stepById().get(ref.step);
          if (chosen) return this.titleFor(this.namedColumn(chosen, configured));
        }
      }
    }
    return null;
  });

  /**
   * Whether a step produces anything — following a `pickByFact` into its columns, because
   * the pick itself states no figures and is "configured" by definition.
   */
  private reachesFigures(id: string, configured: ReadonlySet<string>): boolean {
    const step = this.stepById().get(id);
    if (step === undefined) return false;
    if (step.op !== 'pickByFact') return configured.has(id);
    return stepRefs(step).some((ref) => 'step' in ref && this.reachesFigures(ref.step, configured));
  }

  /**
   * Look THROUGH a two-column pick to the column that carries the figures.
   *
   * "Whichever column fits the customer" is the honest name for the step, and a useless
   * answer to "what does this bank work the ceiling out from?" — the operator wants the
   * table's own words.
   */
  private namedColumn(step: RuleStep, configured: ReadonlySet<string>): RuleStep {
    if (step.op !== 'pickByFact') return step;
    for (const ref of stepRefs(step)) {
      if ('step' in ref && configured.has(ref.step)) {
        const column = this.stepById().get(ref.step);
        if (column) return column;
      }
    }
    return step;
  }

  // --- the grouped rows ------------------------------------------------------

  protected readonly groups = computed<RowGroup[]>(() => {
    const { alternatives, adjustments } = this.coalesceMembers();
    const gateInputs = this.gateInputIds();
    const columns = this.columnHeads();
    const shown = this.shownSlotIds();

    const chain: EditorRow[] = [];
    const alts: EditorRow[] = [];
    const adjs: EditorRow[] = [];

    for (const step of this.steps()) {
      // A pick states no figures of its own, but its columns do — so it is a row, and they
      // are its slots.
      const isPick = step.op === 'pickByFact';
      if (!isPick && !stepTakesFigures(step)) continue;
      if (columns.has(step.id)) continue;
      if (gateInputs.has(step.id)) continue;

      const row = this.narrow(this.stepRow(step), shown);
      if (row === null) continue;
      if (alternatives.has(step.id)) alts.push(row);
      else if (adjustments.has(step.id)) adjs.push(row);
      else chain.push(row);
    }

    const conditions = this.gates()
      .map((gate) => this.narrow(this.gateRow(gate), shown))
      .filter((row): row is EditorRow => row !== null);

    const groups: RowGroup[] = [];
    if (chain.length > 0) {
      groups.push({
        key: 'chain',
        title:
          this.variant() === 'catalog'
            ? $localize`:@@product_rule.group.chain_catalog:Amounts every bank starts from`
            : $localize`:@@product_rule.group.chain_program:Amounts this bank sets`,
        hint: '',
        count: this.countLabel(chain),
        rows: chain,
      });
    }
    if (alts.length > 0) {
      groups.push({
        key: 'alternative',
        title: $localize`:@@product_rule.group.alternatives:Ways to work the figure out`,
        hint:
          this.variant() === 'catalog'
            ? $localize`:@@product_rule.group.alternatives_hint_catalog:Every bank fills in exactly one of these. An amount you set here is the starting point for a bank that keeps the catalog's figures.`
            : $localize`:@@product_rule.group.alternatives_hint_program:Fill in exactly one. The rest are other banks' ways of working the same figure out.`,
        count: this.countLabel(alts),
        rows: alts,
      });
    }
    if (adjs.length > 0) {
      groups.push({
        key: 'adjustment',
        title: $localize`:@@product_rule.group.adjustments:Adjustments`,
        hint: $localize`:@@product_rule.group.adjustments_hint:Left blank, the figure passes through unchanged.`,
        count: this.countLabel(adjs),
        rows: adjs,
      });
    }
    if (conditions.length > 0) {
      groups.push({
        key: 'condition',
        title: $localize`:@@product_rule.group.conditions:Conditions`,
        hint:
          this.variant() === 'catalog'
            ? $localize`:@@product_rule.group.conditions_hint_catalog:A condition applies only where a bank turns it on, so leaving these alone refuses nobody.`
            : $localize`:@@product_rule.group.conditions_hint_program:Turn on only the ones this bank applies. Blank means the customer is never refused for it.`,
        count: this.countLabel(conditions),
        rows: conditions,
      });
    }
    return groups;
  });

  /**
   * A row with only the slots this mount renders, or `null` when none survive.
   *
   * `configured` and the state line are recomputed from what is left: a row saying "no
   * default set" because of a figure it is not showing would be reporting on somebody
   * else's list.
   */
  private narrow(row: EditorRow, shown: ReadonlySet<string> | null): EditorRow | null {
    if (shown === null) return row;
    const slots = row.slots.filter((slot) => shown.has(slot.id));
    if (slots.length === 0) return null;
    const configured = slots.some((slot) => slot.configured);
    return {
      ...row,
      slots,
      configured,
      state: this.stateFor(row.optional, configured),
      owed: !row.optional && !configured && this.variant() === 'program',
    };
  }

  private countLabel(rows: readonly EditorRow[]): string {
    const set = rows.filter((row) => row.configured).length;
    const total = rows.length;
    return $localize`:@@product_rule.group.count:${set}:set: of ${total}:total: set`;
  }

  private stepRow(step: RuleStep): EditorRow {
    const slots = step.op === 'pickByFact' ? this.columnSlots(step) : [this.stepSlot(step)];
    const configured = slots.some((slot) => slot.configured);
    const optional = this.optional().has(step.id);
    const pickedColumn = step.op === 'pickByFact' ? this.firstColumn(step) : null;
    return {
      kind: 'step',
      id: step.id,
      title: this.titleFor(pickedColumn ?? step),
      qualifier:
        pickedColumn === null
          ? ''
          : $localize`:@@product_rule.step.pick_split:split by ${this.factLabel(step.fact ?? '')}:fact:`,
      hint: this.hintFor(step),
      slots,
      optional,
      configured,
      collapsible: optional && !configured,
      state: this.stateFor(optional, configured),
      owed: !optional && !configured && this.variant() === 'program',
    };
  }

  private stepSlot(step: RuleStep): FigureSlot {
    const shape = STEP_OP_SHAPE[step.op];
    return {
      id: step.id,
      label: null,
      // 'steps' cannot occur (a pipeline is not an op). 'none' CAN reach here — through a
      // pick's columns and through a gate's right-hand step, neither of which passes the
      // group filter — and it means "this step states no figure at all", so it renders as
      // read-only rather than as a money box whose value nothing would ever read.
      shape: shape === 'steps' ? 'scalar' : shape,
      keyOptions: this.keyOptionsFor(step),
      unit: this.unitFor(step),
      // Only `constant` states a plain amount; every other scalar op's own figure is a
      // percentage or a multiplier, neither of which is money.
      money: step.op === 'constant',
      valueLabel: this.valueLabelFor(step.id),
      secondId: null,
      secondLabel: null,
      configured: stepIsConfigured(step, this.figures()[step.id]),
    };
  }

  /** The column a pick reads for everyone — the one that names the derivation. */
  private firstColumn(step: RuleStep): RuleStep | null {
    for (const ref of stepRefs(step)) {
      if (!('step' in ref)) continue;
      const column = this.stepById().get(ref.step);
      if (column !== undefined) return column;
    }
    return null;
  }

  /**
   * The columns of a `pickByFact`.
   *
   * TWO KEY TABLES BECOME ONE, with a value column each: they are keyed by the same fact
   * by construction, so they are the same table read for two kinds of customer — and as
   * two stacked editors they cost 550px of screen for six numbers and put the two figures
   * being compared out of sight of each other. Anything else (a pair of band tables) stays
   * two editors, because there is no single row a pair of ranges shares.
   */
  private columnSlots(step: RuleStep): FigureSlot[] {
    // The RAW index is carried through, because `branches` is positional against `of` and a
    // literal member is a legal entry. Labelling by the filtered index put the cross-sell
    // heading over the everyone-else column the moment a pick carried a `{const}` — and
    // `flow()` and the engine both index the unfiltered list, so the screen contradicted
    // itself about the same rule.
    const columns = stepRefs(step).flatMap((ref, index) => {
      if (!('step' in ref)) return [];
      const column = this.stepById().get(ref.step);
      return column === undefined ? [] : [{ column, index }];
    });

    // TWO columns merge into one table; three or more render as stacked editors, each
    // labelled by its own branch. Not generalised to N: `pickByFact` permits any arity, but
    // no product uses more than two and an N-column table would fork the key-matching,
    // re-key, reorder and delete paths per column — speculative surface on the one control
    // that edits live figures. The stacked fallback is correct, just less compact.
    const [first, second] = columns;
    if (
      columns.length === 2 &&
      first !== undefined &&
      second !== undefined &&
      STEP_OP_SHAPE[first.column.op] === 'keyTable' &&
      STEP_OP_SHAPE[second.column.op] === 'keyTable' &&
      // Merged into ONE table only when the two columns really are the same table read for
      // two kinds of customer. Two `keyTable` steps keyed by DIFFERENT facts (or one a
      // parent table and one a choice table) share no row, and merging them would write one
      // column's keys into the other's step.
      first.column.op === second.column.op &&
      first.column.fact === second.column.fact
    ) {
      const base = this.stepSlot(first.column);
      return [
        {
          ...base,
          label: null,
          valueLabel: this.branchLabel(step, first.index),
          secondId: second.column.id,
          secondLabel: this.branchLabel(step, second.index),
          configured:
            base.configured || stepIsConfigured(second.column, this.figures()[second.column.id]),
        },
      ];
    }

    return columns.map(({ column, index }) => ({
      ...this.stepSlot(column),
      label: this.branchLabel(step, index),
    }));
  }

  private gateRow(gate: RuleGate): EditorRow {
    const configured = gateIsConfigured(gate, this.figures()[gate.id], this.configuredStepIds());
    return {
      kind: 'gate',
      id: gate.id,
      title: this.gateTitleFor(gate),
      qualifier: this.gateQualifierFor(gate),
      hint: this.gateHintFor(gate),
      slots: [this.gateSlot(gate)],
      // Every gate is optional by construction: the catalog offers the condition and the bank
      // turns on the one it applies (see `GateParams` on the backend).
      optional: true,
      configured,
      collapsible: !configured,
      state: this.stateFor(true, configured),
      owed: false,
    };
  }

  /**
   * A gate's figures — and, when the gate compares against a STEP, that step's editor.
   *
   * The requirement and the table stating it used to render as two rows a dozen apart, one
   * of them saying "worked out from the table above" and the other "A table of ranges" with
   * nothing to say which requirement it belonged to.
   */
  private gateSlot(gate: RuleGate): FigureSlot {
    const requirement = $localize`:@@product_rule.col.requirement:The requirement`;
    const gateUnit = this.gateUnitFor(gate);
    if (gate.kind === 'choice') {
      return {
        id: gate.id,
        label: null,
        shape: 'applies',
        keyOptions: null,
        unit: null,
        money: false,
        valueLabel: requirement,
        secondId: null,
        secondLabel: null,
        configured: this.figures()[gate.id]?.applies === true,
      };
    }
    if (gate.kind === 'numberByKey') {
      return {
        id: gate.id,
        label: null,
        shape: 'keyTable',
        keyOptions: this.factOptionsFor(gate.keyedBy),
        unit: null,
        money: false,
        valueLabel: requirement,
        secondId: null,
        secondLabel: null,
        configured: (this.figures()[gate.id]?.keyTable?.length ?? 0) > 0,
      };
    }
    if (gate.right !== undefined && 'step' in gate.right) {
      const step = this.stepById().get(gate.right.step);
      if (step !== undefined) return this.stepSlot(step);
    }
    const figures = this.figures()[gate.id];
    return {
      id: gate.id,
      label: null,
      shape: 'minmax',
      keyOptions: null,
      unit: gateUnit,
      money: gateUnit === null,
      valueLabel: requirement,
      secondId: null,
      secondLabel: null,
      configured:
        (figures?.minValue !== undefined && figures.minValue !== '') ||
        (figures?.maxValue !== undefined && figures.maxValue !== ''),
    };
  }

  /** What a row says about itself when it carries no figures. */
  private stateFor(optional: boolean, configured: boolean): string {
    if (configured) return '';
    if (!optional) {
      return this.variant() === 'program'
        ? $localize`:@@product_rule.step.needs_figures:Needs figures`
        : $localize`:@@product_rule.step.no_default:No default set`;
    }
    return this.variant() === 'catalog'
      ? $localize`:@@product_rule.step.no_default:No default set`
      : $localize`:@@product_rule.step.not_used:Not used by this bank`;
  }

  protected readonly appliesLabel = computed<string>(() => {
    return this.variant() === 'catalog'
      ? $localize`:@@product_rule.gate.applies_catalog:On by default for every bank`
      : $localize`:@@product_rule.gate.applies:This bank applies this condition`;
  });

  /**
   * The whole calculation, in the order the engine runs it.
   *
   * Every step, including the ones with figures — this is the only place the product reads
   * as one thing, and a list with the arithmetic removed would not.
   *
   * A line is more than its op title because the op titles repeat: the compound rule states
   * "A table of ranges" three times, "A percentage of an earlier figure" four, and
   * "A table keyed by the answer: Unit type" twice in a row. What tells those apart is not
   * the step id (which is not a name) but what the step is FOR — which column of a pick it
   * fills, and which earlier lines it reads. Both are in the rule already.
   */
  protected readonly flow = computed<FlowLine[]>(() => {
    const steps = this.steps();
    const ordinal = new Map(steps.map((step, i) => [step.id, i + 1] as const));

    // Which column of a `pickByFact` a step fills. The two columns of one pick are the same
    // words twice by construction — they are keyed by the same fact — and the pick itself
    // is the only place the rule says which is which.
    const column = new Map<string, string>();
    for (const step of steps) {
      if (step.op !== 'pickByFact') continue;
      stepRefs(step).forEach((ref, index) => {
        if ('step' in ref) column.set(ref.step, this.branchLabel(step, index));
      });
    }

    const readByStep = new Set<string>();
    for (const step of steps) {
      for (const ref of stepRefs(step)) if ('step' in ref) readByStep.add(ref.step);
    }
    const gateInputs = this.gateInputIds();
    const answerId = this.output()?.from;

    return steps.map((step, i) => ({
      n: i + 1,
      title: this.titleFor(step),
      qualifier: column.get(step.id) ?? '',
      from: stepRefs(step)
        .map((ref) => ('step' in ref ? ordinal.get(ref.step) : undefined))
        .filter((n): n is number => n !== undefined),
      // Nothing downstream reads it and it is not the answer, so without saying so it
      // dangles past the last line looking like a step the calculation forgot.
      gateOnly: !readByStep.has(step.id) && step.id !== answerId && gateInputs.has(step.id),
      answer: step.id === answerId,
    }));
  });

  /** Read out as words, because the numerals alone say nothing to a screen reader. */
  protected fromLabel(from: readonly number[]): string {
    const refs = from.join(', ');
    return $localize`:@@product_rule.flow.from:From ${refs}:refs:`;
  }

  // --- figure accessors ------------------------------------------------------

  protected tableFor(id: string): IncomeKeyTableRow[] {
    return this.figures()[id]?.keyTable ?? NO_ROWS;
  }

  protected bandsFor(id: string): IncomeBand[] {
    return this.figures()[id]?.bands ?? NO_BANDS;
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

  /** The second column of a merged pair. Null id cannot occur — the template guards it. */
  protected setSecondTable(id: string | null, rows: IncomeKeyTableRow[] | null): void {
    if (id === null || rows === null) return;
    this.patch(id, { keyTable: rows });
  }

  protected setBands(id: string, bands: IncomeBand[]): void {
    this.patch(id, { bands });
  }

  protected setScalar(id: string, raw: string): void {
    const step = this.stepById().get(id);
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
      case 'pickByFact':
        return $localize`:@@product_rule.step.pick_by_fact:Whichever column fits the customer: ${factLabel}:factLabel:`;
      default:
        return step.id;
    }
  }

  private hintFor(step: RuleStep): string {
    if (step.op === 'pickByFact') {
      // Worded for the AXIS in general, not for one of them. The first spelling said "only if
      // this bank lends more to customers it already has" — true of a new-customer column and
      // simply false of a city tier, a school type or a university type, which is what this
      // shape is now keyed by more often than not. What holds for every axis is the mechanic:
      // the first column is everyone's, and a column left empty falls back to it.
      return $localize`:@@product_rule.step.pick_by_fact_hint:Fill in the first column for everyone. Fill in another only where this bank prices that group differently — left empty, it reads the first.`;
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
      case 'SELF_EMPLOYED_DOCS_MISSING':
        return $localize`:@@product_rule.gate.self_employed_docs:Self-employed customers need a valid trade or practice licence`;
      case 'BUSINESS_TOO_NEW':
        return $localize`:@@product_rule.gate.business_years:How long a self-employed customer's business must have been running`;
      default:
        return $localize`:@@product_rule.gate.other:A condition on the answers`;
    }
  }

  /**
   * What tells two gates with the same reason code apart.
   *
   * The compound rule states a down-payment floor FOUR ways — a flat percentage, a
   * percentage that varies with the unit price, a flat amount, and an amount that varies
   * with employment — and every one of them is titled "Minimum the customer must have
   * paid", because the reason the customer is refused is the same. What differs is the
   * figure it is measured on, which the structure already says.
   */
  private gateQualifierFor(gate: RuleGate): string {
    if (gate.kind === 'choice') return '';
    if (gate.kind === 'numberByKey') {
      const keyed = this.factLabel(gate.keyedBy);
      return $localize`:@@product_rule.gate.by_key:one figure per ${keyed}:keyed:`;
    }
    if (gate.right !== undefined) {
      const against = this.refLabel(gate.right);
      return against === null
        ? ''
        : $localize`:@@product_rule.gate.against:compared with ${against}:against:`;
    }
    const measured = this.refLabel(gate.left);
    return measured === null
      ? ''
      : $localize`:@@product_rule.gate.measured_on:measured on ${measured}:measured:`;
  }

  /**
   * What a reference is, in the operator's words — following a step to the answer it reads.
   *
   * A step id is not a name and an op title ("A percentage of an earlier figure") says
   * nothing about WHICH figure, so the walk stops at the first fact it reaches, which is the
   * only part of a chain the operator recognises from the questionnaire.
   */
  private refLabel(ref: ValueRef, depth = 0): string | null {
    if ('fact' in ref) return this.factLabel(ref.fact);
    if ('const' in ref) return null;
    if (depth > 4) return null;
    const step = this.stepById().get(ref.step);
    if (step === undefined) return null;
    if (step.fact) return this.factLabel(step.fact);
    for (const inner of stepRefs(step)) {
      const label = this.refLabel(inner, depth + 1);
      if (label !== null) return label;
    }
    return null;
  }

  private gateHintFor(gate: RuleGate): string {
    if (gate.kind === 'numberByKey') {
      return $localize`:@@product_rule.gate.by_key_hint:One row per answer. Leave the table empty and this condition does not apply to this bank.`;
    }
    if (gate.kind === 'number' && gate.right !== undefined) {
      return $localize`:@@product_rule.gate.right_step_hint:The requirement is the table below — fill it in and the condition applies, leave it empty and it does not.`;
    }
    return $localize`:@@product_rule.gate.blank_hint:Leave blank and this condition does not apply to this bank.`;
  }

  /** The document's locale, the same way the section above this one reads it. */
  private readonly isAr = document.documentElement.lang.startsWith('ar');

  private factLabel(key: string): string {
    const fact = this.factByKey().get(key);
    if (fact?.label) return fact.label;
    // A DERIVED fact has no registry row and so no operator-authored label — the platform
    // computes it, so the platform names it.
    const derived = derivedFactByKey(key);
    if (derived) return derived.label;
    return key;
  }

  /**
   * Which answer a `pickByFact` column belongs to.
   *
   * The bank-relationship fact is derived, so it has no bound question and no options to
   * read the words off — the platform computes it and so the platform names its two
   * answers, exactly as the check panel already does.
   */
  private branchLabel(step: RuleStep, index: number): string {
    const code = step.branches?.[index];
    if (code === undefined) return '';
    // A CLASS-keyed column's branches are the keys of the list the answers are FILED UNDER,
    // not the answers themselves — so the answer list cannot name them and the heading
    // rendered as a raw slug (`city_tier_major`) over the table an operator is typing
    // figures into. The class list is already on the fact (`parentOptions`, derived
    // server-side by coverage), which is where the words are.
    if (step.branchOn === 'parentClass') {
      const parent = this.factByKey()
        .get(step.fact ?? '')
        ?.question?.parentOptions.find((o) => o.code === code);
      if (parent) return this.isAr ? parent.labelAr : parent.labelEn;
      return code;
    }
    const option = this.factOptionsFor(step.fact ?? '')?.find((o) => o.key === code);
    // This string is a visible COLUMN HEADING, so it follows the document's locale. Reading
    // `labelEn` unconditionally put English headings over the pipeline's only two-column
    // table in the Arabic build (Principle IV / A20), with the Arabic label already in hand.
    if (option) return this.isAr ? option.labelAr : option.labelEn;
    // A derived axis names its own columns — the three of them spell their branches
    // differently on purpose, so a heading can never be read off the wrong axis.
    const derivedOption = derivedFactByKey(step.fact ?? '')?.options.find((o) => o.code === code);
    if (derivedOption) return derivedOption.label;
    return code;
  }

  private keyOptionsFor(
    step: RuleStep,
  ): readonly { key: string; labelEn: string; labelAr: string }[] | null {
    if (step.op === 'factChoiceTable' && step.fact) return this.factOptionsFor(step.fact);
    // A PARENT table is keyed by the list the answers are FILED UNDER — compound CLASSES,
    // where the answer is a compound name. That list is not guessed here: the fact registry
    // carries it (`boundQuestion.parentOptions`), derived by walking `parentKey` server-side.
    // Absent means the walk found no parent list, and the table says so — an empty key list
    // used to render a seed button that could only ever produce zero rows.
    if (step.op === 'factParentTable' && step.fact) return this.parentOptionsFor(step.fact);
    return null;
  }

  private parentOptionsFor(
    factKey: string,
  ): readonly { key: string; labelEn: string; labelAr: string }[] | null {
    return this.optionsByFact().get(parentKeyOf(factKey)) ?? null;
  }

  /**
   * The option lists, mapped ONCE per registry read.
   *
   * These reach a child as `[keyOptions]`, and `groups()` is rebuilt on every keystroke, so
   * mapping them per call handed every key table a brand-new array per character typed —
   * which invalidates the child's own computeds and re-renders its whole `nz-option` list.
   * Keyed by fact, so the reference is stable for as long as the registry is.
   */
  private readonly optionsByFact = computed(() => {
    const out = new Map<string, readonly { key: string; labelEn: string; labelAr: string }[]>();
    for (const fact of this.facts()) {
      const question = fact.question;
      if (!question) continue;
      if (question.options.length > 0) {
        out.set(
          fact.key,
          question.options.map((o) => ({ key: o.code, labelEn: o.labelEn, labelAr: o.labelAr })),
        );
      }
      if (question.parentOptions.length > 0) {
        out.set(
          parentKeyOf(fact.key),
          question.parentOptions.map((o) => ({
            key: o.code,
            labelEn: o.labelEn,
            labelAr: o.labelAr,
          })),
        );
      }
    }
    return out;
  });

  private factOptionsFor(
    factKey: string,
  ): readonly { key: string; labelEn: string; labelAr: string }[] | null {
    return this.optionsByFact().get(factKey) ?? null;
  }

  /**
   * What a gate's bound is measured in — read off the step it compares, not off the gate.
   *
   * A bare "At least [    ]" is the same field whether the bank means 20 per cent of the
   * price or 20 pounds, and the operator has no way to tell which the engine will read.
   * `valueKinds` already knows a step's kind wherever the arithmetic proves it, so a
   * down-payment SHARE gate says `%` and a down-payment AMOUNT gate says nothing —
   * deliberately: nothing in this screen's data proves `monthsOwned` is months rather than
   * pounds, and a confidently wrong `EGP` on a contract-age gate is worse than a blank.
   */
  private gateUnitFor(gate: RuleGate): string | null {
    if (gate.kind !== 'number') return null;
    if (!('step' in gate.left)) return null;
    switch (this.valueKinds().get(gate.left.step)) {
      case 'percent':
        return $localize`:@@product_rule.unit.percent:%`;
      case 'multiplier':
        return $localize`:@@product_rule.unit.multiplier:× multiplier`;
      default:
        return null;
    }
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
