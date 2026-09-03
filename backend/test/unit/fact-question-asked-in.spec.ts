/**
 * Which loan types are ASKED the question a surrogate fact reads (`boundQuestion.askedIn`).
 *
 * This is the one thing the bank-program wizard must be able to say while an operator is
 * still choosing a method: a rule keyed by a figure this category's applicants are never
 * asked resolves to no income at all, for everyone, in silence.
 *
 * It replaces `noPayslipFacts` (v16.3.0), which answered the same question from a per-name
 * tick-list on the program-catalog screen — a second claim an operator maintained by hand,
 * that no quote, publish check or save validation ever read, and that could disagree with
 * the questionnaire without anything failing. The questionnaire's own assignment
 * (`question_loan_category`) is what the engine actually depends on, so it is what the
 * warning reads.
 *
 * Pinned through `getActiveMembers`, i.e. the real mapper, rather than a private helper:
 * the field only matters if it survives to the payload.
 */
import { describe, expect, it } from 'vitest';
import { LoanCategory } from '@prisma/client';
import { PostgresPlatformEnumerationsRepository } from '@/platform-enumerations/postgres-platform-enumerations.repository';
import type { PrismaService } from '@/infra/prisma/prisma.service';

interface FakeBoundQuestion {
  id: string;
  code: string;
  type: string;
  questionAr: string;
  questionEn: string;
  isActive: boolean;
  options: Array<{ code: string; labelAr: string; labelEn: string }>;
  loanCategories: Array<{ category: LoanCategory }>;
}

function factRow(over: {
  key: string;
  question?: Partial<FakeBoundQuestion> & { askedIn?: LoanCategory[] };
}): Record<string, unknown> {
  const q = over.question;
  return {
    id: over.key,
    type: 'surrogate_fact',
    key: over.key,
    labelAr: over.key,
    labelEn: over.key,
    active: true,
    systemOnly: true,
    deprecatedAt: null,
    parentKey: null,
    sortOrder: 0,
    createdAt: new Date(0),
    updatedAt: new Date(0),
    loanCategories: [],
    boundQuestion: q
      ? {
          id: q.id ?? `q_${over.key}`,
          code: q.code ?? over.key,
          type: q.type ?? 'SINGLE_SELECT',
          questionAr: q.questionAr ?? over.key,
          questionEn: q.questionEn ?? over.key,
          isActive: q.isActive ?? true,
          options: q.options ?? [],
          loanCategories: (q.askedIn ?? []).map((category) => ({ category })),
        }
      : null,
  };
}

function repoWith(rows: Array<Record<string, unknown>>): PostgresPlatformEnumerationsRepository {
  const prisma = {
    platformEnumeration: { findMany: async () => rows },
  } as unknown as PrismaService;
  return new PostgresPlatformEnumerationsRepository(prisma);
}

describe('surrogate_fact member — boundQuestion.askedIn', () => {
  it('carries the categories the question is assigned to, in canonical order', async () => {
    const members = await repoWith([
      factRow({
        key: 'military_grade',
        question: { code: 'military_grade', askedIn: [LoanCategory.car, LoanCategory.personal] },
      }),
    ]).getActiveMembers('surrogate_fact');

    expect(members[0]?.boundQuestion?.askedIn).toEqual(['personal', 'car']);
  });

  it('reports an unassigned question as asked by NOBODY, not by everybody', async () => {
    // The direction that matters. A fact nobody is asked must read as a warning, and a
    // permissive fallback would hide exactly the rules that quote nothing.
    const members = await repoWith([
      factRow({ key: 'academic_rank', question: { code: 'academic_rank', askedIn: [] } }),
    ]).getActiveMembers('surrogate_fact');

    expect(members[0]?.boundQuestion?.askedIn).toEqual([]);
  });

  it('reports an unbound fact as `null`, with nothing to read `askedIn` off', async () => {
    // A real, representable state: a fact can exist before its question does, and
    // `ON DELETE SET NULL` can strip the binding later.
    const members = await repoWith([factRow({ key: 'taxi_licence' })]).getActiveMembers(
      'surrogate_fact',
    );

    expect(members[0]?.boundQuestion).toBeNull();
  });

  it('reports a fact bound to a TEXT question as BOUND', async () => {
    // Text is bindable since the ask board opened every pool question: the bank states one
    // figure against the reserved presence key and the fact resolves to "they answered".
    // It used to map to `null` here, on the reasoning that a text answer keys no table.
    const members = await repoWith([
      factRow({
        key: 'notes',
        question: { code: 'notes', type: 'TEXT', askedIn: [LoanCategory.personal] },
      }),
    ]).getActiveMembers('surrogate_fact');

    expect(members[0]?.boundQuestion).toMatchObject({ code: 'notes', type: 'TEXT' });
  });

  it('keeps a binding whose question is INACTIVE, so the form can say why', async () => {
    // Different fix from "unbound": the question has left the questionnaire. Hiding it
    // would make an existing rule's method vanish from its own picker.
    const members = await repoWith([
      factRow({
        key: 'years_in_practice',
        question: {
          code: 'years_in_practice',
          type: 'NUMERIC',
          isActive: false,
          askedIn: [LoanCategory.personal],
        },
      }),
    ]).getActiveMembers('surrogate_fact');

    expect(members[0]?.boundQuestion).toMatchObject({
      code: 'years_in_practice',
      active: false,
      askedIn: ['personal'],
    });
  });
});
