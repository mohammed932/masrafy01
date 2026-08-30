import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();
(async () => {
  const rows = await p.platformEnumeration.findMany({
    where: { type: 'surrogate_product' },
    select: { key: true, labelEn: true, active: true, templateSpec: true },
    orderBy: { key: 'asc' },
  });
  for (const r of rows) {
    console.log('=== ' + r.key + ' | ' + r.labelEn + ' | active=' + r.active);
    console.log(JSON.stringify(r.templateSpec));
  }
  await p.$disconnect();
})();
