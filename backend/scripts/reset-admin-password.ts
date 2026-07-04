/**
 * One-off: reset a super_admin password directly against the target DB.
 * Usage:
 *   DATABASE_URL=<prod-url> SEED_ADMIN_EMAIL=admin@gmail.com \
 *   SEED_ADMIN_PASSWORD=123456 npx ts-node scripts/reset-admin-password.ts
 */
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

async function main(): Promise<void> {
  const prisma = new PrismaClient();
  const email = (process.env['SEED_ADMIN_EMAIL'] ?? 'admin@gmail.com')
    .trim()
    .normalize('NFKC')
    .toLowerCase();
  const password = process.env['SEED_ADMIN_PASSWORD'] ?? '123456';
  const cost = Number(process.env['BCRYPT_COST'] ?? 12);

  const passwordHash = await bcrypt.hash(password, cost);
  const res = await prisma.staffAccount.update({
    where: { email },
    data: { passwordHash, mustChangePassword: false, isActive: true },
  });
  // eslint-disable-next-line no-console
  console.log(`reset password for ${res.email}`);
  await prisma.$disconnect();
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error(e);
  process.exit(1);
});
