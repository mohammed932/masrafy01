/**
 * Writing ONE slot's figures, as a pure function.
 *
 * PURE — no Angular, no `$localize`, no HTTP, same posture as `figure-slots.ts`.
 *
 * ─── WHY THIS IS NOT A METHOD ON THE EDITOR ───────────────────────────────────
 *
 * It was one, and it wrote two different shapes for one state. `patch()` guarded on a
 * TOP-LEVEL empty string, which is right for `minValue` / `maxValue` / `valueEGP` and wrong
 * for `scalar`, whose top-level value is an OBJECT — so clearing a bound deleted the key and
 * left `{}`, while clearing a percentage stored `{scalar:{unit:'percent',value:''}}`. Both
 * mean "this bank stated nothing"; `stepIsConfigured` already reads both as unconfigured, so
 * nothing failed loudly and the two shapes sat in the database on a live program
 * (`ABK-PERSONAL-7110`, verified) looking like two different decisions.
 *
 * That matters now beyond tidiness: "is this slot blank, so may it be offered the product's
 * default?" has to be ONE test. Three shapes for one state is three chances for the screen to
 * offer a default over a figure that is already there, or to withhold one from a slot that is
 * empty.
 *
 * ─── AN EMPTY SLOT LEAVES NO KEY ──────────────────────────────────────────────
 *
 * `mergeFigure` returns `null` when nothing survives, and `writeFigure` then REMOVES the key
 * rather than storing `{}`. An empty object is not a smaller statement than an absent one —
 * it is the same statement, spelled a second way, and it survives the wire into `stepParams`
 * where the next reader has to know both spellings.
 */
import type { StepFigures } from '@features/bank-programs/bank-programs.types';

/** Blank as the operator means it: nothing typed, or only whitespace typed. */
function isBlankText(value: unknown): boolean {
  return typeof value === 'string' && value.trim() === '';
}

/**
 * One slot's figures with `part` merged in, or `null` when the result states nothing.
 *
 * The two blanking rules, and each is a spelling of the same sentence:
 *   · a top-level `''` or `undefined` drops its key (`valueEGP`, `minValue`, `maxValue`);
 *   · a `scalar` whose `value` is blank drops the whole `scalar` — the `unit` alone says
 *     nothing, and keeping it is what produced the second shape.
 *
 * `keyTable` / `bands` are NOT emptied here. An empty array is a real intermediate state the
 * two table editors write while an operator is clearing rows one at a time, and collapsing it
 * to "no key" mid-edit would make the row they are about to type into vanish under them. The
 * table editors own that decision; this function only refuses to STORE a blank scalar.
 */
export function mergeFigure(
  current: StepFigures | undefined,
  part: Partial<StepFigures>,
): StepFigures | null {
  const merged: StepFigures = { ...(current ?? {}), ...part };

  for (const [key, value] of Object.entries(part)) {
    if (value === undefined || isBlankText(value)) {
      delete (merged as Record<string, unknown>)[key];
    }
  }

  // The scalar's own emptiness, which the loop above cannot see through.
  if (merged.scalar !== undefined && isBlankText(merged.scalar.value)) {
    delete merged.scalar;
  }

  return Object.keys(merged).length === 0 ? null : merged;
}

/**
 * The whole figure map with one slot rewritten — or with its key gone, when the slot now
 * states nothing.
 *
 * Returns a NEW map every time. The editor binds `figures` as a `model()` and a mutated map
 * would not be seen as a change by `OnPush`.
 */
export function writeFigure(
  figures: Readonly<Record<string, StepFigures>>,
  id: string,
  part: Partial<StepFigures>,
): Record<string, StepFigures> {
  const merged = mergeFigure(figures[id], part);
  const next = { ...figures };
  if (merged === null) {
    delete next[id];
  } else {
    next[id] = merged;
  }
  return next;
}
