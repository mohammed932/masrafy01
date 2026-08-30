import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();
(async () => {
  const types = await p.enumerationTypeDef.findMany({ select: { key: true, active: true, parentTypeKey: true, fallbackParentKey: true, surrogateProductKey: true, mirrorQuestionId: true } , orderBy: { key: 'asc' }});
  console.log('=== TYPES ===');
  for (const t of types) console.log(JSON.stringify(t));
  const counts = await p.platformEnumeration.groupBy({ by: ['type'], _count: true });
  console.log('=== VALUE COUNTS ==='); console.log(JSON.stringify(counts));
  const prods = await p.platformEnumeration.findMany({ where: { type: 'surrogate_product' }, select: { key: true, labelEn: true, active: true, incomeRule: true, templateSpec: true } });
  console.log('=== SURROGATE PRODUCTS ==='); console.log(JSON.stringify(prods, null, 1));
  const facts = await p.platformEnumeration.findMany({ where: { type: 'surrogate_fact' }, select: { key: true, labelEn: true, active: true, boundQuestionId: true, surrogateProductKey: true } });
  console.log('=== FACTS ==='); for (const f of facts) console.log(JSON.stringify(f));
  const classes = await p.platformEnumeration.findMany({ where: { type: 'compound_category' }, select: { key: true, labelEn: true, sortOrder: true, active: true } , orderBy:{sortOrder:'asc'}});
  console.log('=== CLASSES ==='); for (const c of classes) console.log(JSON.stringify(c));
  const byParent = await p.platformEnumeration.groupBy({ by: ['parentKey'], where: { type: 'compound' }, _count: true });
  console.log('=== COMPOUNDS BY CLASS ==='); console.log(JSON.stringify(byParent));
  await p.$disconnect();
})().catch(e => { console.error(e.message); process.exit(1); });
