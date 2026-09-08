/**
 * T032 — the admin's band verdict and the backend's must agree.
 *
 * The two exist separately on purpose: the client one gates the save without a round
 * trip and shows the message inline, the server one is the authority. A disagreement
 * is the worst of both — a table the form accepts and the API rejects (an admin who
 * cannot save and cannot see why), or the reverse (a table the form flags while the
 * server is happy, so the admin edits a rule that was already correct).
 *
 * `incomeBandsErrorFor` is imported; the backend's rule set is restated here as the
 * cases it accepts and rejects, matched against
 * `backend/src/bank-programs/validation/income-rule.validator.ts`. Importing the
 * backend module directly would couple the admin bundle to it.
 */
import { describe, expect, it } from 'vitest';
// The PURE rule module, not the components: importing a component would drag Angular
// (and its JIT requirement) into a test about arithmetic.
import {
  incomeBandsErrorFor,
  incomeKeyTableErrorFor,
  type IncomeBandsError,
} from '../src/app/shared/income-rule/income-rule.rules';
import type { IncomeBand } from '../src/app/features/bank-programs/bank-programs.types';

function bands(rows: Array<[string, string | null, string]>): IncomeBand[] {
  return rows.map(([fromInclusive, toExclusive, incomeEGP]) => ({
    fromInclusive,
    toExclusive,
    incomeEGP,
  }));
}

/**
 * The backend reason token each client verdict corresponds to. The mapping is the
 * contract: every client error must name a backend rejection that really exists, or
 * the inline message is describing a rule the server does not enforce.
 */
const CLIENT_TO_BACKEND: Record<Exclude<IncomeBandsError, null>, string> = {
  NO_BANDS: 'INCOME_RULE_EMPTY',
  EDGE_MISSING: 'INCOME_RULE_BANDS_INVALID:edge_not_decimal',
  NOT_ASCENDING: 'INCOME_RULE_BANDS_INVALID:unordered|gap|overlap|open_band_not_last',
  INCOME_INVALID: 'INCOME_RULE_INCOME_INVALID',
  FIRST_NOT_ZERO: 'INCOME_RULE_BANDS_INVALID:first_band_not_zero',
  LAST_NOT_OPEN: 'INCOME_RULE_BANDS_INVALID:last_band_not_open',
};

describe('incomeBandsErrorFor — accepts exactly what the backend accepts', () => {
  it('accepts an ordered, gapless table with an open last band', () => {
    expect(
      incomeBandsErrorFor(
        bands([
          ['0', '5', '12000'],
          ['5', '8', '30000'],
          ['8', null, '45000'],
        ]),
      ),
    ).toBeNull();
  });

  it('accepts a single open-ended band', () => {
    expect(incomeBandsErrorFor(bands([['0', null, '12000']]))).toBeNull();
  });

  it('accepts a table that STARTS above zero — income bands need not cover −∞', () => {
    // The one place income bands deliberately differ from the numeric SCORE bands
    // (research R6). Below the first edge the rule yields a stated reason, not a zero.
    expect(incomeBandsErrorFor(bands([['100000', null, '3000']]))).toBeNull();
  });

  it('accepts fractional edges', () => {
    expect(
      incomeBandsErrorFor(
        bands([
          ['0', '2.5', '8000'],
          ['2.5', null, '16000'],
        ]),
      ),
    ).toBeNull();
  });
});

