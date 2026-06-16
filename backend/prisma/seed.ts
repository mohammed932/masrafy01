/**
 * Idempotent bootstrap seed for the initial super_admin (FR-040, R-015).
 * Re-running this script is safe: it no-ops when an account with the canonical
 * email already exists.
 *
 * Run:  npx prisma db seed
 */
import { PrismaClient, StaffRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { seedQuestionnaire } from './seed-questionnaire';

const prisma = new PrismaClient();

function canonicaliseEmail(raw: string): { email: string; display: string } {
  const display = raw.trim();
  const email = display.normalize('NFKC').toLowerCase();
  return { email, display };
}

async function main(): Promise<void> {
  const rawEmail = required('SEED_ADMIN_EMAIL');
  const name = required('SEED_ADMIN_NAME');
  const password = required('SEED_ADMIN_PASSWORD');
  const cost = Number(process.env['BCRYPT_COST'] ?? 12);

  const { email, display } = canonicaliseEmail(rawEmail);

  const existing = await prisma.staffAccount.findUnique({ where: { email } });
  if (existing) {
    log(`seed: super_admin already present (${email}) — no action.`);
  } else {
    if (password.length < 12 || password.length > 128) {
      throw new Error('SEED_ADMIN_PASSWORD must be 12–128 characters');
    }

    const passwordHash = await bcrypt.hash(password, cost);
    await prisma.staffAccount.create({
      data: {
        email,
        emailDisplay: display,
        name: name.trim(),
        passwordHash,
        role: StaffRole.super_admin,
        isActive: true,
        mustChangePassword: true,
      },
    });
    log(`seed: created super_admin (${email}) with mustChangePassword=true.`);
  }

  // Idempotent: questionnaire (4 categories) + published versions + ACTIVE
  // per-program weight sets. Without this a fresh DB returns QUESTIONNAIRE_NOT_PUBLISHED.
  await seedQuestionnaire();
}

function required(key: string): string {
  const v = process.env[key];
  if (!v) throw new Error(`Missing env var: ${key}`);
  return v;
}

function log(msg: string): void {
  // eslint-disable-next-line no-console
  console.log(`[seed] ${msg}`);
}

main()
  .catch((err) => {
    // eslint-disable-next-line no-console
    console.error('[seed] failed:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
