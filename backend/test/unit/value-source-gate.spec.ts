/**
 * T058 / FR-033 – FR-035 / SC-004 — a guessed number cannot reach a customer.
 *
 * The six claims, in the order they matter:
 *   1. Saving with an estimate SUCCEEDS (FR-034) — the marker is a note, not a
 *      rejection, and making it one would stop people marking their guesses at all.
 *   2. Going live is REFUSED, naming EVERY path (FR-033) — not the first, because the
 *      admin has one conversation with the bank.
 *   3. An estimate introduced on a LIVE program deactivates it in the SAME
 *      transaction, audited (FR-035, FR-038).
 *   4. Removing the last marker lets it go live.
 *   5. An unknown path is rejected rather than stored (research R8) — a stale path
 *      would block activation forever with nothing on screen to clear.
 *   6. A program with `{}` reads as fully bank-stated, which is what keeps every
 *      pre-existing program live on deploy (FR-037).
 */
import { describe, expect, it } from 'vitest';
import {
  estimatedPaths,
  hasEstimatedValues,
  markablePaths,
  newlyEstimatedPaths,
  pruneValueSources,
  validateValueSources,
  type ValueSourceMap,
} from '@/bank-programs/validation/value-sources.validator';

const CONFIG = {
  incomeAssumption: {
    strategy: 'byMilitaryGrade',
    keyTable: [
      { key: 'officer', incomeEGP: '15000' },
      { key: 'general', incomeEGP: '40000' },
    ],
    dbrCapPercentOverride: '45',
  },
  pricing: { isVariableRate: false, baseRatePercent: '24.0000' },
  fees: { adminFeePercent: '2.0000', stampDutyPercent: '0.5000' },
  loanLimits: { minAmountEGP: '50000', maxAmountEGP: '1500000' },
  tenor: { minMonths: 12, maxMonths: 84 },
  eligibility: { ageMin: 21, ageMax: 60, minMonthlyIncomeEGP: '6000', dbrCapPercent: '50.0000' },
  performanceCriteria: { requiredMOBMonths: 6 },
};

const ESTIMATED = 'team_estimated' as const;

// --- the allow-list is exhaustive, not hand-picked ---------------------------

describe('the markable path list is DERIVED from the program, so it cannot omit a field', () => {
  const paths = markablePaths(CONFIG);

  it('covers every numeric leaf across every config blob', () => {
    for (const expected of [
      'incomeAssumption.dbrCapPercentOverride',
      'pricing.baseRatePercent',
      'fees.adminFeePercent',
      'fees.stampDutyPercent',
      'loanLimits.minAmountEGP',
      'loanLimits.maxAmountEGP',
      'tenor.minMonths',
      'tenor.maxMonths',
      'eligibility.ageMin',
      'eligibility.minMonthlyIncomeEGP',
      'eligibility.dbrCapPercent',
      'performanceCriteria.requiredMOBMonths',
    ]) {
      expect(paths, expected).toContain(expected);
    }
  });

  it('addresses key-table rows by their KEY, not by index', () => {
    // An index would silently re-point at a different grade the moment a row was
    // reordered or removed — and reordering is a first-class action in the editor.
    expect(paths).toContain('incomeAssumption.keyTable.officer.incomeEGP');
    expect(paths).toContain('incomeAssumption.keyTable.general.incomeEGP');
    expect(paths).not.toContain('incomeAssumption.keyTable.0.incomeEGP');
  });

  it('addresses BANDS by index, which is their identity', () => {
    const banded = markablePaths({
      incomeAssumption: {
        strategy: 'byYearsInPractice',
        bands: [
          { fromInclusive: '0', toExclusive: '5', incomeEGP: '12000' },
          { fromInclusive: '5', toExclusive: null, incomeEGP: '30000' },
        ],
      },
    });
    expect(banded).toContain('incomeAssumption.bands.0.fromInclusive');
    expect(banded).toContain('incomeAssumption.bands.0.toExclusive');
    expect(banded).toContain('incomeAssumption.bands.1.incomeEGP');
    // `toExclusive: null` is not a number — the open end is nothing to confirm.
    expect(banded).not.toContain('incomeAssumption.bands.1.toExclusive');
  });

  it('treats decimal STRINGS as numbers — most of what an admin estimates is money', () => {
    // Reading only `typeof value === 'number'` would exempt every EGP figure on the
    // program, and an exempt number can never block activation.
    expect(paths).toContain('fees.adminFeePercent');
  });

  it('excludes non-numeric fields — a flag or a name is not a figure a bank quotes', () => {
    expect(paths).not.toContain('pricing.isVariableRate');
    expect(paths).not.toContain('incomeAssumption.strategy');
  });

  it('excludes blobs a marker has no business pointing into', () => {
    const stray = markablePaths({ ...CONFIG, ...({ bankName: 'X' } as never) });
    expect([...stray].some((p) => p.startsWith('bankName'))).toBe(false);
  });
});

