/**
 * T023 / SC-002 / FR-001 edge case — nothing broken can be saved, and nothing
 * already stored is destroyed by saving something else.
 *
 * The second half is the one that would cost real data: three seeded programs carry
 * a surrogate table under `programType: 'income_proof'`, so a strip-on-save rule
 * would have deleted those tables the first time an admin edited an unrelated field.
 */
import { describe, expect, it } from 'vitest';
import {
  collectIncomeRuleWarnings,
  stripForeignMethodConfig,
  validateIncomeRule,
  type IncomeRuleValidationContext,
} from '@/bank-programs/validation/income-rule.validator';
import type { IncomeAssumptionConfig } from '@/matching/types';

/** Registry stub: the real ACTIVE members of the two key registries. */
const REGISTRY: Record<string, string[]> = {
  military_grade: ['officer', 'senior_officer', 'general'],
  professor_rank: ['lecturer', 'assistant_professor', 'professor'],
};

const ctx: IncomeRuleValidationContext = {
  isActiveMember: async (type, key) => (REGISTRY[type] ?? []).includes(key),
  activeMembers: async (type) => REGISTRY[type] ?? [],
};

const OFFICER_ROW = { key: 'officer', incomeEGP: '15000' };

describe('INCOME_RULE_EMPTY — a method with no configuration (FR-009)', () => {
  it.each([
    ['byMilitaryGrade', {}],
    ['byProfessorRank', {}],
    ['byMilitaryGrade', { keyTable: [] }],
    ['byYearsInJob', { bands: [] }],
    ['byYearsInPractice', {}],
    ['byCarInstallment', {}],
    ['byBankStatementPercent', {}],
  ] as const)('rejects %s with %j', async (strategy, shape) => {
    const violation = await validateIncomeRule(
      { strategy, ...shape } as IncomeAssumptionConfig,
      ctx,
    );
    expect(violation).toMatchObject({ kind: 'empty', strategy });
  });

  it('accepts `declared`, which carries no configuration by design', async () => {
    expect(await validateIncomeRule({ strategy: 'declared' }, ctx)).toBeUndefined();
  });

  it('accepts a value method configured with the LEGACY percent scalar (FR-015)', async () => {
    // `byCDValue` / `byTotalDeposits` are legally configured either way, so "no
    // bands" must not be an error for them — a legacy program's output may not move.
    expect(
      await validateIncomeRule(
        { strategy: 'byCDValue', scalar: { value: '3', unit: 'percent' } },
        ctx,
      ),
    ).toBeUndefined();
  });

  it('accepts a value method carrying only the pre-canonical percent key', async () => {
    expect(
      await validateIncomeRule({ strategy: 'byCDValue', bands: [], cdIncomePercent: '10' }, ctx),
    ).toBeUndefined();
  });

  it.each(['byCDValue', 'byTotalDeposits'] as const)(
    'rejects %s with NO bands and NO percent — the escape hatch is from the TABLE, not from configuring',
    async (strategy) => {
      // Accepting this let a brand-new program save clean and the resolver then priced
      // every applicant on its hardcoded `?? '3'` — a figure no admin ever authored.
      expect(await validateIncomeRule({ strategy, bands: [] }, ctx)).toEqual({
        kind: 'empty',
        strategy,
      });
    },
  );
});

describe('INCOME_RULE_INCOME_INVALID — income ≤ 0 or unparseable (FR-010)', () => {
  it.each(['0', '-1', '-0.01'])('rejects a key-table income of %s, naming the key', async (bad) => {
    const violation = await validateIncomeRule(
      { strategy: 'byMilitaryGrade', keyTable: [{ key: 'officer', incomeEGP: bad }] },
      ctx,
    );
    expect(violation).toMatchObject({ kind: 'incomeInvalid', key: 'officer', incomeEGP: bad });
  });

  it('rejects an unparseable income', async () => {
    const violation = await validateIncomeRule(
      { strategy: 'byMilitaryGrade', keyTable: [{ key: 'officer', incomeEGP: 'abc' }] },
      ctx,
    );
    expect(violation).toMatchObject({ kind: 'incomeInvalid', key: 'officer' });
  });

  it('rejects a band income of 0, naming the INDEX', async () => {
    const violation = await validateIncomeRule(
      {
        strategy: 'byYearsInJob',
        bands: [
          { fromInclusive: '0', toExclusive: '5', incomeEGP: '12000' },
          { fromInclusive: '5', toExclusive: null, incomeEGP: '0' },
        ],
      },
      ctx,
    );
    expect(violation).toMatchObject({ kind: 'incomeInvalid', index: 1, incomeEGP: '0' });
  });

  it('rejects a scalar of 0 — for a scalar method the number IS the rule', async () => {
    const violation = await validateIncomeRule(
      { strategy: 'byCarInstallment', scalar: { value: '0', unit: 'multiplier' } },
      ctx,
    );
    expect(violation).toMatchObject({ kind: 'incomeInvalid', incomeEGP: '0' });
  });
});

