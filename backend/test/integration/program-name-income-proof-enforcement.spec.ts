/**
 * One name, one income proof — the ENFORCEMENT half.
 *
 * A catalog program name states exactly ONE thing a bank works the income out from, and
 * every surrogate program filed under it reads that one. A bank that wants a different
 * proof is selling a different product and needs a different name; what a bank may
 * change is the FIGURES.
 *
 * Exercised through the private guard rather than `create()`/`update()`, for the reason
 * `bank-program-name-category-enforcement.spec.ts` gives: reaching it through the DTO
 * needs forty unrelated fields, and the branch under test is the four-way order of
 * "not surrogate / grandfathered / name states nothing / name states something else".
 *
 * Each case here is a silent failure if it breaks:
 *
 *   · a payslip program refused for a proof no quote of its ever consults
 *   · a legacy program frozen out of every edit INCLUDING the one that would fix it
 *   · a name that states nothing accepting the first proof a bank happens to send,
 *     which is how one name comes to mean two things
 *   · a mismatch accepted, which is a table keyed by rank against a grade answer:
 *     every applicant resolves `no_matching_row` and the program quietly quotes off
 *     the declared salary instead
 */
import { describe, expect, it } from 'vitest';
import { BankProgramsService } from '@/bank-programs/bank-programs.service';
import { ERROR_CODES } from '@/common/errors/error-codes';
import type { IncomeAssumptionConfig } from '@/matching/types';

function makeGuard(catalog: Record<string, IncomeAssumptionConfig>) {
  const enums = {
    isAvailable: async () => true,
    programNameIncomeRules: async () => new Map(Object.entries(catalog)),
  };
  const service = new BankProgramsService({} as never, {} as never, {} as never, enums as never);
  return (args: {
    programNameKey: string;
    programType: 'income_proof' | 'income_surrogate';
    strategy: string;
    storedIncomeProof?: string;
  }): Promise<void> =>
    (
      service as unknown as {
        assertIncomeProofMatchesName(a: typeof args): Promise<void>;
      }
    ).assertIncomeProofMatchesName(args);
}

/** The same catalog, driving the ACTIVATION guard instead of the save guard. */
function makeActivationGuard(catalog: Record<string, IncomeAssumptionConfig>) {
  const enums = {
    isAvailable: async () => true,
    programNameIncomeRules: async () => new Map(Object.entries(catalog)),
  };
  const service = new BankProgramsService({} as never, {} as never, {} as never, enums as never);
  return (existing: {
    programType: string;
    programNameKey: string | null;
    incomeAssumption: unknown;
  }): Promise<void> =>
    (
      service as unknown as {
        assertActivatable(e: typeof existing): Promise<void>;
      }
    ).assertActivatable(existing);
}

const CATALOG: Record<string, IncomeAssumptionConfig> = {
  professor: {
    strategy: 'byProfessorRank',
    keyTable: [{ key: 'lecturer', incomeEGP: '12000' }],
  },
  // A stated `declared` — a decision, not a blank. Eleven seeded business programs
  // work this way: no payslip, no substitute figure, the applicant's own number.
  working_capital: { strategy: 'declared' },
  // `armed_forces` intentionally absent from this map: the name exists in the catalog
  // but states no proof, which is the MISSING case.
};

describe('surrogate program → the name’s income proof', () => {
  it('accepts a program reading exactly what the name states', async () => {
    const guard = makeGuard(CATALOG);
    await expect(
      guard({
        programNameKey: 'professor',
        programType: 'income_surrogate',
        strategy: 'byProfessorRank',
      }),
    ).resolves.toBeUndefined();
  });

  it('refuses a program reading something else, and names both sides', async () => {
    const guard = makeGuard(CATALOG);
    await expect(
      guard({
        programNameKey: 'professor',
        programType: 'income_surrogate',
        strategy: 'byCDValue',
      }),
    ).rejects.toMatchObject({
      code: ERROR_CODES.PROGRAM_NAME_INCOME_PROOF_MISMATCH,
      meta: {
        programNameKey: 'professor',
        // Both, because the operator has to see which of the two to change — and the
        // catalog's is the one that stands.
        expected: 'byProfessorRank',
        got: 'byCDValue',
      },
    });
  });

  it('refuses a program under a name that states NOTHING, pointing at the catalog', async () => {
    const guard = makeGuard(CATALOG);
    await expect(
      guard({
        programNameKey: 'armed_forces',
        programType: 'income_surrogate',
        strategy: 'byMilitaryGrade',
      }),
    ).rejects.toMatchObject({
      code: ERROR_CODES.PROGRAM_NAME_INCOME_PROOF_MISSING,
      // The fix is on the catalog, not on the program, so the name is what the message
      // needs. Defaulting to whatever this first bank sent is exactly how one name ends
      // up meaning two things.
      meta: { programNameKey: 'armed_forces' },
    });
  });

  it('treats a stated `declared` as a real answer that must be matched', async () => {
    const guard = makeGuard(CATALOG);
    await expect(
      guard({
        programNameKey: 'working_capital',
        programType: 'income_surrogate',
        strategy: 'declared',
      }),
    ).resolves.toBeUndefined();
    await expect(
      guard({
        programNameKey: 'working_capital',
        programType: 'income_surrogate',
        strategy: 'byTotalDeposits',
      }),
    ).rejects.toMatchObject({ code: ERROR_CODES.PROGRAM_NAME_INCOME_PROOF_MISMATCH });
  });
});