// --- 5. unknown paths are rejected -------------------------------------------

describe('research R8 — an unknown path is rejected, never stored', () => {
  it('rejects a path that names no number on this program', () => {
    const violation = validateValueSources(
      { 'pricing.thereIsNoSuchField': ESTIMATED },
      CONFIG,
    );
    expect(violation).toEqual({ kind: 'unknownPath', path: 'pricing.thereIsNoSuchField' });
  });

  it('rejects a key-table path for a row that does not exist', () => {
    const violation = validateValueSources(
      { 'incomeAssumption.keyTable.colonel.incomeEGP': ESTIMATED },
      CONFIG,
    );
    expect(violation?.kind).toBe('unknownPath');
  });

  it('rejects a value other than team_estimated — there are exactly two states', () => {
    const violation = validateValueSources(
      { 'pricing.baseRatePercent': 'bank_stated' } as unknown as ValueSourceMap,
      CONFIG,
    );
    // Its OWN kind, not `unknownPath`: the path is on the allow-list, so telling the
    // admin to reload the program would send them to fix the one thing that is right.
    expect(violation).toEqual({
      kind: 'invalidValue',
      path: 'pricing.baseRatePercent',
      value: 'bank_stated',
    });
  });

  it('treats a path that WAS markable as stale, so prune can drop it', () => {
    // The row this marker described is gone from the incoming config. Rejecting it
    // trapped the admin: the marker's control had disappeared with its row, so there
    // was no edit that could clear it and the program could never be saved again.
    const violation = validateValueSources(
      { 'incomeAssumption.keyTable.general.incomeEGP': ESTIMATED },
      { ...CONFIG, incomeAssumption: { strategy: 'declared' } },
      { previousConfig: CONFIG },
    );
    expect(violation).toBeUndefined();
  });

  it('accepts an empty map and an absent one alike', () => {
    expect(validateValueSources({}, CONFIG)).toBeUndefined();
    expect(validateValueSources(undefined, CONFIG)).toBeUndefined();
    expect(validateValueSources(null, CONFIG)).toBeUndefined();
  });

  it('accepts every path it advertises as markable', () => {
    for (const path of markablePaths(CONFIG)) {
      expect(validateValueSources({ [path]: ESTIMATED }, CONFIG), path).toBeUndefined();
    }
  });
});

describe('pruning — deleting a marked number is a legal edit', () => {
  it('drops a marker whose path the save removed', () => {
    // Refusing this save would trap the admin: the only way out would be to un-mark a
    // number they can no longer see.
    const withoutGeneral = {
      ...CONFIG,
      incomeAssumption: {
        ...CONFIG.incomeAssumption,
        keyTable: [{ key: 'officer', incomeEGP: '15000' }],
      },
    };
    const pruned = pruneValueSources(
      {
        'incomeAssumption.keyTable.officer.incomeEGP': ESTIMATED,
        'incomeAssumption.keyTable.general.incomeEGP': ESTIMATED,
      },
      withoutGeneral,
    );
    expect(Object.keys(pruned)).toEqual(['incomeAssumption.keyTable.officer.incomeEGP']);
  });

  it('keeps every marker whose number survived', () => {
    const map = { 'pricing.baseRatePercent': ESTIMATED, 'fees.adminFeePercent': ESTIMATED };
    expect(pruneValueSources(map, CONFIG)).toEqual(map);
  });

  it('an ABSENT map is not an empty one — pruning `undefined` must never be how a save clears the gate', () => {
    // `pruneValueSources(undefined, …)` returning `{}` is correct for this pure
    // function; the SERVICE is what must not call it on an omitted field. Pinned here
    // because the two together are what silently wiped every marker on a PUT that
    // said nothing about them, and let an unconfirmed program go live (FR-033).
    expect(pruneValueSources(undefined, CONFIG)).toEqual({});
    expect(estimatedPaths(undefined)).toEqual([]);
  });
});

