/**
 * Whether the catalog may fill in a bank programme's display name, or the bank has made it
 * its own.
 *
 * ─── Why this is a module and not two lines in the form ───────────────────────
 *
 * It decides whether a keystroke DESTROYS data, and it is invisible when it decides wrong:
 * the field simply reads differently afterwards and nothing says a name was lost.
 *
 * The form used to assign unconditionally, on the reasoning that a display name is "never
 * hand-typed (A20 / Principle II)". Both halves are wrong. A20 bans hardcoded user-visible
 * strings in the bundle; this is DB content an operator types. And Principle II argues the
 * other way — a bank naming its own programme IS banks-as-data.
 *
 * What the old rule destroyed is the only record of a distinction the catalog may not carry.
 * A product is routinely sold as several programmes off one mechanism, and a bank's own name
 * for its programme is the only thing that tells them apart — four banks sell the compound
 * guarantee off one frame, and ABK sold both doctor sheets under one name until each got its
 * own. Touching the name picker replaced every one of them with the catalog's word.
 */

/** The labels of the name picked last, or `null` before anything has been picked. */
export interface PickedNameLabels {
  labelEn: string;
  labelAr: string;
}

/**
 * `true` when the field is still following the catalog and may be moved with it.
 *
 * Three cases, and the middle one is the whole point:
 *
 *   blank                              → nothing to lose, take the catalog's word
 *   still equal to the PREVIOUS pick    → it was following the catalog, so it moves too
 *   anything else                       → the bank's own wording, never overwritten
 *
 * Either locale's previous label counts as "following": a programme seeded from the catalog
 * carries the English label in the English field and the Arabic one in the Arabic field, and
 * one comparison serving both fields is what keeps the two from drifting apart.
 *
 * Compared TRIMMED, because a stray space is not a decision. Before any pick
 * (`picked === null`) only a blank field is claimable — a value already in the box came from
 * the server and is the bank's until proven otherwise.
 */
export function followsCatalogName(
  current: string | null | undefined,
  picked: PickedNameLabels | null,
): boolean {
  const value = (current ?? '').trim();
  if (value === '') return true;
  if (picked === null) return false;
  return value === picked.labelEn.trim() || value === picked.labelAr.trim();
}
