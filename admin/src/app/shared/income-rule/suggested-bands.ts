/**
 * The brackets a published sheet prints, keyed by the box they belong in.
 *
 * PURE — no Angular, no HTTP, same posture as `figure-slots.ts`.
 *
 * WHY IT IS A MODULE. Two screens offer these brackets now — the figures screen and step ①
 * of the product page, where the amounts are typed beside the list they are keyed by — and
 * the mapping from a blueprint's suggestion to a `stepParams` slot is the one thing neither
 * of them may state for itself. The SLOT comes from the server, which owns slot naming; what
 * is left is matching a suggestion to the compiled boxes that carry it, and a second copy of
 * that would disagree the day a way is added to a product.
 */
import type { IncomeBand, RuleStep } from '@features/bank-programs/bank-programs.types';

/** One suggestion off a blueprint: the slot the server named, and the edges. */
export interface BandSuggestion {
  readonly slotId: string;
  readonly edges: ReadonlyArray<{ fromInclusive: string; toExclusive: string | null }>;
}

/**
 * Every box a suggestion fills, keyed by step id.
 *
 * The way's own box, AND every column of it. A second column re-prints the same brackets
 * with different figures — that is what a column IS — so offering them only on the first
 * would leave the operator retyping six edges per tier off a photograph, which is where an
 * edge gets mistyped.
 *
 * Which boxes exist is read off the COMPILED steps rather than assembled from a branch list:
 * the compile is what named them, and a column slug worked out here would be a second
 * statement of that naming.
 */
export function suggestedBandsBySlot(
  suggestions: readonly BandSuggestion[],
  steps: readonly RuleStep[],
): Record<string, IncomeBand[]> {
  const out: Record<string, IncomeBand[]> = {};
  for (const suggestion of suggestions) {
    const edges = suggestion.edges.map((edge) => ({
      fromInclusive: edge.fromInclusive,
      toExclusive: edge.toExclusive,
      // Blank on purpose. The edges are the shape of the table; the figure beside each is the
      // bank's, and a band carrying one would be a number nobody authored.
      incomeEGP: '',
    }));
    for (const step of steps) {
      if (step.op !== 'bandTable') continue;
      if (step.id === suggestion.slotId || step.id.startsWith(`${suggestion.slotId}__`)) {
        out[step.id] = edges.map((edge) => ({ ...edge }));
      }
    }
  }
  return out;
}
