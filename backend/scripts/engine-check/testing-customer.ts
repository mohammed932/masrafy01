/**
 * The TESTING customer `check:engine` applies as — created complete (Principle XXXVII: verified
 * mobile, first and last name, birthday, password) straight in the database, because the real
 * sign-up needs an OTP. Removed again, with every application it made, at the end of the run.
 */
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

export const TESTING_CUSTOMER_EMAIL = 'testing.engine@masrafy.local';
export const TESTING_CUSTOMER_INCOMPLETE_EMAIL = 'testing.engine.incomplete@masrafy.local';
export const TESTING_CUSTOMER_PASSWORD = 'Testing_Engine_2026!';

const prisma = new PrismaClient();

/** A 35-year-old on today's date — the age the simulator is asked to price. */
function birthdayAged(years: number): Date {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear() - years, 0, 1));
}

export async function ensureTestingCustomers(): Promise<void> {
  const passwordHash = await bcrypt.hash(TESTING_CUSTOMER_PASSWORD, 12);
  await prisma.customerAccount.upsert({
    where: { email: TESTING_CUSTOMER_EMAIL },
    create: {
      email: TESTING_CUSTOMER_EMAIL,
      phone: '+201000099901',
      mobileVerifiedAt: new Date(),
      firstName: 'TESTING',
      lastName: 'Customer',
      passwordHash,
      birthday: birthdayAged(35),
      isActive: true,
    },
    update: { passwordHash, birthday: birthdayAged(35), mobileVerifiedAt: new Date(), isActive: true },
  });
  // Complete but for the birthday — the profile gate (PROFILE_INCOMPLETE) must refuse it.
  await prisma.customerAccount.upsert({
    where: { email: TESTING_CUSTOMER_INCOMPLETE_EMAIL },
    create: {
      email: TESTING_CUSTOMER_INCOMPLETE_EMAIL,
      phone: '+201000099902',
      mobileVerifiedAt: new Date(),
      firstName: 'TESTING',
      lastName: 'Incomplete',
      passwordHash,
      birthday: null,
      isActive: true,
    },
    update: { passwordHash, birthday: null, isActive: true },
  });
}

export async function removeTestingCustomers(): Promise<void> {
  const rows = await prisma.customerAccount.findMany({
    where: { email: { in: [TESTING_CUSTOMER_EMAIL, TESTING_CUSTOMER_INCOMPLETE_EMAIL] } },
    select: { id: true },
  });
  const ids = rows.map((r) => r.id);
  if (ids.length > 0) {
    // Applications first (they hold the customer with Restrict); offers, answers and documents
    // go with them (Cascade), the customer's tokens with the customer.
    await prisma.application.deleteMany({ where: { applicantUserId: { in: ids } } });
    await prisma.customerAccount.deleteMany({ where: { id: { in: ids } } });
  }
  await prisma.$disconnect();
}