describe('INCOME_RULE_DUPLICATE_KEY (FR-006)', () => {
  it('rejects a repeated key, naming it', async () => {
    const violation = await validateIncomeRule(
      {
        strategy: 'byMilitaryGrade',
        keyTable: [OFFICER_ROW, { key: 'general', incomeEGP: '40000' }, OFFICER_ROW],
      },
      ctx,
    );
    expect(violation).toEqual({ kind: 'duplicateKey', key: 'officer' });
  });

  it('reports the duplicate BEFORE the second row is income-checked', async () => {
    // Order matters for the message the admin gets: two rows for one grade is the
    // problem, not whichever income the later row happens to carry.
    const violation = await validateIncomeRule(
      { strategy: 'byMilitaryGrade', keyTable: [OFFICER_ROW, { key: 'officer', incomeEGP: '0' }] },
      ctx,
    );
    expect(violation).toEqual({ kind: 'duplicateKey', key: 'officer' });
  });
});

describe('INCOME_RULE_UNKNOWN_KEY — fails CLOSED (FR-006 / AS-1.9)', () => {
  it('rejects a key the registry does not carry, and lists the live ones', async () => {
    const violation = await validateIncomeRule(
      { strategy: 'byMilitaryGrade', keyTable: [{ key: 'colonel', incomeEGP: '30000' }] },
      ctx,
    );
    expect(violation).toMatchObject({
      kind: 'unknownKey',
      key: 'colonel',
      registry: 'military_grade',
    });
    expect(violation && 'activeKeys' in violation && violation.activeKeys).toContain('officer');
  });

  it('checks each key method against its OWN registry', async () => {
    // A grade in a rank table would resolve to nothing for every applicant, forever.
    const violation = await validateIncomeRule(
      { strategy: 'byProfessorRank', keyTable: [{ key: 'officer', incomeEGP: '15000' }] },
      ctx,
    );
    expect(violation).toMatchObject({ kind: 'unknownKey', registry: 'professor_rank' });
  });

  it('accepts every active member of both registries', async () => {
    for (const [strategy, type] of [
      ['byMilitaryGrade', 'military_grade'],
      ['byProfessorRank', 'professor_rank'],
    ] as const) {
      const keyTable = (REGISTRY[type] ?? []).map((key) => ({ key, incomeEGP: '10000' }));
      expect(await validateIncomeRule({ strategy, keyTable }, ctx)).toBeUndefined();
    }
  });
});

