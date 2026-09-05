/**
 * The catalog write: `PUT admin/bank-programs/program-names/:key/income-rule`.
 *
 * This is where the income proof is DECIDED, so its refusals are the ones that keep the
 * two screens in step. Pinned here:
 *
 *   1. VALIDATION PARITY. The catalog runs the same `validateIncomeRule` a bank's own
 *      save runs. Without it the catalog could accept a table with a duplicate key or a
 *      zero income, and the refusal would surface later on some bank's save of an
 *      unrelated field, naming a table that operator never touched and cannot see.
 *   2. `INCOME_PROOF_IN_USE`. Changing the proof while surrogate programs read it would
 *      leave their tables keyed by the OLD proof — rank rows against a grade answer —
 *      so every applicant resolves nothing and the programs quietly fall back to the
 *      declared salary. Clearing the rule does the same to a program that inherits.
 *   3. Order: the rule's own errors come BEFORE the in-use refusal. An operator fixing a
 *      typo should get the typo back, not a lecture about who else reads the proof.
 *   4. `amounts` is DROPPED, not rejected. It says whose figures a BANK PROGRAM uses;
 *      a catalog name's figures are its own by definition.
 *   5. Markers are pruned to the rule they were saved with, so a marker never survives
 *      the row it described.
 */
import { describe, expect, it, vi } from 'vitest';
import { BankProgramsService } from '@/bank-programs/bank-programs.service';
import { ERROR_CODES } from '@/common/errors/error-codes';
import type { IncomeAssumptionConfig } from '@/matching/types';
import type { SetProgramNameIncomeRuleDto } from '@/bank-programs/dto/program-name-income-rule.dto';

interface CatalogState {
  /** The stored rule on the name, or `null` for "nobody has decided". */
  incomeRule?: IncomeAssumptionConfig | null;
  valueSources?: Record<string, 'team_estimated'>;
  /** Surrogate programs filed under the name. */
  programs?: Array<{ programCode: string; strategy: string; ownAmounts: boolean }>;
  /** `false` to make the name unknown. */
  exists?: boolean;
}

function makeService(state: CatalogState) {
  const setProgramNameIncomeRule = vi.fn(
    async (
      key: string,
      rule: IncomeAssumptionConfig | null,
      valueSources: Record<string, 'team_estimated'>,
    ) => ({
      id: 'pn_professor',
      key,
      labelAr: 'أساتذة الجامعات',
      labelEn: 'University Professors',
      incomeRule: rule,
      valueSources,
    }),
  );
  const enums = {
    isAvailable: async () => true,
    findProgramName: async (key: string) =>
      state.exists === false
        ? null
        : {
            id: 'pn_professor',
            key,
            labelAr: 'أساتذة الجامعات',
            labelEn: 'University Professors',
            incomeRule: state.incomeRule ?? null,
            valueSources: state.valueSources ?? {},
          },
    getActiveMembers: async () => [{ key: 'professor' }, { key: 'doctor' }],
    programsUnderName: async () => state.programs ?? [],
    programNameLabels: async () => new Map(),
    setProgramNameIncomeRule,
    // The registry context `validateIncomeRule` needs. `professor_rank` members are what
    // a `byProfessorRank` key table's rows are checked against.
    isActiveMember: async (_type: string, key: string) =>
      ['lecturer', 'assistant_professor', 'professor'].includes(key),
    activeMembers: async () => ['lecturer', 'assistant_professor', 'professor'],
    surrogateFactRegistry: async () => [],
    questionOptionCodes: async () => [],
  };
  const audit = { create: vi.fn(async () => undefined) };
  const service = new BankProgramsService(
    {} as never,
    {} as never,
    audit as never,
    enums as never,
    { asksByProduct: async () => new Map() } as never,
  );
  return {
    write: (dto: SetProgramNameIncomeRuleDto) =>
      service.setProgramNameIncomeRule('professor', dto, { id: 'admin-1', sourceIp: null }),
    setProgramNameIncomeRule,
    audit,
  };
}

const RANK_RULE = {
  strategy: 'byProfessorRank',
  keyTable: [
    { key: 'lecturer', incomeEGP: '12000' },
    { key: 'professor', incomeEGP: '25000' },
  ],
} as unknown as SetProgramNameIncomeRuleDto['incomeRule'];

