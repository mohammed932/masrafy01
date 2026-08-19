/**
 * Client-side mirrors of the backend income-rule checks. NO Angular — pure
 * functions in their own module so the host form, the two editors, and the unit
 * tests can all read them without pulling a component (and its JIT requirement)
 * along.
 *
 * These exist to gate the save without a round trip and to show the message inline,
 * including while the section is off-screen on another wizard step. The server
 * re-checks on save and is the authority; a disagreement between the two is the
 * worst outcome — either a table the form accepts and the API rejects (an admin who
 * cannot save and cannot see why), or one the form flags while the server is happy
 * (an admin editing a rule that was already correct). `tests/income-bands-editor.spec.ts`
 * asserts the two agree on every reason token.
 */

import type { IncomeBand, IncomeKeyTableRow } from '../../../bank-programs.types';

// ── Key tables ──────────────────────────────────────────────────────────────

/** What the key table can be wrong about, mirroring the backend's rejections. */
export type IncomeKeyTableError =
  | 'NO_ROWS'
  | 'DUPLICATE_KEY'
  | 'KEY_MISSING'
  | 'INCOME_INVALID'
  | null;

/**
 * Registry membership is deliberately NOT mirrored: the picker only offers live
 * members, so the only way to hold a dead key is to have saved one before it was
 * deprecated — and that is the backend's `INCOME_RULE_UNKNOWN_KEY` to report. A
 * second client-side copy of the registry would disagree the moment it went stale.
 *
 * The duplicate check runs BEFORE the income check on each row, matching the backend
 * order, so both sides report "two rows for one key" rather than whichever income the
 * later row happens to carry.
 */
export function incomeKeyTableErrorFor(rows: readonly IncomeKeyTableRow[]): IncomeKeyTableError {
  if (rows.length === 0) return 'NO_ROWS';
  const seen = new Set<string>();
  for (const row of rows) {
    if (!row.key) return 'KEY_MISSING';
    if (seen.has(row.key)) return 'DUPLICATE_KEY';
    seen.add(row.key);
    if (!isPositiveNumeric(row.incomeEGP)) return 'INCOME_INVALID';
  }
  return null;
}

// ── Bands ───────────────────────────────────────────────────────────────────

/**
 * The reasons the BACKEND can reject a band table, minus the ones the editor makes
 * impossible. `gap` and `overlap` are absent: the editor derives every upper edge
 * from the next row's lower edge, so neither is representable. If one ever arrived
 * from the server it would mean that linkage broke, which deserves to fail loudly
 * rather than be mapped to a message telling the admin to fix data they cannot author.
 */
export type IncomeBandsError =
  | 'NO_BANDS'
  | 'EDGE_MISSING'
  | 'NOT_ASCENDING'
  | 'INCOME_INVALID'
  | null;

export function incomeBandsErrorFor(rows: readonly IncomeBand[]): IncomeBandsError {
  if (rows.length === 0) return 'NO_BANDS';

  let previous: number | null = null;
  for (const [index, row] of rows.entries()) {
    // Unlike the numeric SCORE bands, the FIRST edge is real and required: an income
    // table may legitimately start above zero, and below that floor the rule yields a
    // stated reason rather than a figure (research R6). So index 0 is checked too.
    if (row.fromInclusive === null || row.fromInclusive.trim() === '') return 'EDGE_MISSING';
    const edge = Number(row.fromInclusive);
    if (!Number.isFinite(edge)) return 'EDGE_MISSING';
    if (previous !== null && edge <= previous) return 'NOT_ASCENDING';
    previous = edge;

    if (!isPositiveNumeric(row.incomeEGP)) return 'INCOME_INVALID';

    // Only the LAST band may run to +∞ — rows after an open one are unreachable.
    // A closed last band is legal and common: every legacy years table has one, and
    // opening it would start paying applicants who resolve to nothing today. The
    // last row's ceiling is an editable box for exactly that reason.
    const isLast = index === rows.length - 1;
    if (!isLast && row.toExclusive === null) return 'NOT_ASCENDING';
    if (isLast) {
      // Blank reads as open-ended, the same reading the editor writes: an empty box
      // is how the admin says "and everything above".
      const ceiling = row.toExclusive?.trim() ? row.toExclusive : null;
      if (ceiling !== null && !Number.isFinite(Number(ceiling))) return 'EDGE_MISSING';
      if (ceiling !== null && Number(ceiling) <= edge) return 'NOT_ASCENDING';
    }
  }
  return null;
}

// ── The rule as a whole ─────────────────────────────────────────────────────

/**
 * Is the income rule, as it stands on screen, one the server would reject?
 *
 * ONE implementation, two readers: the section renders it inline, and the wizard's
 * save gate gates on it — including from a step where the section is not mounted,
 * which is why it takes plain values rather than living on the component. Without a
 * reader on the save path the whole client-side mirror in this file was dead weight:
 * an admin could press Save on an empty key table, wait for the round trip, and get
 * `INCOME_RULE_EMPTY` back for a control that was three steps away.
 *
 * `isValueMethod` is the two value methods' escape hatch (FR-015): an empty band table
 * is legal for them while a legacy percentage is still doing the work, and refusing it
 * would make an untouched legacy program unsaveable. It is an escape from the TABLE,
 * not from configuring anything — an empty table with no percentage behind it is
 * `INCOME_RULE_EMPTY` on the server, and treating it as valid here let an admin save a
 * rule the resolver then answered with a hardcoded 3%.
 */
export function incomeRuleHasError(args: {
  shape: 'keyTable' | 'bands' | 'scalar' | 'none';
  keyTable: readonly IncomeKeyTableRow[];
  bands: readonly IncomeBand[];
  scalarValue: string | null | undefined;
  isValueMethod: boolean;
}): boolean {
  switch (args.shape) {
    case 'keyTable':
      return incomeKeyTableErrorFor(args.keyTable) !== null;
    case 'bands':
      // No table on a value method: the percentage IS the rule, so it is checked the
      // same way a scalar method's figure is.
      if (args.bands.length === 0 && args.isValueMethod)
        return !isPositiveNumeric(args.scalarValue);
      return incomeBandsErrorFor(args.bands) !== null;
    case 'scalar':
      return !isPositiveNumeric(args.scalarValue);
    default:
      return false;
  }
}

/** Money must be present, finite and strictly positive (FR-010). */
function isPositiveNumeric(raw: string | null | undefined): boolean {
  if (raw === null || raw === undefined || raw.trim() === '') return false;
  const value = Number(raw);
  return Number.isFinite(value) && value > 0;
}
