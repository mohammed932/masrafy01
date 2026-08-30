import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();
(async () => {
  const names = await p.platformEnumeration.findMany({
    where: { type: 'program_name', surrogateProductKey: { not: null } },
    select: { key: true, surrogateProductKey: true },
  });
  console.log('names linked to products:', JSON.stringify(names));
  const progs = await p.bankProgram.findMany({
    where: { programNameKey: { in: names.map(n => n.key) } },
    select: { programCode: true, programNameKey: true },
  });
  console.log('bank programs:', JSON.stringify(progs));
  await p.$disconnect();
})();
