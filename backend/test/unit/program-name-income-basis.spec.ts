/**
 * Where "this name is sold without a payslip" comes from.
 *
 * It is STORED, per (name, loan category), on the assignment row — chosen when the
 * name is created and edited per tab afterwards. It used to be inferred from the
 * surrogate fact ticks (see `no-payslip-fact-derivation.spec.ts`, which now pins
 * the narrower thing those ticks still answer), and that inference cost three
 * things: a new name could not say it at all, the payslip side of the picker was
 * unfilterable, and unticking the last fact silently un-sold the product.
 *
 * Two behaviours ride on the field reaching the cached member payload:
 *
 *   - the bank-program wizard narrows its name picker in BOTH directions, and
 *   - the API refuses a program whose basis the name does not carry
 *     (`bank-program-name-basis-enforcement.spec.ts`).
 *
 * Run through `getActiveMembers`, i.e. the real mapper, because the field only
 * matters if it survives to the payload.
 */
import { describe, expect, it } from 'vitest';
import { LoanCategory } from '@prisma/client';
import { PostgresPlatformEnumerationsRepository } from '@/platform-enumerations/postgres-platform-enumerations.repository';
import type { PrismaService } from '@/infra/prisma/prisma.service';

interface FakeAssignment {
  category: LoanCategory;
  payslip?: boolean;
  noPayslip?: boolean;
}

function nameRow(key: string, loanCategories: FakeAssignment[]) {
  return {
    id: key,
    type: 'program_name',
    key,
    labelAr: key,
    labelEn: key,
    active: true,
    systemOnly: false,
    deprecatedAt: null,
    parentKey: null,
    sortOrder: 0,
    createdAt: new Date(0),
    updatedAt: new Date(0),
    loanCategories,
    questions: [],
  };
}

function repoWith(rows: ReturnType<typeof nameRow>[]): PostgresPlatformEnumerationsRepository {
  const prisma = {
    platformEnumeration: { findMany: async () => rows },
  } as unknown as PrismaService;
  return new PostgresPlatformEnumerationsRepository(prisma);
}

describe('program_name member — incomeBases', () => {
  it('reports the stored bases per category', async () => {
    const [member] = await repoWith([
      nameRow('doctor', [
        { category: LoanCategory.personal, payslip: true, noPayslip: true },
        { category: LoanCategory.car, payslip: true, noPayslip: false },
      ]),
    ]).getActiveMembers('program_name');

    // The same name, two answers: sold both ways as a personal loan, payslip-only as
    // a car loan. A per-NAME flag would have to pick one and be wrong about the other.
    expect(member?.incomeBases).toEqual({
      personal: ['payslip', 'no_payslip'],
      car: ['payslip'],
    });
  });

  it('reports a no-payslip-only pair as exactly that', async () => {
    const [member] = await repoWith([
      nameRow('armed_forces', [
        { category: LoanCategory.personal, payslip: false, noPayslip: true },
      ]),
    ]).getActiveMembers('program_name');

    // The state the old derivation could not express: the picker must now REMOVE this
    // name when the operator chooses "Reads a payslip", not just when they choose the
    // other card.
    expect(member?.incomeBases).toEqual({ personal: ['no_payslip'] });
  });

  it('keys only the categories the name is offered under', async () => {
    const [member] = await repoWith([
      nameRow('home_purchase', [
        { category: LoanCategory.mortgage, payslip: true, noPayslip: false },
      ]),
    ]).getActiveMembers('program_name');

    expect(Object.keys(member?.incomeBases ?? {})).toEqual(['mortgage']);
  });

  /**
   * `undefined` is "not loaded", never "sold no way". Every consumer branches on it
   * to stay UNFILTERED — an admin bundle running against an older API must see a
   * full picker, not an empty one.
   */
  it('is undefined when the flags were not selected', async () => {
    const [member] = await repoWith([
      nameRow('legacy', [{ category: LoanCategory.personal }]),
    ]).getActiveMembers('program_name');

    expect(member?.incomeBases).toBeUndefined();
  });

  it('is an empty map for a parked name — offered nowhere, on no basis', async () => {
    const [member] = await repoWith([nameRow('parked', [])]).getActiveMembers('program_name');

    // Present and empty, not undefined: the relation WAS loaded and there is genuinely
    // nothing in it, which is a different fact from "this API does not serve bases".
    expect(member?.incomeBases).toEqual({});
  });
});
