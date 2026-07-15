/**
 * Demo seeder for mobile end-users (CustomerAccount rows) so the admin
 * dashboard's `/customers` list + detail drawer have data to render.
 *
 *   npm run seed:customers      # standalone
 *
 * Also invoked by `npm run seed:demo`. Idempotent: PHONE customers upsert by
 * `phone`, SOCIAL customers by `email`, so re-running is safe and never
 * duplicates. Demo-only — NOT wired into the prod bootstrap `seed.ts`.
 *
 * Covers both registration paths (Principle XIII) and a spread of states:
 * verified/unverified, active/inactive, with/without email, varied join +
 * last-login dates, and one row flagged `nameSplitNeedsReview`.
 */
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const DEV_CUSTOMER_PASSWORD = 'dev-customer-12!';
const DAY_MS = 24 * 60 * 60 * 1000;

interface DemoCustomer {
  registrationPath: 'PHONE' | 'SOCIAL';
  phone: string | null;
  email: string | null;
  firstName: string;
  lastName: string;
  birthday: string | null; // ISO yyyy-mm-dd; null = SOCIAL still completing profile
  locale: 'ar-EG' | 'en-US';
  isVerified: boolean;
  isActive: boolean;
  mobileVerified: boolean; // → sets mobileVerifiedAt
  hasPhoto: boolean;
  nameSplitNeedsReview: boolean;
  daysAgoCreated: number;
  daysAgoLastLogin: number | null; // null = never logged in
  // → seeds NATIONAL_ID_FRONT + NATIONAL_ID_BACK Document rows (status
  // 'uploaded') so the account clears the select-offer gate (v9.1.0).
  hasNationalId?: boolean;
}

const DEMO_CUSTOMERS: readonly DemoCustomer[] = [
  // ── PHONE path — fully onboarded, verified, active ───────────────────────
  { registrationPath: 'PHONE', phone: '+201112000001', email: 'nour.ibrahim@masrafy.local', firstName: 'Nour', lastName: 'Ibrahim', birthday: '1992-03-14', locale: 'ar-EG', isVerified: true, isActive: true, mobileVerified: true, hasPhoto: true, nameSplitNeedsReview: false, daysAgoCreated: 1, daysAgoLastLogin: 0, hasNationalId: true },
  { registrationPath: 'PHONE', phone: '+201112000002', email: 'kareem.mansour@masrafy.local', firstName: 'Kareem', lastName: 'Mansour', birthday: '1988-11-02', locale: 'ar-EG', isVerified: true, isActive: true, mobileVerified: true, hasPhoto: true, nameSplitNeedsReview: false, daysAgoCreated: 4, daysAgoLastLogin: 1 },
  { registrationPath: 'PHONE', phone: '+201112000003', email: null, firstName: 'Salma', lastName: 'Fahmy', birthday: '1996-06-21', locale: 'ar-EG', isVerified: true, isActive: true, mobileVerified: true, hasPhoto: false, nameSplitNeedsReview: false, daysAgoCreated: 9, daysAgoLastLogin: 3 },
  // ── PHONE path — verified phone but profile not finished (unverified) ─────
  { registrationPath: 'PHONE', phone: '+201112000004', email: null, firstName: 'Tarek', lastName: 'Saad', birthday: null, locale: 'ar-EG', isVerified: false, isActive: true, mobileVerified: true, hasPhoto: false, nameSplitNeedsReview: false, daysAgoCreated: 2, daysAgoLastLogin: null },
  // ── PHONE path — deactivated account ─────────────────────────────────────
  { registrationPath: 'PHONE', phone: '+201112000005', email: 'hossam.aziz@masrafy.local', firstName: 'Hossam', lastName: 'Aziz', birthday: '1984-01-30', locale: 'ar-EG', isVerified: true, isActive: false, mobileVerified: true, hasPhoto: true, nameSplitNeedsReview: false, daysAgoCreated: 45, daysAgoLastLogin: 20 },
  // ── SOCIAL path — Google, verified, active, English locale ───────────────
  { registrationPath: 'SOCIAL', phone: '+201112000006', email: 'layla.hassan@gmail.com', firstName: 'Layla', lastName: 'Hassan', birthday: '1995-08-09', locale: 'en-US', isVerified: true, isActive: true, mobileVerified: true, hasPhoto: true, nameSplitNeedsReview: false, daysAgoCreated: 6, daysAgoLastLogin: 2 },
  { registrationPath: 'SOCIAL', phone: '+201112000007', email: 'omar.naguib@gmail.com', firstName: 'Omar', lastName: 'Naguib', birthday: '1990-12-12', locale: 'ar-EG', isVerified: true, isActive: true, mobileVerified: true, hasPhoto: true, nameSplitNeedsReview: false, daysAgoCreated: 14, daysAgoLastLogin: 5 },
  // ── SOCIAL path — lite row: no phone yet, no birthday (Complete-Profile pending)
  { registrationPath: 'SOCIAL', phone: null, email: 'reem.elsayed@gmail.com', firstName: 'Reem', lastName: 'El-Sayed', birthday: null, locale: 'ar-EG', isVerified: false, isActive: true, mobileVerified: false, hasPhoto: false, nameSplitNeedsReview: false, daysAgoCreated: 0, daysAgoLastLogin: null },
  // ── SOCIAL path — name split needs review (single-token provider name) ────
  { registrationPath: 'SOCIAL', phone: null, email: 'mahmoudonly@gmail.com', firstName: 'Mahmoud', lastName: '—', birthday: null, locale: 'ar-EG', isVerified: false, isActive: true, mobileVerified: false, hasPhoto: false, nameSplitNeedsReview: true, daysAgoCreated: 3, daysAgoLastLogin: null },
  // ── A few more verified/active for list volume ───────────────────────────
  { registrationPath: 'PHONE', phone: '+201112000010', email: 'sara.kamal@masrafy.local', firstName: 'Sara', lastName: 'Kamal', birthday: '1993-04-18', locale: 'ar-EG', isVerified: true, isActive: true, mobileVerified: true, hasPhoto: true, nameSplitNeedsReview: false, daysAgoCreated: 22, daysAgoLastLogin: 7 },
  { registrationPath: 'PHONE', phone: '+201112000011', email: 'hany.said@masrafy.local', firstName: 'Hany', lastName: 'Said', birthday: '1980-09-27', locale: 'ar-EG', isVerified: true, isActive: true, mobileVerified: true, hasPhoto: true, nameSplitNeedsReview: false, daysAgoCreated: 30, daysAgoLastLogin: 12 },
  { registrationPath: 'SOCIAL', phone: '+201112000012', email: 'mariam.adel@gmail.com', firstName: 'Mariam', lastName: 'Adel', birthday: '1998-02-05', locale: 'en-US', isVerified: true, isActive: true, mobileVerified: true, hasPhoto: true, nameSplitNeedsReview: false, daysAgoCreated: 60, daysAgoLastLogin: 40 },
];

