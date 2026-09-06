/**
 * T012 / FR-015 / SC-009 — the legacy→canonical upgrade changes no figure.
 *
 * The three programs that carry the legacy shapes are the whole reason this
 * function exists, so they are tested as themselves (imported from the catalog,
 * not retyped here — a copy would pass while the seed drifted).
 */
import { describe, expect, it } from 'vitest';
import { Decimal } from '@prisma/client/runtime/library';
import { normalizeIncomeAssumption } from '@/matching/pipeline/income-rule-normalize';
import { bandFor } from '@/matching/pipeline/income-rule-bands';
import type { IncomeAssumptionConfig } from '@/matching/types';
import { abkEgypt2026 } from '@/bank-programs/seeds/catalogs/abk-egypt-2026';
import { CATALOG_INCOME_RULE } from '../../prisma/data/program-catalog-matrix';

function ruleOf(programCode: string): IncomeAssumptionConfig {
  const program = abkEgypt2026.programs.find((p) => p.programCode === programCode);
  if (!program) throw new Error(`seed ${programCode} not found`);
  return program.incomeAssumption as unknown as IncomeAssumptionConfig;
}

/**
 * The doctors half of this file reads the CATALOG name's rule, not a bank programme.
 *
 * `ABK-DOCTORS-PRACTICE` carried the same converted table and was retired on 2026-09-05: the
 * doctors sheets are `doctors_clinic_owner` and `doctors_in_practice`, and that legacy pair
 * was a second,
 * contradictory answer under `programNameKey: 'doctor'`. The conversion it proved is still
 * live on `CATALOG_INCOME_RULE.doctor_practice`, byte for byte, so the claim this file makes
 * — that the hand conversion equals the machine one — moves to the copy that survives rather
 * than being deleted with the copy that did not.
 */
function catalogRuleOf(nameKey: string): IncomeAssumptionConfig {
  const rule = CATALOG_INCOME_RULE[nameKey];
  if (!rule) throw new Error(`catalog rule ${nameKey} not found`);
  return rule as unknown as IncomeAssumptionConfig;
}

/**
 * The seeds AS THEY WERE before T065 rewrote them canonical.
 *
 * The seeds are the reason this normalizer exists, but they are no longer the fixture
 * for it: T065 converted them, so reading them here would test canonical→canonical and
 * quietly stop testing anything. These literals are what an un-migrated DATABASE still
 * holds — and every environment holds rows written before this deploy — so they stay
 * as the legacy fixture, with the corresponding seeds asserted idempotent below.
 */
const LEGACY_DOCTORS: IncomeAssumptionConfig = {
  strategy: 'byYearsInPractice',
  incomeTable: [
    { minYears: 0, maxYears: 5, incomeEGP: '15000' },
    { minYears: 5, maxYears: 50, incomeEGP: '40000' },
  ],
};

const LEGACY_PROFESSORS: IncomeAssumptionConfig = {
  strategy: 'byProfessorRank',
  rankIncomeMap: { lecturer: '12000', assistant_professor: '18000', professor: '25000' },
};

const LEGACY_MILITARY: IncomeAssumptionConfig = {
  strategy: 'byMilitaryGrade',
  gradeIncomeMap: { officer: '15000', senior_officer: '25000', general: '40000' },
};

/** The legacy lookup, verbatim, so "identical output" is measured not asserted. */
function legacyYearsLookup(years: number, config: IncomeAssumptionConfig): string | null {
  const row = config.incomeTable?.find(
    (r) =>
      typeof r.minYears === 'number' &&
      typeof r.maxYears === 'number' &&
      years >= r.minYears &&
      years <= r.maxYears,
  );
  return row ? String(row.incomeEGP ?? row.assumedIncomeEGP) : null;
}