describe('catalog income rule — write', () => {
  it('stores a valid rule on a name nothing reads yet', async () => {
    const { write, setProgramNameIncomeRule } = makeService({ incomeRule: null });

    const result = await write({ incomeRule: RANK_RULE });

    expect(result.incomeRule?.strategy).toBe('byProfessorRank');
    expect(setProgramNameIncomeRule).toHaveBeenCalledOnce();
  });

  it('drops `amounts` instead of rejecting it', async () => {
    const { write, setProgramNameIncomeRule } = makeService({ incomeRule: null });

    await write({
      incomeRule: { ...RANK_RULE, amounts: 'own' } as unknown as typeof RANK_RULE,
    });

    const stored = setProgramNameIncomeRule.mock.calls[0]?.[1];
    expect(stored).toBeDefined();
    expect(stored?.amounts).toBeUndefined();
  });

  it('writes the STRATEGY change into the audit, not just "the blob changed"', async () => {
    const { write, audit } = makeService({ incomeRule: { strategy: 'declared' } });

    await write({ incomeRule: RANK_RULE });

    expect(audit.create).toHaveBeenCalledOnce();
    const payload = audit.create.mock.calls[0]?.[0] as {
      payload: { changes: { incomeRule: { before: string | null; after: string | null } } };
    };
    expect(payload.payload.changes.incomeRule).toMatchObject({
      before: 'declared',
      after: 'byProfessorRank',
    });
  });
});

describe('catalog income rule — validation parity', () => {
  it('refuses a table with a duplicate key, exactly as a bank’s save would', async () => {
    const { write } = makeService({ incomeRule: null });

    await expect(
      write({
        incomeRule: {
          strategy: 'byProfessorRank',
          keyTable: [
            { key: 'lecturer', incomeEGP: '12000' },
            { key: 'lecturer', incomeEGP: '18000' },
          ],
        } as unknown as typeof RANK_RULE,
      }),
    ).rejects.toMatchObject({ code: ERROR_CODES.INCOME_RULE_DUPLICATE_KEY });
  });

  it('refuses a zero income', async () => {
    const { write } = makeService({ incomeRule: null });

    await expect(
      write({
        incomeRule: {
          strategy: 'byProfessorRank',
          keyTable: [{ key: 'lecturer', incomeEGP: '0' }],
        } as unknown as typeof RANK_RULE,
      }),
    ).rejects.toMatchObject({ code: ERROR_CODES.INCOME_RULE_INCOME_INVALID });
  });

  it('refuses a table method with an empty table', async () => {
    const { write } = makeService({ incomeRule: null });

    await expect(
      write({
        incomeRule: { strategy: 'byProfessorRank', keyTable: [] } as unknown as typeof RANK_RULE,
      }),
    ).rejects.toMatchObject({ code: ERROR_CODES.INCOME_RULE_EMPTY });
  });

  /**
   * The order that matters: this rule is BOTH invalid and would change the proof under
   * a program that reads the old one. The typo has to win, or the operator is told about
   * a consequence of a change they cannot make yet.
   */
  it('reports the rule’s own error before the in-use refusal', async () => {
    const { write } = makeService({
      incomeRule: { strategy: 'byCDValue', scalar: { value: '4', unit: 'percent' } },
      programs: [{ programCode: 'HSBC-PER-X', strategy: 'byCDValue', ownAmounts: true }],
    });

    await expect(
      write({
        incomeRule: { strategy: 'byProfessorRank', keyTable: [] } as unknown as typeof RANK_RULE,
      }),
    ).rejects.toMatchObject({ code: ERROR_CODES.INCOME_RULE_EMPTY });
  });
});

describe('catalog income rule — INCOME_PROOF_IN_USE', () => {
  it('refuses a proof change while surrogate programs read the old one', async () => {
    const { write } = makeService({
      incomeRule: { strategy: 'byCDValue', scalar: { value: '4', unit: 'percent' } },
      programs: [
        { programCode: 'HSBC-PER-X', strategy: 'byCDValue', ownAmounts: true },
        { programCode: 'CIB-PER-X', strategy: 'byCDValue', ownAmounts: false },
      ],
    });

    await expect(write({ incomeRule: RANK_RULE })).rejects.toMatchObject({
      code: ERROR_CODES.INCOME_PROOF_IN_USE,
      meta: {
        programNameKey: 'professor',
        // BOTH programs, including the one on catalog amounts: it would silently start
        // reading a different fact, which is the same break one step further away.
        programCodes: ['HSBC-PER-X', 'CIB-PER-X'],
      },
    });
  });

  it('allows a FIGURE change while programs read the same proof', async () => {
    const { write, setProgramNameIncomeRule } = makeService({
      incomeRule: {
        strategy: 'byProfessorRank',
        keyTable: [{ key: 'lecturer', incomeEGP: '12000' }],
      },
      programs: [{ programCode: 'CIB-PER-X', strategy: 'byProfessorRank', ownAmounts: false }],
    });

    // The whole point of the feature: edit the figures once, every inheriting bank moves.
    await write({ incomeRule: RANK_RULE });

    expect(setProgramNameIncomeRule).toHaveBeenCalledOnce();
  });

  it('refuses CLEARING the rule while a program still reads it', async () => {
    const { write } = makeService({
      incomeRule: {
        strategy: 'byProfessorRank',
        keyTable: [{ key: 'lecturer', incomeEGP: '12000' }],
      },
      programs: [{ programCode: 'CIB-PER-X', strategy: 'byProfessorRank', ownAmounts: false }],
    });

    await expect(write({ incomeRule: null })).rejects.toMatchObject({
      code: ERROR_CODES.INCOME_PROOF_IN_USE,
      meta: { programCodes: ['CIB-PER-X'] },
    });
  });

  it('allows clearing when nothing reads it', async () => {
    const { write, setProgramNameIncomeRule } = makeService({
      incomeRule: { strategy: 'declared' },
      programs: [],
    });

    await write({ incomeRule: null });

    expect(setProgramNameIncomeRule.mock.calls[0]?.[1]).toBeNull();
  });
});

