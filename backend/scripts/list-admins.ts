import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();
p.staffAccount.findMany({ select: { email: true, role: true, isActive: true } })
  .then((r) => { console.log(JSON.stringify(r, null, 2)); return p.$disconnect(); });
