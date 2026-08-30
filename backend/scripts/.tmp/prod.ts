import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();
(async () => {
  const row = await p.platformEnumeration.findFirst({ where: { type:'surrogate_product', key: process.argv[2] ?? 'compound_owner' }, select:{key:true,labelEn:true,labelAr:true,incomeRule:true,templateSpec:true,valueSources:true} });
  console.log(JSON.stringify(row, null, 1));
  await p.$disconnect();
})().catch(e=>{console.error(e);process.exit(1)});