describe('scope and grandfathering', () => {
  /**
   * A payslip program is quoted off the salary the applicant declared and reaches the
   * rule only when there is none. Holding it to the name's proof would refuse saves no
   * quote of its depends on — and the catalog is full of names carrying both kinds:
   * `doctor` has two surrogate programs and one payslip car program.
   */
  it('does not apply to a payslip program, even one that disagrees', async () => {
    const guard = makeGuard(CATALOG);
    await expect(
      guard({ programNameKey: 'professor', programType: 'income_proof', strategy: 'declared' }),
    ).resolves.toBeUndefined();
  });

  it('does not apply to a payslip program under a name that states nothing', async () => {
    const guard = makeGuard(CATALOG);
    await expect(
      guard({ programNameKey: 'armed_forces', programType: 'income_proof', strategy: 'declared' }),
    ).resolves.toBeUndefined();
  });

  /**
   * `update()` is a full-replacement PUT that re-runs every check. Without the
   * grandfather a program that predates the rule would be frozen out of every edit —
   * a rate change, a fee change — including the edit that would bring it into line.
   * The trap `20260817090400` documents, one axis over: the fixing save is the failing
   * save.
   */
  it('grandfathers an UNCHANGED proof under an unchanged name', async () => {
    const guard = makeGuard(CATALOG);
    await expect(
      guard({
        programNameKey: 'professor',
        programType: 'income_surrogate',
        strategy: 'byCDValue',
        storedIncomeProof: 'byCDValue',
      }),
    ).resolves.toBeUndefined();
  });

  it('still refuses when the proof CHANGES, even under an unchanged name', async () => {
    const guard = makeGuard(CATALOG);
    await expect(
      guard({
        programNameKey: 'professor',
        programType: 'income_surrogate',
        strategy: 'byTotalDeposits',
        storedIncomeProof: 'byCDValue',
      }),
    ).rejects.toMatchObject({ code: ERROR_CODES.PROGRAM_NAME_INCOME_PROOF_MISMATCH });
  });

  it('grandfathers a program under a name that states nothing, so it stays editable', async () => {
    const guard = makeGuard(CATALOG);
    await expect(
      guard({
        programNameKey: 'armed_forces',
        programType: 'income_surrogate',
        strategy: 'byMilitaryGrade',
        storedIncomeProof: 'byMilitaryGrade',
      }),
    ).resolves.toBeUndefined();
  });
});


/**
 * Going LIVE is a stricter test than saving.
 *
 * The save guard grandfathers an unchanged (name, proof) pair so a legacy program is not
 * frozen out of the edit that would fix it. That mercy is right for an edit and wrong for a
 * customer — so activation re-checks the same two things with nothing forgiven, and these
 * cases are what stop the grandfathering from leaking into the public surface.
 */
describe('activation — a live program must have a table behind it', () => {
  const activatable = makeActivationGuard(CATALOG);

  it('refuses a surrogate program whose name states nothing', async () => {
    await expect(
      activatable({
        programType: 'income_surrogate',
        programNameKey: 'armed_forces',
        incomeAssumption: { strategy: 'byMilitaryGrade' },
      }),
    ).rejects.toMatchObject({ code: ERROR_CODES.PROGRAM_NAME_INCOME_PROOF_MISSING });
  });

  it('refuses a surrogate program with no catalog name at all', async () => {
    await expect(
      activatable({
        programType: 'income_surrogate',
        programNameKey: null,
        incomeAssumption: { strategy: 'byMilitaryGrade' },
      }),
    ).rejects.toMatchObject({ code: ERROR_CODES.PROGRAM_NAME_INCOME_PROOF_MISSING });
  });

  it('refuses a program the SAVE would have grandfathered', async () => {
    // This is the whole reason the guard exists: `assertIncomeProofMatchesName` lets an
    // unchanged pair through, so a program reading a proof its name does not state can be
    // edited indefinitely. It must still not reach a customer.
    await expect(
      activatable({
        programType: 'income_surrogate',
        programNameKey: 'professor',
        incomeAssumption: { strategy: 'byMilitaryGrade' },
      }),
    ).rejects.toMatchObject({ code: ERROR_CODES.PROGRAM_NAME_INCOME_PROOF_MISMATCH });
  });

  it('allows a surrogate program that reads what its name states', async () => {
    await expect(
      activatable({
        programType: 'income_surrogate',
        programNameKey: 'professor',
        incomeAssumption: { strategy: 'byProfessorRank' },
      }),
    ).resolves.toBeUndefined();
  });

  it('allows an inheriting program, which carries no figures of its own', async () => {
    // `amounts: 'catalog'` means the table is the name's. The strategy is still the
    // program's and still has to agree.
    await expect(
      activatable({
        programType: 'income_surrogate',
        programNameKey: 'professor',
        incomeAssumption: { strategy: 'byProfessorRank', amounts: 'catalog' },
      }),
    ).resolves.toBeUndefined();
  });

  it('allows a stated `declared` proof', async () => {
    await expect(
      activatable({
        programType: 'income_surrogate',
        programNameKey: 'working_capital',
        incomeAssumption: { strategy: 'declared' },
      }),
    ).resolves.toBeUndefined();
  });

  it('never asks a payslip program about a proof it does not consult', async () => {
    await expect(
      activatable({
        programType: 'income_proof',
        programNameKey: 'armed_forces',
        incomeAssumption: { strategy: 'declared' },
      }),
    ).resolves.toBeUndefined();
  });
});