describe('INCOME_RULE_BANDS_INVALID — names the offending band (FR-008)', () => {
  function bands(rows: Array<[string, string | null, string]>): IncomeAssumptionConfig {
    return {
      strategy: 'byYearsInPractice',
      bands: rows.map(([fromInclusive, toExclusive, incomeEGP]) => ({
        fromInclusive,
        toExclusive,
        incomeEGP,
      })),
    };
  }

  it('accepts an ordered, gapless table with an open last band', async () => {
    expect(
      await validateIncomeRule(
        bands([
          ['0', '5', '12000'],
          ['5', '8', '30000'],
          ['8', null, '45000'],
        ]),
        ctx,
      ),
    ).toBeUndefined();
  });

  it('accepts a table that starts ABOVE zero — income bands need not cover −∞', async () => {
    expect(
      await validateIncomeRule(bands([['100000', null, '3000']]), ctx),
    ).toBeUndefined();
  });

  it('rejects a GAP, naming the band that starts too high', async () => {
    const violation = await validateIncomeRule(
      bands([
        ['0', '5', '12000'],
        ['6', null, '30000'],
      ]),
      ctx,
    );
    expect(violation).toEqual({ kind: 'bandsInvalid', index: 1, reason: 'gap' });
  });

  it('rejects an OVERLAP, naming the band that starts too low', async () => {
    const violation = await validateIncomeRule(
      bands([
        ['0', '6', '12000'],
        ['5', null, '30000'],
      ]),
      ctx,
    );
    expect(violation).toEqual({ kind: 'bandsInvalid', index: 1, reason: 'overlap' });
  });

  it('rejects an empty band (to === from) as unordered', async () => {
    // Followed by an open band, so the only defect is the empty range — a single
    // closed band would ALSO be "last band not open" and the assertion would not
    // pin down which rule fired.
    expect(
      await validateIncomeRule(
        bands([
          ['5', '5', '12000'],
          ['5', null, '30000'],
        ]),
        ctx,
      ),
    ).toEqual({ kind: 'bandsInvalid', index: 0, reason: 'unordered' });
  });

  it('rejects an INVERTED band as unordered', async () => {
    expect(
      await validateIncomeRule(
        bands([
          ['8', '5', '12000'],
          ['8', null, '30000'],
        ]),
        ctx,
      ),
    ).toEqual({ kind: 'bandsInvalid', index: 0, reason: 'unordered' });
  });

  it('ACCEPTS a closed last band — above it the rule yields nothing, which is a real rule', async () => {
    // The read path closes every legacy years band at `maxYears + 1` because opening
    // the top one would start paying applicants who resolve to nothing today
    // (FR-015). Rejecting that shape here left those programs unsaveable: the admin
    // had no edit that satisfied the validator without moving a figure.
    expect(await validateIncomeRule(bands([['0', '5', '12000']]), ctx)).toBeUndefined();
  });

  it('rejects an open band that is NOT last — the rows after it are unreachable', async () => {
    const violation = await validateIncomeRule(
      bands([
        ['0', null, '12000'],
        ['5', null, '30000'],
      ]),
      ctx,
    );
    expect(violation).toEqual({ kind: 'bandsInvalid', index: 0, reason: 'open_band_not_last' });
  });

  it('rejects a non-decimal edge', async () => {
    const violation = await validateIncomeRule(bands([['zero', null, '12000']]), ctx);
    expect(violation).toEqual({ kind: 'bandsInvalid', index: 0, reason: 'edge_not_decimal' });
  });
});

describe('INCOME_RULE_DBR_OVERRIDE_INVALID — (0, 100] (FR-012)', () => {
  it.each(['0', '-5', '100.01', '101', 'abc'])('rejects %s', async (value) => {
    const violation = await validateIncomeRule(
      { strategy: 'byMilitaryGrade', keyTable: [OFFICER_ROW], dbrCapPercentOverride: value },
      ctx,
    );
    expect(violation).toEqual({ kind: 'dbrOverrideInvalid', value });
  });

  it.each(['0.01', '45', '100'])('accepts %s', async (value) => {
    expect(
      await validateIncomeRule(
        { strategy: 'byMilitaryGrade', keyTable: [OFFICER_ROW], dbrCapPercentOverride: value },
        ctx,
      ),
    ).toBeUndefined();
  });

  it('reports the override BEFORE the table, so the admin is sent to the right control', async () => {
    const violation = await validateIncomeRule(
      { strategy: 'byMilitaryGrade', keyTable: [], dbrCapPercentOverride: '0' },
      ctx,
    );
    expect(violation).toMatchObject({ kind: 'dbrOverrideInvalid' });
  });
});

describe('FR-011 — configuration for another method is stripped', () => {
  it('drops a keyTable when the strategy is a band method', () => {
    const stripped = stripForeignMethodConfig({
      strategy: 'byYearsInPractice',
      keyTable: [OFFICER_ROW],
      bands: [{ fromInclusive: '0', toExclusive: null, incomeEGP: '12000' }],
    });
    expect(stripped?.keyTable).toBeUndefined();
    expect(stripped?.bands).toHaveLength(1);
  });

  it('keeps combinationRule, the DBR override and required documents', () => {
    const stripped = stripForeignMethodConfig({
      strategy: 'byMilitaryGrade',
      keyTable: [OFFICER_ROW],
      combinationRule: 'greater_of',
      dbrCapPercentOverride: '45',
      requiredDocuments: ['military_id'],
    });
    expect(stripped).toMatchObject({
      combinationRule: 'greater_of',
      dbrCapPercentOverride: '45',
      requiredDocuments: ['military_id'],
    });
  });

  it('drops legacy fields once a canonical shape for the selected method is present', () => {
    const stripped = stripForeignMethodConfig({
      strategy: 'byMilitaryGrade',
      keyTable: [OFFICER_ROW],
      gradeIncomeMap: { general: '40000' },
    });
    expect(stripped?.gradeIncomeMap).toBeUndefined();
  });

  it('KEEPS the legacy percent when a value method arrives with an EMPTY band table', () => {
    // The admin form always emits `bands` for a band shape, so this is what a legacy
    // `byCDValue` program posts on any unrelated edit. `bands: []` is truthy, so
    // testing the reference dropped the scalar and handed the program to the
    // resolver's hardcoded 3% — every applicant silently re-quoted on a third of the
    // assumed income.
    const stripped = stripForeignMethodConfig({
      strategy: 'byCDValue',
      bands: [],
      scalar: { value: '10', unit: 'percent' },
    });
    expect(stripped?.scalar).toEqual({ value: '10', unit: 'percent' });
  });

  it('KEEPS the strategy\'s own legacy scalar key, and no other method\'s', () => {
    const stripped = stripForeignMethodConfig({
      strategy: 'byCDValue',
      bands: [],
      cdIncomePercent: '10',
      // Another method's number, left over from a switch. It must not travel.
      carInstallmentMultiplier: '4',
    });
    expect(stripped?.cdIncomePercent).toBe('10');
    expect(stripped?.carInstallmentMultiplier).toBeUndefined();
  });
});

