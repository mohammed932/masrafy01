/**
 * `GET /v1/program-options` — what the mobile selection wizard is allowed to offer.
 *
 * The wizard asks the customer to commit to an income basis BEFORE it shows them
 * any program name, so this read is the only thing standing between "pick how you
 * prove your income" and a dead end. Every case below is a way the customer could
 * be walked into an empty result or a typed rejection three screens later:
 *
 *  - a deactivated program still counting → the basis looks available, apply
 *    matches nothing;
 *  - a name whose catalog assignment was revoked → `assertOfferedUnder` rejects
 *    the key at apply, after the whole questionnaire has been filled in;
 *  - a pre-catalog program (`programNameKey: null`) inflating a count → the basis
 *    offers names that do not add up to it;
 *  - an empty basis being OMITTED rather than returned with zero → the app cannot
 *    tell "no bank sells this category that way" from "older API build", and
 *    silently renders a one-choice step with no explanation.
 *
 * The counts are derived from `bank_program.programType` alone, which is the only
 * authority on how a bank sells a name (v16.4.0). The catalog contributes labels
 * and the category assignment, and constrains nothing.
 */
import { describe, expect, it } from 'vitest';
import { BankProgramType, LoanCategory } from '@prisma/client';
import { ProgramOptionsService } from '@/bank-programs/program-options.service';
import type { ActiveProgramScopeRow } from '@/bank-programs/bank-programs.repository';
import type { BankProgramRepository } from '@/bank-programs/bank-programs.repository';
import type {
  EnumerationMember,
  PlatformEnumerationsRepository,
} from '@/platform-enumerations/platform-enumerations.repository';

function member(key: string, categories: LoanCategory[]): EnumerationMember {
  return {
    type: 'program_name',
    key,
    labelAr: `${key}-ar`,
    labelEn: `${key}-en`,
    parentKey: null,
    active: true,
    deprecated: false,
    categories,
  };
}

function program(
  programNameKey: string | null,
  programType: BankProgramType,
  productCategory = 'personal',
): ActiveProgramScopeRow {
  return { programNameKey, programType, productCategory };
}

function makeService(rows: ActiveProgramScopeRow[], members: EnumerationMember[]) {
  const programs = {
    listActiveScopeRows: async () => rows,
  } as unknown as BankProgramRepository;
  const enums = {
    getActiveMembers: async () => members,
  } as unknown as PlatformEnumerationsRepository;
  return new ProgramOptionsService(programs, enums);
}

const proof = BankProgramType.income_proof;
const surrogate = BankProgramType.income_surrogate;

/** The basis entry the caller asked about — the list is ordered, payslip first. */
function basisOf(result: { incomeTypes: { programType: BankProgramType }[] }, t: BankProgramType) {
  const found = result.incomeTypes.find((i) => i.programType === t);
  if (!found) throw new Error(`missing basis ${t}`);
  return found as unknown as {
    programType: BankProgramType;
    programCount: number;
    programNames: { key: string; labelAr: string; labelEn: string; programCount: number }[];
  };
}

describe('ProgramOptionsService.forCategory', () => {
  it('splits active programs across both bases and counts banks per name', async () => {
    const service = makeService(
      [
        program('personal_loan', proof),
        program('personal_loan', proof),
        program('personal_loan', surrogate),
        program('doctor_loan', surrogate),
      ],
      [member('personal_loan', ['personal']), member('doctor_loan', ['personal'])],
    );

    const result = await service.forCategory(LoanCategory.personal);

    expect(basisOf(result, proof).programCount).toBe(2);
    expect(basisOf(result, proof).programNames).toEqual([
      { key: 'personal_loan', labelAr: 'personal_loan-ar', labelEn: 'personal_loan-en', programCount: 2 },
    ]);

    expect(basisOf(result, surrogate).programCount).toBe(2);
    expect(basisOf(result, surrogate).programNames.map((n) => n.key)).toEqual([
      'personal_loan',
      'doctor_loan',
    ]);
  });

  it('returns BOTH bases even when one has nothing behind it', async () => {
    const service = makeService([program('personal_loan', proof)], [
      member('personal_loan', ['personal']),
    ]);

    const result = await service.forCategory(LoanCategory.personal);

    expect(result.incomeTypes.map((i) => i.programType)).toEqual([proof, surrogate]);
    expect(basisOf(result, surrogate).programCount).toBe(0);
    expect(basisOf(result, surrogate).programNames).toEqual([]);
  });

  it('excludes programs from other categories', async () => {
    const service = makeService(
      [program('personal_loan', proof), program('auto_loan', proof, 'car')],
      [member('personal_loan', ['personal']), member('auto_loan', ['car'])],
    );

    const result = await service.forCategory(LoanCategory.personal);
    expect(basisOf(result, proof).programNames.map((n) => n.key)).toEqual(['personal_loan']);
  });

  it('matches the stored category case-insensitively', async () => {
    const service = makeService([program('personal_loan', proof, 'Personal')], [
      member('personal_loan', ['personal']),
    ]);

    const result = await service.forCategory(LoanCategory.personal);
    expect(basisOf(result, proof).programCount).toBe(1);
  });

  it('drops a name the catalog no longer offers under this category', async () => {
    // The program still points at the archetype, but the assignment was revoked —
    // `ProgramNameScopeService.assertOfferedUnder` would reject the key at apply.
    const service = makeService([program('parked_loan', proof)], [member('parked_loan', ['car'])]);

    const result = await service.forCategory(LoanCategory.personal);
    expect(basisOf(result, proof).programCount).toBe(0);
    expect(basisOf(result, proof).programNames).toEqual([]);
  });

  it('drops a name the catalog does not know at all', async () => {
    const service = makeService([program('ghost_loan', proof)], []);

    const result = await service.forCategory(LoanCategory.personal);
    expect(basisOf(result, proof).programCount).toBe(0);
  });

  it('ignores pre-catalog programs that instantiate no archetype', async () => {
    const service = makeService(
      [program(null, proof), program('personal_loan', proof)],
      [member('personal_loan', ['personal'])],
    );

    const result = await service.forCategory(LoanCategory.personal);
    // The total must equal the sum of the names offered, or the customer picks a
    // name and loses programs the count promised them.
    const basis = basisOf(result, proof);
    expect(basis.programCount).toBe(1);
    expect(basis.programNames.reduce((sum, n) => sum + n.programCount, 0)).toBe(
      basis.programCount,
    );
  });

  it('renders names in catalog order, not in program-row order', async () => {
    const service = makeService(
      [program('b_loan', proof), program('a_loan', proof)],
      [member('a_loan', ['personal']), member('b_loan', ['personal'])],
    );

    const result = await service.forCategory(LoanCategory.personal);
    expect(basisOf(result, proof).programNames.map((n) => n.key)).toEqual(['a_loan', 'b_loan']);
  });
});
