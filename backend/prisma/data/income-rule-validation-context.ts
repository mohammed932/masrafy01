/**
 * The Prisma-backed `IncomeRuleValidationContext`, in ONE place.
 *
 * Every seed that writes an income rule has to validate it through the same code
 * path the admin save uses — a rule that is invalid at save time is a product no
 * operator can then edit, and a seed that skips the check is how one gets written.
 * The context is the four reads that check needs.
 *
 * Extracted because there were already two byte-identical copies
 * (`seed-program-catalog.ts` and `seed-collateral-products.ts`) and the archetype
 * seed would have been a third. Three copies of a registry read is exactly the
 * drift A25 is about: the day `surrogateFacts` learns a new condition, two of them
 * find out.
 *
 * A factory rather than a const, because each seed owns its own `PrismaClient`.
 */
import type { PrismaClient } from '@prisma/client';
import type { IncomeRuleValidationContext } from '../../src/bank-programs/validation/income-rule.validator';

export function incomeRuleValidationContext(prisma: PrismaClient): IncomeRuleValidationContext {
  return {
    isActiveMember: async (type, key) =>
      (await prisma.platformEnumeration.count({
        where: { type, key, active: true, deprecatedAt: null },
      })) > 0,

    activeMembers: async (type) =>
      (
        await prisma.platformEnumeration.findMany({
          where: { type, active: true, deprecatedAt: null },
          orderBy: [{ sortOrder: 'asc' }, { key: 'asc' }],
          select: { key: true },
        })
      ).map((m) => m.key),

    // The engine's own view of the registry, not the operator's: a fact whose question
    // left the pool, went inactive, or is not one of the two bindable types cannot be
    // read, so it must not be offered to a rule as if it could.
    surrogateFacts: async () => {
      const rows = await prisma.platformEnumeration.findMany({
        where: {
          type: 'surrogate_fact',
          active: true,
          deprecatedAt: null,
          boundQuestion: { isActive: true, type: { in: ['SINGLE_SELECT', 'NUMERIC'] } },
        },
        orderBy: [{ sortOrder: 'asc' }, { key: 'asc' }],
        select: { key: true, boundQuestion: { select: { code: true, type: true } } },
      });
      return rows.flatMap((row) =>
        row.boundQuestion === null
          ? []
          : [
              {
                key: row.key,
                questionCode: row.boundQuestion.code,
                type: row.boundQuestion.type as 'SINGLE_SELECT' | 'NUMERIC',
              },
            ],
      );
    },

    questionOptionCodes: async (questionCode) =>
      (
        await prisma.questionOption.findMany({
          where: { question: { code: questionCode }, isActive: true },
          orderBy: [{ displayOrder: 'asc' }, { code: 'asc' }],
          select: { code: true },
        })
      ).map((o) => o.code),
  };
}