describe('normalizeIncomeAssumption — key tables', () => {
  it('turns a legacy rankIncomeMap into a keyTable with the same keys and incomes', () => {
    const canonical = normalizeIncomeAssumption(LEGACY_PROFESSORS);

    expect(canonical.strategy).toBe('byProfessorRank');
    expect(canonical.keyTable).toEqual([
      { key: 'lecturer', incomeEGP: '12000' },
      { key: 'assistant_professor', incomeEGP: '18000' },
      { key: 'professor', incomeEGP: '25000' },
    ]);
  });

  it('turns a legacy gradeIncomeMap into a keyTable', () => {
    const canonical = normalizeIncomeAssumption(LEGACY_MILITARY);

    expect(canonical.strategy).toBe('byMilitaryGrade');
    expect(canonical.keyTable).toEqual([
      { key: 'officer', incomeEGP: '15000' },
      { key: 'senior_officer', incomeEGP: '25000' },
      { key: 'general', incomeEGP: '40000' },
    ]);
  });

  it('preserves insertion order, because that is the registry display order', () => {
    const canonical = normalizeIncomeAssumption({
      strategy: 'byMilitaryGrade',
      gradeIncomeMap: { general: '40000', officer: '15000' },
    });
    expect(canonical.keyTable?.map((r) => r.key)).toEqual(['general', 'officer']);
  });
});

describe('normalizeIncomeAssumption — year bands', () => {
  it('converts the legacy doctors table with toExclusive = maxYears + 1', () => {
    const canonical = normalizeIncomeAssumption(LEGACY_DOCTORS);

    expect(canonical.strategy).toBe('byYearsInPractice');
    // The legacy rows overlap on year 5 (`0–5` and `5–50` both claim it) and the
    // lookup is first-match, so the second band's lower edge is raised to where the
    // first one ends. No year changes hands — the next test proves that over 0…60 —
    // and the result is a table the save path can accept.
    expect(canonical.bands).toEqual([
      { fromInclusive: '0', toExclusive: '6', incomeEGP: '15000' },
      { fromInclusive: '6', toExclusive: '51', incomeEGP: '40000' },
    ]);
  });

  it('resolves EVERY whole year 0…60 to the same income the legacy lookup did', () => {
    // The real assertion behind FR-015. `toExclusive = maxYears + 1` is only
    // correct because years are integers; anything the seed can be asked about is
    // checked here rather than at three sampled points.
    const legacy = LEGACY_DOCTORS;
    const canonical = normalizeIncomeAssumption(legacy);

    for (let years = 0; years <= 60; years++) {
      const before = legacyYearsLookup(years, legacy);
      const after = bandFor(new Decimal(years), canonical.bands);
      const afterIncome = after.matched ? after.incomeEGP.toString() : null;
      expect(afterIncome, `years=${years}`).toBe(before);
    }
  });

  it('leaves the top band CLOSED so a year past the legacy cap still resolves to nothing', () => {
    // Opening it would start paying a 51-year practitioner 40 000 where today they
    // get no figure at all — a moved figure, which SC-009 forbids.
    const canonical = normalizeIncomeAssumption(LEGACY_DOCTORS);
    expect(canonical.bands?.at(-1)?.toExclusive).not.toBeNull();
    expect(bandFor(new Decimal(51), canonical.bands).matched).toBe(false);
  });
});

describe('normalizeIncomeAssumption — value bands', () => {
  it('chains each row on the NEXT row s lower edge and opens the last', () => {
    const canonical = normalizeIncomeAssumption({
      strategy: 'byCDValue',
      incomeTable: [
        { minCDValueEGP: '100000', incomeEGP: '3000' },
        { minCDValueEGP: '500000', incomeEGP: '9000' },
        { minCDValueEGP: '1000000', incomeEGP: '20000' },
      ],
    });

    expect(canonical.bands).toEqual([
      { fromInclusive: '100000', toExclusive: '500000', incomeEGP: '3000' },
      { fromInclusive: '500000', toExclusive: '1000000', incomeEGP: '9000' },
      { fromInclusive: '1000000', toExclusive: null, incomeEGP: '20000' },
    ]);
  });

  it('keeps the legacy percent scalar when there is no value table (FR-015)', () => {
    const canonical = normalizeIncomeAssumption({
      strategy: 'byCDValue',
      cdIncomePercent: '3',
      cdIncomeMinEGP: '2000',
    });
    expect(canonical.bands).toBeUndefined();
    expect(canonical.scalar).toEqual({ value: '3', unit: 'percent' });
    // The floor is not part of the canonical scalar shape, so it must survive as
    // the legacy field the resolver still reads.
    expect(canonical.cdIncomeMinEGP).toBe('2000');
  });
});

