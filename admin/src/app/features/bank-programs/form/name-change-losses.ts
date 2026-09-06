/**
 * What changing a bank program's catalog NAME throws away, said before it happens.
 *
 * Pure: no Angular. The wizard's name picker hands this what it knows and gets back either
 * `null` — nothing is lost, change the name silently — or the two things the confirmation
 * dialog has to NAME: the way this program had chosen, and the maximum-by-answer rows the
 * operator had typed. A dialog that says "are you sure?" is the pattern this repo refuses; a
 * dialog that says what goes is the one it keeps.
 *
 * WHY THE NAME CHANGE CLEARS ANYTHING. The name decides the surrogate PRODUCT, and both of
 * these belong to the product: a way's id is a slot of one product's rule (the server refuses
 * a stale one as `PROGRAM_INCOME_WAY_UNKNOWN`), and the cap table is keyed by one product's
 * facts (`cap_fact_not_product`). Carrying either across is a save that will be refused for a
 * name the operator has already moved away from.
 *
 * TWO CASES THAT MUST NOT ASK, or every routine name change grows a scary dialog:
 *
 *   · a way that was RECORDED, not chosen — a single-way product's `primary` is written by the
 *     wizard without asking, so there is no decision to lose. Only a way picked from a choice
 *     (`hadChoice`) is named.
 *   · a cap grid byte-equal to the product's seeded defaults — the operator typed none of it.
 *     `typedCapRowCount` counts rows only when the grid has moved off its seed.
 */

import type { MaxLoanByFactConfig as MaxLoanByFactConfig } from '@shared/ui/max-loan-by-fact.rules';

export interface NameChangeLoss {
  /** The chosen way's title, when the program had a CHOICE and made it. */
  readonly wayTitle: string | null;
  /** Maximum-by-answer rows holding an amount the operator typed (not the seed's). */
  readonly typedCapRows: number;
}

/**
 * Rows with an amount, unless the whole grid is still exactly what the product seeded.
 *
 * Compared as the wizard compares it — `JSON.stringify` against the signature recorded when the
 * seed was copied in — so this cannot disagree with `seedCapFromProduct` about what "untouched"
 * means.
 */
export function typedCapRowCount(
  config: MaxLoanByFactConfig | null,
  seededSignature: string | null,
): number {
  if (config === null) return 0;
  if (seededSignature !== null && JSON.stringify(config) === seededSignature) return 0;
  return config.rows.filter((row) => row.maxAmountEGP.trim() !== '').length;
}

export function nameChangeLoss(args: {
  wayId: string | null;
  wayTitle: string | null;
  hadChoice: boolean;
  capConfig: MaxLoanByFactConfig | null;
  capSeededSignature: string | null;
}): NameChangeLoss | null {
  const chose = args.hadChoice && args.wayId !== null && args.wayId !== '';
  const typedCapRows = typedCapRowCount(args.capConfig, args.capSeededSignature);
  if (!chose && typedCapRows === 0) return null;
  return {
    wayTitle: chose ? (args.wayTitle ?? args.wayId) : null,
    typedCapRows,
  };
}
