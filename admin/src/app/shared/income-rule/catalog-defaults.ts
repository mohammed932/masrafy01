/**
 * What the surrogate product states for a slot the bank has left blank.
 *
 * PURE — no Angular, no `$localize`, no HTTP, same posture as `figure-slots.ts` and
 * `product-rule-ways.ts`.
 *
 * ─── THE PROBLEM THIS SOLVES ──────────────────────────────────────────────────
 *
 * A new program IS seeded from the product (`seedFromCatalog`), and the first keystroke
 * detaches it onto its own figures. From that moment the product's numbers are unreachable
 * one at a time: the only way back is `resetToCatalog()`, which drops the WHOLE table. So an
 * operator who clears one box by accident — verified on the live program `ABK-PERSONAL-7110`,
 * which saved `cond__unitworthenough` and `cond__paidenough__bound` blank while the product
 * states 1,000,000 and 30% — has no way to recover that one figure without throwing away
 * every other number they typed.
 *
 * ─── WHY IT MIRRORS THE EDITOR RATHER THAN ASKING IT ──────────────────────────
 *
 * The same reasoning `figure-slots.ts` writes out for `keyedSlots`. "Which slot does this
 * figure belong to?" is answered by `stepRow`/`stepSlot`/`columnSlots`/`gateRow`/`gateSlot`,
 * and those are private methods on a 2 500-line component that drags Angular's JIT compiler
 * into any test that imports it. Derived twice the two would disagree — silently, and in the
 * one direction that matters: offering the product's default over a figure the bank already
 * typed, or withholding it from a slot that is genuinely empty.
 *
 * THE CASE A NAIVE WALK GETS WRONG. A gate that compares against a STEP renders that STEP's
 * editor on the gate's row (`gateSlot`, the `gate.right` branch). `cond__paidenough` is such a
 * gate: the box on screen writes `cond__paidenough__bound`, not `cond__paidenough`. A walk
 * that keyed gate slots by the gate id would look for a default under a key the product never
 * uses, find none, and report the one slot this whole module exists for as having no default.
 *
 * Change `stepSlot` / `columnSlots` / `gateSlot` and change this file with them.
 */
import {
  STEP_OP_SHAPE,
  stepRefs,
  stepTakesFigures,
  type RuleGate,
  type RuleStep,
  type StepFigures,
} from '@features/bank-programs/bank-programs.types';
import { writeFigure } from './figure-write';

/**
 * The shape of one editable box.
 *
 * A superset of `IncomeMethodShape`, and deliberately declared here rather than imported:
 * `minmax` (a gate's bounds) and `applies` (a gate's switch) exist only as EDITOR shapes —
 * no income method has them — and the editor's own `FigureSlot` says exactly this. `'steps'`
 * is absent because a pipeline is not an op and `shapeOf` already folds it into `scalar`.
 */
export type SlotFigureShape = 'keyTable' | 'bands' | 'scalar' | 'minmax' | 'applies' | 'none';

/** One editable box, and the shape of the figure it holds. */
export interface SlotShape {
  /** The `stepParams` key the figure lives under. */
  readonly id: string;
  readonly shape: SlotFigureShape;
  /** The editor row it is drawn on — a pick's id, a gate's id, or the step itself. */
  readonly rowId: string;
}

/** `stepSlot`'s shape rule, verbatim: a pipeline is not an op, so `'steps'` reads as scalar. */
function shapeOf(step: RuleStep): SlotFigureShape {
  const shape = STEP_OP_SHAPE[step.op];
  return shape === 'steps' ? 'scalar' : shape;
}

function columnsOf(step: RuleStep, byId: ReadonlyMap<string, RuleStep>): RuleStep[] {
  return stepRefs(step).flatMap((ref) => {
    if (!('step' in ref)) return [];
    const column = byId.get(ref.step);
    return column === undefined ? [] : [column];
  });
}

/**
 * Every slot an operator can type into, keyed by the `stepParams` id it writes.
 *
 * A merged two-column pick contributes BOTH ids — the editor draws one grid with two value
 * columns, but each column stores under its own key, and a default is offered per key.
 */
