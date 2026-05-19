/* eslint-disable no-console */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const offers = await prisma.bankOffer.findMany({
    where: { programCode: 'BANK-NXT-EDU' },
    select: { id: true, approvalTier: true, approvalFactors: true, engineVersion: true },
    take: 3,
  });
  console.log(JSON.stringify(offers, null, 2));

  const distinctEngines = await prisma.bankOffer.findMany({
    distinct: ['engineVersion'],
    select: { engineVersion: true },
  });
  console.log('engine versions in bank_offer:', distinctEngines.map((d) => d.engineVersion));

  const activeEngine = await prisma.scoringEngineVersion.findFirst({
    where: { deactivatedAt: null },
    select: { version: true, weightsConfig: true },
  });
  const wc = activeEngine?.weightsConfig as { factorCatalog?: Record<string, unknown> } | null;
  console.log('active engine version:', activeEngine?.version);
  console.log('factor catalog keys:', wc?.factorCatalog ? Object.keys(wc.factorCatalog) : '(none)');
}

main()
  .catch((err) => console.error(err))
  .finally(() => prisma.$disconnect());
