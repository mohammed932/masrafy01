/**
 * Which value list a product's figures are keyed by.
 *
 * PURE — no Angular, no `$localize`, no HTTP, same posture as
 * `features/program-catalog/catalog-board.ts`.
 *
 * THE ONE RULE. A figure belongs to a SLOT — a step id or a gate id inside
 * `incomeRule.stepParams` — and never to a lookup value. What attaches a slot to an
 * operator-managed list is the slot's KEY SET:
 *
 * - `factChoiceTable`, and a `numberByKey` gate, are keyed by the ANSWERS the applicant
 *   picks (`fact.question.optionsEnumerationType`);
 * - `factParentTable` is keyed by the CLASSES those answers are filed under
 *   (`fact.question.parentEnumerationType`);
 * - a `pickByFact` whose columns are keyed by no list of their own (a band table keyed by a
 *   number) hangs on its own BRANCH set — the answers it splits by, or the classes those
 *   answers are filed under when it branches on `parentClass`. One figure table per branch.
 *
 * So a compound's price is stated once per CLASS, and the figures belong beside the class
 * list rather than beside the three hundred compound names. A screen that keyed off the
 * answer list instead would print "no default set" against every compound in Egypt and
 * invent a defect where there is none.
 *
 * WHY IT IS A MODULE AND NOT A METHOD. The same join decides what
 * `product-rule-editor.component.ts` renders and what the product page says about each
 * list. Derived twice, the two would disagree the first time a `pickByFact` carried two
 * columns keyed by different facts — and disagree silently, which is the only kind of
 * failure this file exists to make loud.
 *
 * Every decision below MIRRORS the editor rather than restating it: the skip rules from
 * `groups()`, the two-column merge condition from `columnSlots()`, and the gate key set
 * from `gateSlot()`. Change one and change both.
 */
import {
  STEP_OP_SHAPE,
  stepRefs,
  type RegistryFact,
  type RuleGate,
  type RuleStep,
} from '@features/bank-programs/bank-programs.types';

/** One figure box keyed by a list, and the editor row it renders on. */
export interface KeyedSlot {
  /** The `stepParams` key the figures live under. */
  readonly id: string;
  /**
   * The second column of a merged `pickByFact` pair, or `null`.
   *
   * Two key tables keyed by the SAME fact are one table read for two kinds of customer, and
   * the editor renders them as one grid with two value columns — so they are one slot here
   * too, or the same table would attach to its list twice.
   */
  readonly secondId: string | null;
  /** The editor row the slot is drawn on: a pick's own id, a gate's id, or the step itself. */
  readonly rowId: string;
  readonly factKey: string;
  /** Whether the keys are the answers themselves or the classes they are filed under. */
  readonly axis: 'answer' | 'class';
}

/** What a value list carries, from the product's point of view. */
export type ListFigureState =
  /** One figure per value on this list. */
  | 'keyed'
  /** The values are answers, but the amount is stated per class they are filed under. */
  | 'byClass'
  /** No figure is keyed by these values at all — they steer the calculation, not the money. */
  | 'unpriced';

const KEY_TABLE_OPS = new Set<RuleStep['op']>(['factChoiceTable', 'factParentTable']);

function axisOf(step: RuleStep): 'answer' | 'class' {
  return step.op === 'factParentTable' ? 'class' : 'answer';
}

function slotOf(step: RuleStep, rowId: string, secondId: string | null): KeyedSlot | null {
  if (!KEY_TABLE_OPS.has(step.op) || !step.fact) return null;
  return { id: step.id, secondId, rowId, factKey: step.fact, axis: axisOf(step) };
}

/**
 * Every slot in a rule whose figures are keyed by a list.
 *
 * A step rendered as somebody else's slot — a pick's column, a gate's right-hand input — is
 * reached through its owner, exactly as `groups()` does, so it is never counted twice.
 */