describe('normalizeIncomeAssumption — scalars', () => {
  it.each([
    ['byCarInstallment', 'carInstallmentMultiplier', '4', 'multiplier'],
    ['byCarLoanAmount', 'carLoanAmountPercent', '5', 'percent'],
    ['byCreditCardLimit', 'creditCardLimitMultiplier', '0.1', 'multiplier'],
    ['byBankStatementPercent', 'bankStatementPercent', '30.0', 'percent'],
  ] as const)('reads %s from %s', (strategy, field, value, unit) => {
    const canonical = normalizeIncomeAssumption({
      strategy,
      [field]: value,
    } as unknown as IncomeAssumptionConfig);
    expect(canonical.scalar).toEqual({ value, unit });
  });

  it('prefers cdIncomePercentOfDeposits over cdIncomePercent for byTotalDeposits', () => {
    // A program carrying both must not quote the certificate percentage against a
    // deposit balance.
    const canonical = normalizeIncomeAssumption({
      strategy: 'byTotalDeposits',
      cdIncomePercent: '3',
      cdIncomePercentOfDeposits: '2',
    });
    expect(canonical.scalar).toEqual({ value: '2', unit: 'percent' });
  });

  it('emits no scalar when the program stored no number, leaving the resolver default', () => {
    const canonical = normalizeIncomeAssumption({ strategy: 'byCarInstallment' });
    expect(canonical.scalar).toBeUndefined();
  });

  it('never adopts ANOTHER method\'s scalar key', () => {
    // A stray `cdIncomePercent` left over from a method switch. Falling through to it
    // returned `{ value: '3', unit: 'percent' }`, so the resolver computed
    // `installment × 3` instead of the documented `× 4` default — a figure in the
    // wrong unit, from a field belonging to a different method (FR-015).
    const canonical = normalizeIncomeAssumption({
      strategy: 'byCarInstallment',
      cdIncomePercent: '3',
    });
    expect(canonical.scalar).toBeUndefined();
  });

  it('still falls back to cdIncomePercent for byTotalDeposits — its own second key', () => {
    const canonical = normalizeIncomeAssumption({
      strategy: 'byTotalDeposits',
      cdIncomePercent: '3',
    });
    expect(canonical.scalar).toEqual({ value: '3', unit: 'percent' });
  });

  it('reads the seeded byBankStatementPercent program unchanged', () => {
    const canonical = normalizeIncomeAssumption({
      strategy: 'byBankStatementPercent',
      bankStatementPercent: '30.0',
    });
    expect(canonical.scalar).toEqual({ value: '30.0', unit: 'percent' });
  });
});