export function slotShapes(
  steps: readonly RuleStep[],
  gates: readonly RuleGate[],
): Map<string, SlotShape> {
  const byId = new Map(steps.map((step) => [step.id, step]));
  const out = new Map<string, SlotShape>();

  // The two sets `groups()` skips at top level, because each is reached through its owner.
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

  for (const step of steps) {
    // THE GUARD RUNS FIRST, picks included. `groups()` applies it to every step
    // (`columns.has(step.id)` / `gateInputs.has(step.id)`), and a pick can itself be another
    // pick's column: tick an income-scoped uplift on a product that already has a second
    // column and `emitUplift` makes the way's pick a column of the uplift's pick. Reached
    // through the pick branch instead, this walk yielded the money tables as slots the
    // editor draws NO box for — and the wizard's fill writes every slot this returns, so
    // opening a program silently stored a figure with nothing on screen to review it.
    if (columnHeads.has(step.id) || gateInputs.has(step.id)) continue;

    if (step.op === 'pickByFact') {
      for (const column of columnsOf(step, byId)) {
        // A column that states no figure renders read-only; there is nothing to default.
        if (STEP_OP_SHAPE[column.op] === 'none') continue;
        out.set(column.id, { id: column.id, shape: shapeOf(column), rowId: step.id });
      }
      continue;
    }
    if (!stepTakesFigures(step)) continue;
    out.set(step.id, { id: step.id, shape: shapeOf(step), rowId: step.id });
  }

  for (const gate of gates) {
    if (gate.kind === 'choice') {
      out.set(gate.id, { id: gate.id, shape: 'applies', rowId: gate.id });
      continue;
    }
    if (gate.kind === 'numberByKey') {
      out.set(gate.id, { id: gate.id, shape: 'keyTable', rowId: gate.id });
      continue;
    }
    // The load-bearing case: the box belongs to the BOUND STEP, not to the gate.
    if (gate.right !== undefined && 'step' in gate.right) {
      const step = byId.get(gate.right.step);
      if (step !== undefined) {
        out.set(step.id, { id: step.id, shape: shapeOf(step), rowId: gate.id });
        continue;
      }
    }
    out.set(gate.id, { id: gate.id, shape: 'minmax', rowId: gate.id });
  }

  return out;
}

function isBlankText(value: string | undefined): boolean {
  return value === undefined || value.trim() === '';
}

/**
 * Does this slot state nothing?
 *
 * Deliberately NOT `stepIsConfigured`: that answers "will the engine read a figure here",
 * which for a `pickByFact` is `true` unconditionally and for an optional step folds in the
 * catalog's own view. This answers the narrower question the affordance needs — is the BOX
 * empty — so it can be asked of a slot in isolation.
 */
export function figureIsBlank(shape: SlotFigureShape, figures: StepFigures | undefined): boolean {
  if (figures === undefined) return true;
  switch (shape) {
    case 'keyTable':
      return (figures.keyTable?.length ?? 0) === 0;
    case 'bands':
      return (figures.bands?.length ?? 0) === 0;
    case 'scalar':
      return isBlankText(figures.valueEGP) && isBlankText(figures.scalar?.value);
    case 'minmax':
      return isBlankText(figures.minValue) && isBlankText(figures.maxValue);
    case 'applies':
      return figures.applies !== true;
    // A step with nothing to state is never blank — there is no box to fill.
    default:
      return false;
  }
}

/**
 * A deep copy of the product's figure for one slot, or `null` when it states none.
 *
 * Deep, for the hazard `cloneStepFigures` exists for: a shallow copy hands the editor the
 * product's own arrays to mutate in place, and the operator's first keystroke would edit the
 * copy this program is supposed to be departing FROM.
 */
