/**
 * WHICH figure a bank works the income out from — not whether the name is sold that
 * way, which is now the stored `incomeBases` (`program-name-income-basis.spec.ts`).
 *
 * The two were one statement until the basis was given its own columns: a name counted
 * as no-payslip exactly when one of the four surrogate FACTS was ticked for that (name,
 * category) pair. That conflation is gone, and this derivation keeps the narrower job it
 * was always doing — telling the operator, while they are choosing a method in the
 * bank-program wizard, whether the fact that method reads is asked of this category's
 * applicants at all. A method reading a fact nobody is asked resolves to no income, in
 * silence, which is the failure this field exists to surface.
 *
 * Served on the cached `program_name` member payload as `noPayslipFacts`, and pinned
 * here because it breaks silently. The specs run against `getActiveMembers`, i.e.
 * through the real mapper, rather than against a private helper — the field only matters
 * if it survives to the payload.
 */
import { describe, expect, it } from 'vitest';
import { LoanCategory } from '@prisma/client';
import { PostgresPlatformEnumerationsRepository } from '@/platform-enumerations/postgres-platform-enumerations.repository';
import { SURROGATE_BOUND_QUESTION_CODES } from '@/matching/pipeline/surrogate-fact-bindings';
import type { PrismaService } from '@/infra/prisma/prisma.service';

interface FakeEnumRow {
  id: string;
  type: string;
  key: string;
  labelAr: string;
  labelEn: string;
  active: boolean;
  systemOnly: boolean;
  deprecatedAt: Date | null;
  parentKey: string | null;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
  loanCategories: { category: LoanCategory }[];
  questions: { category: LoanCategory; question: { code: string } }[];
}

function nameRow(over: {
  key: string;
  categories: LoanCategory[];
  questions?: { category: LoanCategory; code: string }[];
}): FakeEnumRow {
  return {
    id: over.key,
    type: 'program_name',
    key: over.key,
    labelAr: over.key,
    labelEn: over.key,
    active: true,
    systemOnly: false,
    deprecatedAt: null,
    parentKey: null,
    sortOrder: 0,
    createdAt: new Date(0),
    updatedAt: new Date(0),
    loanCategories: over.categories.map((category) => ({ category })),
    questions: (over.questions ?? []).map((q) => ({
      category: q.category,
      question: { code: q.code },
    })),
  };
}

function repoWith(rows: FakeEnumRow[]): PostgresPlatformEnumerationsRepository {
  const prisma = {
    platformEnumeration: { findMany: async () => rows },
  } as unknown as PrismaService;
  return new PostgresPlatformEnumerationsRepository(prisma);
}

describe('program_name member — noPayslipFacts', () => {
  it('reports the fact codes ticked, per category', async () => {
    const [member] = await repoWith([
      nameRow({
        key: 'armed_forces',
        categories: [LoanCategory.personal, LoanCategory.car],
        questions: [
          { category: LoanCategory.personal, code: 'military_grade' },
          { category: LoanCategory.personal, code: 'employment_status' },
          { category: LoanCategory.car, code: 'employment_status' },
        ],
      }),
    ]).getActiveMembers('program_name');

    // Personal is sold without a payslip; Auto is not — the SAME name, two answers. A
    // boolean here would have had to pick one of them and be wrong about the other.
    expect(member?.noPayslipFacts).toEqual({ personal: ['military_grade'] });
  });

  it('ignores ordinary questions — only the four bound facts count', async () => {
    const [member] = await repoWith([
      nameRow({
        key: 'new_car',
        categories: [LoanCategory.car],
        questions: [
          { category: LoanCategory.car, code: 'employment_status' },
          { category: LoanCategory.car, code: 'monthly_income' },
          { category: LoanCategory.car, code: 'job_tenure' },
        ],
      }),
    ]).getActiveMembers('program_name');

    // Present but EMPTY, which the admin reads as "payslip only". Absent would mean
    // "not loaded" and would leave the wizard's picker unfiltered instead.
    expect(member?.noPayslipFacts).toEqual({});
  });

  it('recognises every bound fact code, so a fifth fact cannot be half-wired', async () => {
    // Guards the copy of these codes the admin bundle holds: if a code is added to the
    // bindings and this derivation is not re-read, the new fact would tick on the catalog
    // and still leave the name unpickable in the wizard.
    const [member] = await repoWith([
      nameRow({
        key: 'professional',
        categories: [LoanCategory.personal],
        questions: SURROGATE_BOUND_QUESTION_CODES.map((code) => ({
          category: LoanCategory.personal,
          code,
        })),
      }),
    ]).getActiveMembers('program_name');

    expect(member?.noPayslipFacts?.personal).toEqual([...SURROGATE_BOUND_QUESTION_CODES]);
  });

  it('is absent, not empty, when the questions were not loaded', async () => {
    // A caller that did not `include` the relation knows nothing about the ticks. Reading
    // that as "no facts" would empty the wizard's picker for every name at once.
    const row = nameRow({ key: 'pensioner', categories: [LoanCategory.personal] });
    const bare = { ...row } as Partial<FakeEnumRow>;
    delete bare.questions;
    const [member] = await repoWith([bare as FakeEnumRow]).getActiveMembers('program_name');

    expect(member?.noPayslipFacts).toBeUndefined();
  });
});