describe('incomeBandsErrorFor — every rejection maps to a real backend reason', () => {
  it('NO_BANDS on an empty table', () => {
    expect(incomeBandsErrorFor([])).toBe('NO_BANDS');
    expect(CLIENT_TO_BACKEND.NO_BANDS).toBe('INCOME_RULE_EMPTY');
  });

  it('EDGE_MISSING on a blank lower edge — including the FIRST row', () => {
    // The score-bands editor renders row 0 as "No minimum"; this one does not, so a
    // blank first edge is a real error rather than an unrepresentable state.
    expect(incomeBandsErrorFor(bands([['', null, '12000']]))).toBe('EDGE_MISSING');
    expect(
      incomeBandsErrorFor(
        bands([
          ['0', '', '12000'],
          ['', null, '30000'],
        ]),
      ),
    ).toBe('EDGE_MISSING');
  });

  it('EDGE_MISSING on a non-numeric edge', () => {
    expect(incomeBandsErrorFor(bands([['zero', null, '12000']]))).toBe('EDGE_MISSING');
  });

  it('NOT_ASCENDING on a descending or duplicated edge', () => {
    expect(
      incomeBandsErrorFor(
        bands([
          ['5', '5', '12000'],
          ['5', null, '30000'],
        ]),
      ),
    ).toBe('NOT_ASCENDING');
    expect(
      incomeBandsErrorFor(
        bands([
          ['8', '5', '12000'],
          ['5', null, '30000'],
        ]),
      ),
    ).toBe('NOT_ASCENDING');
  });

  it('ACCEPTS a closed last band — the backend does, and every legacy years table has one', () => {
    // Opening the top band of a legacy table would start paying applicants above it
    // where today they get no figure, so the read path keeps it closed. The client
    // flagging what the server accepts is the second half of the drift this mapping
    // exists to prevent.
    expect(incomeBandsErrorFor(bands([['0', '5', '12000']]))).toBeNull();
  });

  it('NOT_ASCENDING when the last band ends at or below where it starts', () => {
    expect(incomeBandsErrorFor(bands([['8', '8', '12000']]))).toBe('NOT_ASCENDING');
  });

  it('treats a BLANK last ceiling as open-ended, the same reading the editor writes', () => {
    expect(incomeBandsErrorFor(bands([['0', '', '12000']]))).toBeNull();
  });

  it('NOT_ASCENDING when a NON-last band is open — the rows after it are unreachable', () => {
    expect(
      incomeBandsErrorFor(
        bands([
          ['0', null, '12000'],
          ['5', null, '30000'],
        ]),
      ),
    ).toBe('NOT_ASCENDING');
  });

  it('INCOME_INVALID on a zero, negative, blank or unparseable income', () => {
    for (const bad of ['0', '-1', '', 'abc']) {
      expect(incomeBandsErrorFor(bands([['0', null, bad]])), bad).toBe('INCOME_INVALID');
    }
  });

  it('names a backend reason for every client verdict it can return', () => {
    // Guards against a new client-only error being added with no server rule behind
    // it — the inline message would then describe a rule that does not exist.
    const verdicts: Array<Exclude<IncomeBandsError, null>> = [
      'NO_BANDS',
      'EDGE_MISSING',
      'NOT_ASCENDING',
      'INCOME_INVALID',
      'FIRST_NOT_ZERO',
      'LAST_NOT_OPEN',
    ];
    for (const v of verdicts) {
      expect(CLIENT_TO_BACKEND[v], v).toBeTruthy();
      expect(CLIENT_TO_BACKEND[v], v).toMatch(/^INCOME_RULE_/);
    }
  });
});

describe('gaps and overlaps are UNREPRESENTABLE, not merely rejected', () => {
  it('has no client verdict for a gap or an overlap', () => {
    // The linkage (`relink`) derives every upper edge from the next row's lower edge,
    // so the editor cannot produce either. If one ever arrived from the server, the
    // linkage broke — and that deserves to fail loudly rather than be mapped to a
    // message that tells the admin to fix data they cannot author.
    const tokens = Object.values(CLIENT_TO_BACKEND).join(' ');
    expect(tokens).toContain('gap');
    expect(tokens).toContain('overlap');
    // …but only as part of NOT_ASCENDING's backend counterpart, never as its own
    // client verdict.
    expect(Object.keys(CLIENT_TO_BACKEND)).not.toContain('GAP');
    expect(Object.keys(CLIENT_TO_BACKEND)).not.toContain('OVERLAP');
  });
});

