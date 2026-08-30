import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();
(async () => {
  const gs = await p.questionGroup.findMany({ select: { id: true, code: true, titleEn: true, displayOrder: true, isActive: true }, orderBy: { displayOrder: 'asc' } });
  console.log('=== GROUPS ==='); for (const g of gs) console.log(`${g.displayOrder}\t${g.code}\t${g.isActive}\t${g.titleEn}`);
  const qs = await p.question.findMany({ select: { id: true, code: true, type: true, isActive: true, questionEn: true, group: { select: { code: true } }, loanCategories: { select: { category: true } } }, orderBy: [{ groupId: 'asc' }, { displayOrder: 'asc' }] });
  console.log('=== QUESTIONS (' + qs.length + ') ===');
  for (const q of qs) console.log(`${q.group.code}\t${q.code}\t${q.type}\t${q.isActive}\t[${q.loanCategories.map(c=>c.category).join(',')}]\t${q.questionEn}`);
  await p.$disconnect();
})().catch(e => { console.error(e.message); process.exit(1); });