describe('catalog income rule — estimate markers', () => {
  it('keeps a marker addressing a row the new rule still has', async () => {
    const { write, setProgramNameIncomeRule } = makeService({ incomeRule: null });

    await write({
      incomeRule: RANK_RULE,
      valueSources: { 'incomeRule.keyTable.professor.incomeEGP': 'team_estimated' },
    });

    expect(setProgramNameIncomeRule.mock.calls[0]?.[2]).toEqual({
      'incomeRule.keyTable.professor.incomeEGP': 'team_estimated',
    });
  });

  it('prunes a marker whose row this save deletes, rather than refusing the save', async () => {
    // The row carrying the marker is gone from the incoming table. Refusing would trap
    // the operator: the control they would have to untick disappeared with its row.
    const { write, setProgramNameIncomeRule } = makeService({
      incomeRule: {
        strategy: 'byProfessorRank',
        keyTable: [
          { key: 'lecturer', incomeEGP: '12000' },
          { key: 'assistant_professor', incomeEGP: '18000' },
        ],
      },
      valueSources: { 'incomeRule.keyTable.assistant_professor.incomeEGP': 'team_estimated' },
    });

    await write({
      incomeRule: RANK_RULE,
      valueSources: { 'incomeRule.keyTable.assistant_professor.incomeEGP': 'team_estimated' },
    });

    expect(setProgramNameIncomeRule.mock.calls[0]?.[2]).toEqual({});
  });

  it('carries stored markers when the write states none — absent is not empty', async () => {
    // The catalog page has no control that marks a figure, so it omits the field. Read as
    // "the full set is empty", the first successful figure save deleted every marker on the
    // name and nothing on that screen could put them back.
    const { write, setProgramNameIncomeRule } = makeService({
      incomeRule: RANK_RULE,
      valueSources: { 'incomeRule.keyTable.professor.incomeEGP': 'team_estimated' },
    });

    await write({ incomeRule: RANK_RULE });

    expect(setProgramNameIncomeRule.mock.calls[0]?.[2]).toEqual({
      'incomeRule.keyTable.professor.incomeEGP': 'team_estimated',
    });
  });

  it('still clears them on an EXPLICIT empty map', async () => {
    const { write, setProgramNameIncomeRule } = makeService({
      incomeRule: RANK_RULE,
      valueSources: { 'incomeRule.keyTable.professor.incomeEGP': 'team_estimated' },
    });

    await write({ incomeRule: RANK_RULE, valueSources: {} });

    expect(setProgramNameIncomeRule.mock.calls[0]?.[2]).toEqual({});
  });

  it('prunes a carried marker whose row the new rule no longer has', async () => {
    const { write, setProgramNameIncomeRule } = makeService({
      incomeRule: RANK_RULE,
      valueSources: { 'incomeRule.keyTable.ghost.incomeEGP': 'team_estimated' },
    });

    await write({ incomeRule: RANK_RULE });

    expect(setProgramNameIncomeRule.mock.calls[0]?.[2]).toEqual({});
  });

  it('refuses a marker on a path the name has never had', async () => {
    const { write } = makeService({ incomeRule: null });

    await expect(
      write({
        incomeRule: RANK_RULE,
        valueSources: { 'incomeRule.keyTable.ghost.incomeEGP': 'team_estimated' },
      }),
    ).rejects.toMatchObject({ code: ERROR_CODES.VALUE_SOURCE_PATH_UNKNOWN });
  });

  it('refuses a marker holding anything other than `team_estimated`', async () => {
    const { write } = makeService({ incomeRule: null });

    await expect(
      write({
        incomeRule: RANK_RULE,
        valueSources: {
          'incomeRule.keyTable.professor.incomeEGP': 'guessed' as 'team_estimated',
        },
      }),
    ).rejects.toMatchObject({ code: ERROR_CODES.VALUE_SOURCE_VALUE_INVALID });
  });
});

describe('catalog income rule — unknown name', () => {
  it('is unknown, not empty', async () => {
    const { write } = makeService({ exists: false });

    await expect(write({ incomeRule: RANK_RULE })).rejects.toMatchObject({
      code: ERROR_CODES.PROGRAM_NAME_KEY_UNKNOWN,
    });
  });
});
