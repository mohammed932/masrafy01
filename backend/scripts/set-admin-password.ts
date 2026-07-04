import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

async function main(): Promise<void> {
  const prisma = new PrismaClient();
  const email = 'admin@gmail.com';
  const cost = Number(process.env['BCRYPT_COST'] ?? 12);
  const passwordHash = await bcrypt.hash('123456', cost);
  const res = await prisma.staffAccount.update({
    where: { email },
    data: { passwordHash, mustChangePassword: false },
  });
  // eslint-disable-next-line no-console
  console.log(`updated password for ${res.email}`);
  await prisma.$disconnect();
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error(e);
  process.exit(1);
});