describe('normalizeIncomeAssumption — idempotence and policy fields', () => {
  it('repairs an overlap in an ALREADY-canonical band table', () => {
    // The stored rows, not just the legacy ones: the doctors table was hand-converted
    // into the seed with its overlap intact, so every environment already holds a
    // canonical blob the save path would reject. `isCanonical` returns those untouched,
    // so the conversion-time repair alone never reaches them.
    const repaired = normalizeIncomeAssumption({
      strategy: 'byYearsInPractice',
      bands: [
        { fromInclusive: '0', toExclusive: '6', incomeEGP: '15000' },
        { fromInclusive: '5', toExclusive: '51', incomeEGP: '40000' },
      ],
    });
    expect(repaired.bands).toEqual([
      { fromInclusive: '0', toExclusive: '6', incomeEGP: '15000' },
      { fromInclusive: '6', toExclusive: '51', incomeEGP: '40000' },
    ]);
  });

  it('moves no value when it repairs one — first match already owned the overlap', () => {
    const overlapping: IncomeAssumptionConfig = {
      strategy: 'byYearsInPractice',
      bands: [
        { fromInclusive: '0', toExclusive: '6', incomeEGP: '15000' },
        { fromInclusive: '5', toExclusive: '51', incomeEGP: '40000' },
      ],
    };
    const repaired = normalizeIncomeAssumption(overlapping);
    for (let years = 0; years <= 60; years++) {
      const before = bandFor(new Decimal(years), overlapping.bands);
      const after = bandFor(new Decimal(years), repaired.bands);
      expect(after.matched, `year ${years}`).toBe(before.matched);
      if (before.matched && after.matched) {
        expect(after.incomeEGP.toString(), `year ${years}`).toBe(before.incomeEGP.toString());
      }
    }
  });

  it('returns an already-canonical blob unchanged', () => {
    const canonical: IncomeAssumptionConfig = {
      strategy: 'byMilitaryGrade',
      keyTable: [{ key: 'officer', incomeEGP: '15000' }],
      dbrCapPercentOverride: '45',
      requiredDocuments: ['military_id'],
      combinationRule: 'greater_of',
    };
    expect(normalizeIncomeAssumption(canonical)).toBe(canonical);
    expect(normalizeIncomeAssumption(normalizeIncomeAssumption(canonical))).toEqual(canonical);
  });

  it('treats an EMPTY canonical table as canonical, not as a legacy row to re-derive', () => {
    // Detected by key presence, not truthiness — the `normalizeWeights` lesson. If
    // `keyTable: []` were re-derived, an admin clearing a table would silently get
    // the legacy map back.
    const config: IncomeAssumptionConfig = {
      strategy: 'byMilitaryGrade',
      keyTable: [],
      gradeIncomeMap: { officer: '15000' },
    };
    expect(normalizeIncomeAssumption(config).keyTable).toEqual([]);
  });

  it('carries combinationRule, the DBR override and required documents across', () => {
    const canonical = normalizeIncomeAssumption({
      strategy: 'byMilitaryGrade',
      gradeIncomeMap: { officer: '15000' },
      combinationRule: 'lesser_of',
      dbrCapPercentOverride: '40',
      requiredDocuments: ['military_id'],
    });
    expect(canonical.combinationRule).toBe('lesser_of');
    expect(canonical.dbrCapPercentOverride).toBe('40');
    expect(canonical.requiredDocuments).toEqual(['military_id']);
  });

  it('treats a missing or non-object rule as declared', () => {
    expect(normalizeIncomeAssumption(null).strategy).toBe('declared');
    expect(normalizeIncomeAssumption(undefined).strategy).toBe('declared');
  });

  it('the REWRITTEN seeds equal what the normalizer produces from the legacy shapes', () => {
    // T065 converted the three seeds by hand. This is what proves the hand conversion
    // matches the machine one — without it, the seed and the normalizer could disagree
    // and every environment would get one answer or the other depending on whether it
    // had been re-seeded.
    expect(catalogRuleOf('doctor_practice').bands).toEqual(
      normalizeIncomeAssumption(LEGACY_DOCTORS).bands,
    );
    expect(ruleOf('ABK-PROFESSORS').keyTable).toEqual(
      normalizeIncomeAssumption(LEGACY_PROFESSORS).keyTable,
    );
    expect(ruleOf('ABK-MILITARY').keyTable).toEqual(
      normalizeIncomeAssumption(LEGACY_MILITARY).keyTable,
    );
  });

  it('leaves the now-canonical seeds untouched — the normalizer is idempotent on them', () => {
    for (const code of ['ABK-PROFESSORS', 'ABK-MILITARY']) {
      const rule = ruleOf(code);
      expect(normalizeIncomeAssumption(rule), code).toBe(rule);
    }
    const doctors = catalogRuleOf('doctor_practice');
    expect(normalizeIncomeAssumption(doctors), 'doctor_practice').toBe(doctors);
  });

  it('normalizes every seeded catalog rule without throwing', () => {
    for (const program of abkEgypt2026.programs) {
      const rule = program.incomeAssumption as unknown as IncomeAssumptionConfig;
      expect(() => normalizeIncomeAssumption(rule)).not.toThrow();
    }
  });
});
