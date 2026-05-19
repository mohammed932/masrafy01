/* eslint-disable no-console */
import { ApprovalTier, Prisma, PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const FACTOR_WEIGHTS: Record<string, number> = {
  ISCORE_PREMIUM: 18,
  ISCORE_GOOD: 8,
  ISCORE_LOW: -15,
  DBR_LOW: 12,
  DBR_HIGH: -12,
  EMPLOYMENT_STABLE: 8,
  EMPLOYMENT_NEW: -6,
  SALARY_DOMICILED: 6,
  SALARY_EXTERNAL: -4,
  INCOME_HIGH: 5,
  INCOME_TIGHT: -7,
  EXISTING_LOANS_NONE: 4,
  EXISTING_LOANS_HEAVY: -8,
  AGE_PRIME: 3,
  AGE_HIGH: -5,
  BANKING_LONG: 4,
  PROPERTY_LTV_GOOD: 5,
  COSIGNER_PRESENT: 3,
};

function rand(min: number, max: number): number {
  return min + Math.floor(Math.random() * (max - min));
}

interface FactorImpact { code: string; impact: number }
interface OfferFactors { positive: FactorImpact[]; negative: FactorImpact[] }

function buildOfferFactors(tier: ApprovalTier, hasPropertyValue: boolean): OfferFactors {
  const positivePool: string[] = [];
  const negativePool: string[] = [];

  switch (tier) {
    case 'excellent':
      positivePool.push('ISCORE_PREMIUM', 'DBR_LOW', 'EMPLOYMENT_STABLE', 'SALARY_DOMICILED', 'INCOME_HIGH', 'EXISTING_LOANS_NONE', 'BANKING_LONG', 'AGE_PRIME');
      break;
    case 'good':
      positivePool.push('ISCORE_GOOD', 'DBR_LOW', 'EMPLOYMENT_STABLE', 'SALARY_DOMICILED', 'AGE_PRIME', 'BANKING_LONG');
      negativePool.push('INCOME_TIGHT');
      break;
    case 'moderate':
      positivePool.push('ISCORE_GOOD', 'EMPLOYMENT_STABLE', 'AGE_PRIME');
      negativePool.push('DBR_HIGH', 'INCOME_TIGHT', 'SALARY_EXTERNAL');
      break;
    case 'low':
      positivePool.push('SALARY_DOMICILED', 'COSIGNER_PRESENT');
      negativePool.push('ISCORE_LOW', 'DBR_HIGH', 'EMPLOYMENT_NEW', 'EXISTING_LOANS_HEAVY', 'INCOME_TIGHT');
      break;
    case 'very_low':
      positivePool.push('COSIGNER_PRESENT');
      negativePool.push('ISCORE_LOW', 'DBR_HIGH', 'EMPLOYMENT_NEW', 'EXISTING_LOANS_HEAVY', 'AGE_HIGH', 'SALARY_EXTERNAL');
      break;
  }
  if (hasPropertyValue) positivePool.push('PROPERTY_LTV_GOOD');

  const positiveCount =
    tier === 'excellent' || tier === 'good'
      ? rand(3, Math.min(5, positivePool.length + 1))
      : rand(1, 3);
  const negativeCount =
    tier === 'low' || tier === 'very_low'
      ? rand(3, Math.min(5, negativePool.length + 1))
      : rand(0, 2);

  const sample = (pool: string[], count: number): string[] => {
    const out: string[] = [];
    const copy = [...pool];
    for (let i = 0; i < count && copy.length > 0; i++) {
      const idx = Math.floor(Math.random() * copy.length);
      out.push(copy.splice(idx, 1)[0]!);
    }
    return out;
  };

  return {
    positive: sample(positivePool, positiveCount).map((code) => ({ code, impact: FACTOR_WEIGHTS[code] ?? 0 })),
    negative: sample(negativePool, negativeCount).map((code) => ({ code, impact: FACTOR_WEIGHTS[code] ?? 0 })),
  };
}

async function main(): Promise<void> {
  const offers = await prisma.bankOffer.findMany({
    select: {
      id: true,
      approvalTier: true,
      approvalFactors: true,
      application: { select: { loanPurpose: true } },
    },
  });

  let touched = 0;
  let skipped = 0;
  for (const o of offers) {
    const raw = (o.approvalFactors ?? {}) as { positive?: unknown[]; negative?: unknown[] };
    const hasFactors =
      Array.isArray(raw.positive) && Array.isArray(raw.negative) &&
      (raw.positive.length > 0 || raw.negative.length > 0);
    if (hasFactors) { skipped++; continue; }
    const hasProperty =
      o.application.loanPurpose === 'home_renovation' || o.application.loanPurpose === 'car';
    const factors = buildOfferFactors(o.approvalTier, hasProperty);
    await prisma.bankOffer.update({
      where: { id: o.id },
      data: {
        approvalFactors: {
          positive: factors.positive,
          negative: factors.negative,
        } as unknown as Prisma.InputJsonValue,
        matchReasons: factors.positive.map((f) => f.code),
      },
    });
    touched++;
  }
  console.log(`backfill: updated ${touched} offers, skipped ${skipped} already-rich.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