describe('incomeKeyTableErrorFor — the key table half of the same contract', () => {
  it('accepts a table of distinct keys with positive incomes', () => {
    expect(
      incomeKeyTableErrorFor([
        { key: 'officer', incomeEGP: '15000' },
        { key: 'general', incomeEGP: '40000' },
      ]),
    ).toBeNull();
  });

  it('NO_ROWS on an empty table (backend INCOME_RULE_EMPTY)', () => {
    expect(incomeKeyTableErrorFor([])).toBe('NO_ROWS');
  });

  it('DUPLICATE_KEY on a repeated key (backend INCOME_RULE_DUPLICATE_KEY)', () => {
    expect(
      incomeKeyTableErrorFor([
        { key: 'officer', incomeEGP: '15000' },
        { key: 'officer', incomeEGP: '25000' },
      ]),
    ).toBe('DUPLICATE_KEY');
  });

  it('KEY_MISSING on a row whose key was never picked', () => {
    expect(incomeKeyTableErrorFor([{ key: '', incomeEGP: '15000' }])).toBe('KEY_MISSING');
  });

  it('INCOME_INVALID on a zero, negative, blank or unparseable income', () => {
    for (const bad of ['0', '-1', '', 'abc']) {
      expect(incomeKeyTableErrorFor([{ key: 'officer', incomeEGP: bad }]), bad).toBe(
        'INCOME_INVALID',
      );
    }
  });

  it('reports the duplicate BEFORE the income, matching the backend check order', () => {
    // Both sides report "two rows for one grade" rather than whichever income the
    // later row happens to carry, so the admin reads the same problem either way.
    expect(
      incomeKeyTableErrorFor([
        { key: 'officer', incomeEGP: '15000' },
        { key: 'officer', incomeEGP: '0' },
      ]),
    ).toBe('DUPLICATE_KEY');
  });

  it('does NOT mirror registry membership — the server reports that', () => {
    // The picker only offers live members, so the only way to hold a dead key is to
    // have saved one before it was deprecated. Mirroring the registry client-side
    // would need a second copy of it, and would disagree the moment it went stale.
    expect(incomeKeyTableErrorFor([{ key: 'colonel', incomeEGP: '30000' }])).toBeNull();
  });
});

describe('coverAll — the I-Score tier table must answer every score', () => {
  it('accepts a table that starts at 0 and leaves its top range open', () => {
    expect(
      incomeBandsErrorFor(
        bands([
          ['0', '550', '80'],
          ['550', '700', '100'],
          ['700', null, '110'],
        ]),
        { coverAll: true },
      ),
    ).toBeNull();
  });

  it('FIRST_NOT_ZERO when the lowest range starts above zero', () => {
    // A 540 score would match no row, and on a MULTIPLIER that is not a smaller quote —
    // `no_matching_band` stops the rule and the program quotes nothing at all.
    expect(
      incomeBandsErrorFor(
        bands([
          ['550', '700', '100'],
          ['700', null, '110'],
        ]),
        { coverAll: true },
      ),
    ).toBe('FIRST_NOT_ZERO');
  });

  it('LAST_NOT_OPEN when the top range is closed', () => {
    expect(
      incomeBandsErrorFor(
        bands([
          ['0', '700', '90'],
          ['700', '900', '110'],
        ]),
        { coverAll: true },
      ),
    ).toBe('LAST_NOT_OPEN');
  });

  it('says neither about an ordinary table, where a miss is a stated reason', () => {
    // The default, and the reason `coverAll` is opt-in: a years table closes its top band on
    // purpose, and a value below the floor earns `SURROGATE_NO_MATCHING_ROW`, not a wrong
    // figure. Demanding coverage everywhere made every legacy table unsaveable (v18.x).
    const closedAbove = bands([
      ['3', '5', '12000'],
      ['5', '8', '30000'],
    ]);
    expect(incomeBandsErrorFor(closedAbove)).toBeNull();
    expect(incomeBandsErrorFor(closedAbove, { coverAll: true })).toBe('FIRST_NOT_ZERO');
  });
});
