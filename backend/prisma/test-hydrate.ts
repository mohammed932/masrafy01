/* eslint-disable no-console */
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';

const prisma = new PrismaClient();

const FactorCatalogEntrySchema = z.object({
  labelAr: z.string().min(1),
  labelEn: z.string().min(1),
});

const ThresholdsSchema = z.object({
  excellent: z.number().int().min(0).max(100),
  good: z.number().int().min(0).max(100),
  moderate: z.number().int().min(0).max(100),
  low: z.number().int().min(0).max(100),
});

const WeightsConfigSchema = z.object({
  weights: z.record(z.string(), z.number()),
  thresholds: ThresholdsSchema,
  factorCatalog: z.record(z.string(), FactorCatalogEntrySchema),
  legacy: z.boolean().optional().default(false),
});

async function main(): Promise<void> {
  const row = await prisma.scoringEngineVersion.findFirst({
    where: { deactivatedAt: null },
  });
  console.log('row version:', row?.version);
  console.log('raw weightsConfig:', JSON.stringify(row?.weightsConfig, null, 2).slice(0, 600));
  try {
    const parsed = WeightsConfigSchema.parse(row?.weightsConfig);
    console.log('PARSE OK. weights count:', Object.keys(parsed.weights).length);
  } catch (e) {
    console.error('PARSE FAIL:', (e as Error).message);
  }
}

main()
  .catch((e) => console.error(e))
  .finally(() => prisma.$disconnect());