describe('FR-001 edge case — a rule the program type hides is IGNORED and REPORTED, never deleted', () => {
  const legacyMisTyped: IncomeAssumptionConfig = {
    strategy: 'byMilitaryGrade',
    gradeIncomeMap: { officer: '15000', senior_officer: '25000' },
  };

  it('survives a save that carries no canonical shape for the method', () => {
    // This is the seeded-program case. Stripping here would destroy a real bank's
    // table the first time someone edited a rate.
    const stripped = stripForeignMethodConfig(legacyMisTyped);
    expect(stripped?.gradeIncomeMap).toEqual(legacyMisTyped.gradeIncomeMap);
  });

  it('warns, naming the program type, rather than rejecting', () => {
    const warnings = collectIncomeRuleWarnings({
      config: legacyMisTyped,
      programType: 'income_proof',
      productCategory: 'personal',
      programRequiredDocuments: [],
    });
    expect(warnings).toEqual([
      {
        kind: 'ruleIgnoredForProgramType',
        programType: 'income_proof',
        productCategory: 'personal',
        strategy: 'byMilitaryGrade',
      },
    ]);
  });

  it('warns on a non-personal category too — surrogate rules are personal-only (FR-001)', () => {
    const warnings = collectIncomeRuleWarnings({
      config: { strategy: 'byMilitaryGrade', keyTable: [OFFICER_ROW] },
      programType: 'income_surrogate',
      productCategory: 'business',
      programRequiredDocuments: [],
    });
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toMatchObject({ kind: 'ruleIgnoredForProgramType' });
  });

  it('does not warn when the rule IS read', () => {
    const warnings = collectIncomeRuleWarnings({
      config: { strategy: 'byMilitaryGrade', keyTable: [OFFICER_ROW] },
      programType: 'income_surrogate',
      productCategory: 'personal',
      programRequiredDocuments: [],
    });
    expect(warnings).toEqual([]);
  });

  it('does not warn about a `declared` rule on any program — there is nothing to ignore', () => {
    const warnings = collectIncomeRuleWarnings({
      config: { strategy: 'declared' },
      programType: 'income_proof',
      productCategory: 'car',
      programRequiredDocuments: [],
    });
    expect(warnings).toEqual([]);
  });
});

describe('FR-013 — required-document gap is a warning, not a rejection', () => {
  it('names the documents the program list lacks', () => {
    const warnings = collectIncomeRuleWarnings({
      config: {
        strategy: 'byMilitaryGrade',
        keyTable: [OFFICER_ROW],
        requiredDocuments: ['military_id', 'service_certificate'],
      },
      programType: 'income_surrogate',
      productCategory: 'personal',
      programRequiredDocuments: ['military_id'],
    });
    expect(warnings).toEqual([
      { kind: 'requiredDocumentsMissing', missing: ['service_certificate'] },
    ]);
  });

  it('stays silent when the program already demands them', () => {
    const warnings = collectIncomeRuleWarnings({
      config: {
        strategy: 'byMilitaryGrade',
        keyTable: [OFFICER_ROW],
        requiredDocuments: ['military_id'],
      },
      programType: 'income_surrogate',
      productCategory: 'personal',
      programRequiredDocuments: ['military_id', 'payslip'],
    });
    expect(warnings).toEqual([]);
  });

  it('never becomes a violation', async () => {
    expect(
      await validateIncomeRule(
        {
          strategy: 'byMilitaryGrade',
          keyTable: [OFFICER_ROW],
          requiredDocuments: ['nothing_the_program_asks_for'],
        },
        ctx,
      ),
    ).toBeUndefined();
  });
});