export function keyedSlots(steps: readonly RuleStep[], gates: readonly RuleGate[]): KeyedSlot[] {
  const byId = new Map(steps.map((s) => [s.id, s]));

  const columnHeads = new Set<string>();
  for (const step of steps) {
    if (step.op !== 'pickByFact') continue;
    for (const ref of stepRefs(step)) if ('step' in ref) columnHeads.add(ref.step);
  }

  const gateInputs = new Set<string>();
  for (const gate of gates) {
    if (gate.kind === 'number' && gate.right !== undefined && 'step' in gate.right) {
      gateInputs.add(gate.right.step);
    }
  }

  const out: KeyedSlot[] = [];

  for (const step of steps) {
    if (step.op === 'pickByFact') {
      const columns = stepRefs(step).flatMap((ref) => {
        if (!('step' in ref)) return [];
        const column = byId.get(ref.step);
        return column === undefined ? [] : [column];
      });

      // The editor's merge condition, verbatim: exactly two columns, both key tables, same
      // op and same fact. Anything else stays one slot per column — two tables keyed by
      // DIFFERENT facts share no row, so they belong under two different lists.
      const [first, second] = columns;
      if (
        columns.length === 2 &&
        first !== undefined &&
        second !== undefined &&
        STEP_OP_SHAPE[first.op] === 'keyTable' &&
        STEP_OP_SHAPE[second.op] === 'keyTable' &&
        first.op === second.op &&
        first.fact === second.fact
      ) {
        const merged = slotOf(first, step.id, second.id);
        if (merged) out.push(merged);
        continue;
      }

      const perColumn = columns.flatMap((column) => {
        const slot = slotOf(column, step.id, null);
        return slot === null ? [] : [slot];
      });
      if (perColumn.length > 0) {
        out.push(...perColumn);
        continue;
      }

      // THE COLUMNS THEMSELVES ARE KEYED BY NO LIST, and the list is the pick's own BRANCH
      // set. The doctors' product is the case: each column is a band table keyed by years in
      // practice — a number, so no list — while WHICH column is read comes from the city
      // tier the governorate is filed under. One figure set per tier, keyed by the tier list,
      // and a screen that only ever looked at a column's own keys reported "no amount is
      // keyed by these" over the three tables an operator has to fill in.
      //
      // Reached only when NO column produced a slot of its own: a pick whose columns are key
      // tables (the compound and bank-axis products) attaches by those keys exactly as
      // before, because a column's own keys are the finer statement of where its figures go.
      if (step.fact !== undefined) {
        const axis = step.branchOn === 'parentClass' ? 'class' : 'answer';
        for (const column of columns) {
          // A column that states no figure at all has nothing to key — it renders read-only.
          if (STEP_OP_SHAPE[column.op] === 'none') continue;
          out.push({ id: column.id, secondId: null, rowId: step.id, factKey: step.fact, axis });
        }
      }
      continue;
    }

    if (columnHeads.has(step.id) || gateInputs.has(step.id)) continue;
    const slot = slotOf(step, step.id, null);
    if (slot) out.push(slot);
  }

  for (const gate of gates) {
    if (gate.kind === 'numberByKey') {
      out.push({
        id: gate.id,
        secondId: null,
        rowId: gate.id,
        factKey: gate.keyedBy,
        axis: 'answer',
      });
      continue;
    }
    // A gate comparing against a STEP renders that step's own editor on the gate's row, so a
    // key-table requirement is keyed by a list like any other slot.
    if (gate.kind === 'number' && gate.right !== undefined && 'step' in gate.right) {
      const step = byId.get(gate.right.step);
      const slot = step ? slotOf(step, gate.id, null) : null;
      if (slot) out.push(slot);
    }
  }

  return out;
}

/**
 * The operator-managed list a slot's keys come from, or `null`.
 *
 * `null` is a real answer and never an error: a fact may be absent from the registry, its
 * question may have been switched off, and a question backed by no list (a yes/no, a
 * hand-authored option set) has nothing to curate.
 */
export function listTypeOf(slot: KeyedSlot, facts: readonly RegistryFact[]): string | null {
  const question = facts.find((f) => f.key === slot.factKey)?.question;
  if (!question) return null;
  return (
    (slot.axis === 'class' ? question.parentEnumerationType : question.optionsEnumerationType) ??
    null
  );
}

/**
 * The slots one list keys.
 *
 * Filtered by SLOT, never by row: a `pickByFact` whose two columns read different facts has
 * ONE row and two list homes, so filtering by row would print both columns under both lists.
 */
export function slotsKeyedByList(
  steps: readonly RuleStep[],
  gates: readonly RuleGate[],
  facts: readonly RegistryFact[],
  listType: string,
): KeyedSlot[] {
  return keyedSlots(steps, gates).filter((slot) => listTypeOf(slot, facts) === listType);
}

/**
 * What a list carries, and the slots it keys — one pass, for the panel that renders it.
 *
 * `byClass` is the case a naive implementation reports as "nothing set": the values ARE read,
 * and the amount for each of them is stated one level up, on the list they are filed under.
 */
export function listFigureState(
  steps: readonly RuleStep[],
  gates: readonly RuleGate[],
  facts: readonly RegistryFact[],
  listType: string,
): { state: ListFigureState; slots: KeyedSlot[] } {
  const all = keyedSlots(steps, gates);
  const slots = all.filter((slot) => listTypeOf(slot, facts) === listType);
  if (slots.length > 0) return { state: 'keyed', slots };

  const pricedByClass = all.some((slot) => {
    if (slot.axis !== 'class') return false;
    const question = facts.find((f) => f.key === slot.factKey)?.question;
    return question?.optionsEnumerationType === listType;
  });
  return { state: pricedByClass ? 'byClass' : 'unpriced', slots: [] };
}