function daysAgo(days: number): Date {
  return new Date(Date.now() - days * DAY_MS);
}

/** Idempotent. Upserts every demo customer; PHONE by phone, SOCIAL by email. */
export async function seedCustomers(prisma: PrismaClient): Promise<void> {
  const passwordHash = await bcrypt.hash(DEV_CUSTOMER_PASSWORD, 12);
  let created = 0;
  let skipped = 0;

  for (const c of DEMO_CUSTOMERS) {
    // PHONE customers have a verified password (Principle XXXVII); SOCIAL do not.
    const createData = {
      registrationPath: c.registrationPath,
      phone: c.phone,
      email: c.email,
      firstName: c.firstName,
      lastName: c.lastName,
      nameSplitNeedsReview: c.nameSplitNeedsReview,
      locale: c.locale,
      passwordHash: c.registrationPath === 'PHONE' ? passwordHash : null,
      birthday: c.birthday ? new Date(c.birthday) : null,
      profilePhotoKey: c.hasPhoto ? `customers/${c.firstName.toLowerCase()}/photo/seed.jpg` : null,
      mobileVerifiedAt: c.mobileVerified ? daysAgo(c.daysAgoCreated) : null,
      isVerified: c.isVerified,
      isActive: c.isActive,
      createdAt: daysAgo(c.daysAgoCreated),
      lastLoginAt: c.daysAgoLastLogin === null ? null : daysAgo(c.daysAgoLastLogin),
    };

    // SOCIAL lite rows may have a null phone, so they can only be keyed by email.
    const where = c.phone ? { phone: c.phone } : { email: c.email! };
    const existing = await prisma.customerAccount.findFirst({ where });
    const customer =
      existing ?? (await prisma.customerAccount.create({ data: createData }));
    if (existing) {
      skipped += 1;
    } else {
      created += 1;
    }

    if (c.hasNationalId) {
      await seedNationalId(prisma, customer.id, c.firstName);
    }
  }

  log(`customers: created ${created}, skipped ${skipped} (already present) of ${DEMO_CUSTOMERS.length}`);
  log(`  PHONE customers password = ${DEV_CUSTOMER_PASSWORD}`);
}

/**
 * Idempotently seeds the two National-ID Document rows (front + back) for a
 * customer with status `uploaded`, so `hasUsableIdDoc` treats them as present
 * and the account clears the select-offer gate. Keyed on the deterministic
 * `s3Key` so re-runs never duplicate.
 */
async function seedNationalId(
  prisma: PrismaClient,
  customerId: string,
  firstName: string,
): Promise<void> {
  const slug = firstName.toLowerCase();
  const sides: ReadonlyArray<{ type: string; file: string }> = [
    { type: 'NATIONAL_ID_FRONT', file: 'front' },
    { type: 'NATIONAL_ID_BACK', file: 'back' },
  ];
  for (const side of sides) {
    const s3Key = `customers/${slug}/national-id/${side.file}-seed.jpg`;
    const existingDoc = await prisma.document.findUnique({ where: { s3Key } });
    if (existingDoc) continue;
    await prisma.document.create({
      data: {
        customerId,
        documentType: side.type,
        s3Key,
        status: 'uploaded',
        uploadedByContext: 'user',
        uploadedBySource: 'mobile_app',
        uploadedByCustomerId: customerId,
        originalFilename: `national-id-${side.file}.jpg`,
        mimeType: 'image/jpeg',
        sizeBytes: 245_000,
      },
    });
  }
}

function log(msg: string): void {
  // eslint-disable-next-line no-console
  console.log(`[seed-customers] ${msg}`);
}

// Standalone entrypoint (`npm run seed:customers`). When imported by another
// seeder this block is skipped because that seeder owns the PrismaClient.
if (process.argv[1] && process.argv[1].endsWith('seed-customers.ts')) {
  const prisma = new PrismaClient();
  seedCustomers(prisma)
    .catch((err) => {
      // eslint-disable-next-line no-console
      console.error('[seed-customers] failed:', err);
      process.exit(1);
    })
    .finally(() => prisma.$disconnect());
}