export function defaultFor(
  catalogFigures: Readonly<Record<string, StepFigures>> | undefined,
  slotId: string,
  shape: SlotFigureShape,
  current?: StepFigures,
): StepFigures | null {
  const source = catalogFigures?.[slotId];
  if (source === undefined) return null;
  if (figureIsBlank(shape, source)) return null;

  // A GATE'S TWO BOUNDS ARE TWO BOXES, and only the empty one may be offered.
  //
  // The editor renders `minValue` and `maxValue` independently (`wantsMin`/`wantsMax`), so a
  // `between` condition can legitimately have its floor typed and its ceiling blank. Offered
  // as one slot, the whole figure is merged in and the bank's own floor is overwritten by the
  // product's — silently, on a control labelled as filling in a blank.
  if (shape === 'minmax') {
    const trimmed: StepFigures = {};
    if (isBlankText(current?.minValue) && !isBlankText(source.minValue)) {
      trimmed.minValue = source.minValue;
    }
    if (isBlankText(current?.maxValue) && !isBlankText(source.maxValue)) {
      trimmed.maxValue = source.maxValue;
    }
    return Object.keys(trimmed).length === 0 ? null : trimmed;
  }

  return {
    ...source,
    ...(source.keyTable ? { keyTable: source.keyTable.map((row) => ({ ...row })) } : {}),
    ...(source.bands ? { bands: source.bands.map((band) => ({ ...band })) } : {}),
    ...(source.scalar ? { scalar: { ...source.scalar } } : {}),
  };
}

/** One slot's id and the figure the product states for it. */
export interface SlotDefault {
  readonly id: string;
  readonly rowId: string;
  readonly shape: SlotFigureShape;
  readonly figures: StepFigures;
}

/**
 * Every slot the bank left blank where the product states an amount.
 *
 * `ownedSlots` is PASSED IN, never derived here. It is
 * `wayOwnedSlots(steps, wayId) ∪ every slot no way owns`, and `product-rule-ways.ts` is its
 * one owner — a second derivation is how a default for an unchosen way ends up offered on a
 * screen that has already pruned it, and then saved.
 */
export function slotsMissingDefault(
  shapes: ReadonlyMap<string, SlotShape>,
  figures: Readonly<Record<string, StepFigures>>,
  catalogFigures: Readonly<Record<string, StepFigures>> | undefined,
  options: { readonly ownedSlots?: ReadonlySet<string> } = {},
): SlotDefault[] {
  const owned = options.ownedSlots;
  const out: SlotDefault[] = [];
  for (const slot of shapes.values()) {
    // A CONDITION'S SWITCH IS NOT A FIGURE, and it is deliberately never offered.
    //
    // An unticked choice gate is a stated decision — "this bank does not apply this" — not an
    // empty box, and the switch is right there on screen for an operator who disagrees.
    // Offering the product's own `applies: true` as a "default" would turn a refusal on
    // through a control labelled as though it were filling in a number.
    if (slot.shape === 'applies') continue;
    if (owned !== undefined && !owned.has(slot.id)) continue;
    // A gate is asked per BOUND, so its "is it blank" test is `defaultFor`'s own — a floor
    // typed and a ceiling empty is a half-blank slot, and the slot-level test says false.
    if (slot.shape !== 'minmax' && !figureIsBlank(slot.shape, figures[slot.id])) continue;
    const value = defaultFor(catalogFigures, slot.id, slot.shape, figures[slot.id]);
    if (value === null) continue;
    out.push({ id: slot.id, rowId: slot.rowId, shape: slot.shape, figures: value });
  }
  return out;
}

/** The figure map with one slot taken from the product. */
export function withDefault(
  figures: Readonly<Record<string, StepFigures>>,
  slot: SlotDefault,
): Record<string, StepFigures> {
  // THROUGH `writeFigure`, exactly as a keystroke goes. Spread verbatim, a per-field blank
  // inside an otherwise non-blank product figure was copied through — so the group's "Fill
  // them from the product" stored `{minValue:'20', maxValue:''}` where the row's "Use it"
  // stored `{minValue:'20'}`: two spellings of one state, from one default.
  return writeFigure(figures, slot.id, slot.figures);
}

/**
 * The figure map with every listed slot taken from the product, and what was filled.
 *
 * `filled` is the banner's content and the Undo's key set — the operator is told which
 * figures moved, by name, because filling a blank GATE turns a refusal ON.
 */
export function withAllDefaults(
  figures: Readonly<Record<string, StepFigures>>,
  slots: readonly SlotDefault[],
): { figures: Record<string, StepFigures>; filled: string[] } {
  let next: Record<string, StepFigures> = { ...figures };
  const filled: string[] = [];
  for (const slot of slots) {
    next = withDefault(next, slot);
    filled.push(slot.id);
  }
  return { figures: next, filled };
}