// --- 2. the refusal names EVERY path -----------------------------------------

describe('FR-033 — going live is refused, naming every estimated value', () => {
  const map: ValueSourceMap = {
    'pricing.baseRatePercent': ESTIMATED,
    'incomeAssumption.keyTable.general.incomeEGP': ESTIMATED,
    'fees.adminFeePercent': ESTIMATED,
  };

  it('reports ALL of them, not the first', () => {
    // One conversation with the bank, not three. A one-at-a-time reveal costs a round
    // trip per number.
    expect(estimatedPaths(map)).toHaveLength(3);
  });

  it('returns them sorted, so the refusal reads the same every time', () => {
    const paths = estimatedPaths(map);
    expect([...paths].sort()).toEqual(paths);
  });

  it('says a program with markers is blocked, and one without is not', () => {
    expect(hasEstimatedValues(map)).toBe(true);
    expect(hasEstimatedValues({})).toBe(false);
    expect(hasEstimatedValues(null)).toBe(false);
    expect(hasEstimatedValues(undefined)).toBe(false);
  });
});

// --- 3. forced deactivation, and only on a NEW marker ------------------------

describe('FR-035 — a NEW estimate on a live program is what deactivates it', () => {
  it('reports the newly added path', () => {
    const added = newlyEstimatedPaths({
      before: { 'pricing.baseRatePercent': ESTIMATED },
      after: {
        'pricing.baseRatePercent': ESTIMATED,
        'fees.adminFeePercent': ESTIMATED,
      },
    });
    expect(added).toEqual(['fees.adminFeePercent']);
  });

  it('reports NOTHING when the same markers are re-saved', () => {
    // The load-bearing case: an admin editing an unrelated field on an already-flagged
    // program must not be fighting the gate on every save.
    const same = { 'pricing.baseRatePercent': ESTIMATED };
    expect(newlyEstimatedPaths({ before: same, after: same })).toEqual([]);
  });

  it('reports nothing when a marker is REMOVED', () => {
    expect(
      newlyEstimatedPaths({
        before: { 'pricing.baseRatePercent': ESTIMATED },
        after: {},
      }),
    ).toEqual([]);
  });

  it('treats the first marker on a clean program as new', () => {
    expect(
      newlyEstimatedPaths({ before: {}, after: { 'pricing.baseRatePercent': ESTIMATED } }),
    ).toEqual(['pricing.baseRatePercent']);
  });
});

// --- 4. and 6. the lifecycle ends and pre-existing programs are untouched ----

describe('FR-034 / FR-037 — the rest of the lifecycle', () => {
  it('never blocks a SAVE, only going live', () => {
    // `validateValueSources` is the only thing the save path can refuse on, and it
    // refuses unknown PATHS — never the mere presence of an estimate.
    expect(validateValueSources({ 'pricing.baseRatePercent': ESTIMATED }, CONFIG)).toBeUndefined();
  });

  it('lets a program go live once the last marker is removed', () => {
    expect(hasEstimatedValues(pruneValueSources({}, CONFIG))).toBe(false);
  });

  it('a program with an EMPTY map reads as fully bank-stated (FR-037)', () => {
    // Every program that existed before this feature carries `{}` by column default,
    // so this is what keeps them live on deploy rather than switching them all off.
    expect(estimatedPaths({})).toEqual([]);
    expect(hasEstimatedValues({})).toBe(false);
  });

  it('a legacy row with a null map behaves as empty, not as broken', () => {
    expect(estimatedPaths(null)).toEqual([]);
    expect(estimatedPaths('not-an-object')).toEqual([]);
  });
});
