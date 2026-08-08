/**
 * Seed every bank program from the PREDEFINED program catalog.
 *
 * Why this replaces the old `seed-demo.ts` / `seed-business-programs.ts` program
 * blocks: those invented per-bank marketing names ("Auto Loan — Prime", "SME
 * Growth Finance") that existed nowhere in the catalog an admin curates at
 * `/program-catalog`. A program is supposed to BE a catalog archetype offered by
 * a bank — same name across banks, different terms — which is what makes the
 * marketplace comparable.
 *
 * Composition, per (bank × archetype × category):
 *
 *   in-code baseline (PROGRAM_BASELINES: tenor, limits, eligibility, pricing,
 *      fees, docs — one flat set per archetype, no category dimension)
 *     → bank posture   (BANK_POSTURE: this bank's spread over any archetype)
 *     → offering delta (per-program tweak)
 *     → category skeleton (the fields the baseline never carries: programType,
 *        currencies, employment + transfer types, income assumption, flags)
 *
 * The category comes from the MATRIX offering, not from the archetype: it sets
 * `productCategory`, the middle programCode segment and the skeleton.
 *
 * A catalog entry carries no lending values (labels, active, sort order, and the
 * loan categories it may be offered under) — every real bank program authors its
 * own specs — so the baseline is always the dev fixture in
 * `data/program-baselines.ts`; the enumeration row supplies existence, the two
 * labels, and whether this offering's category is one the name is assigned to.
 *
 *   npm run seed:programs                # create what's missing
 *   npm run seed:programs -- --force     # also re-assert seed-owned fields
 *   npm run seed:programs -- --wipe      # delete offers + apps + programs first
 *
 * Idempotent: `programCode` is deterministic (`ABK-PER-DOCTOR`), so a re-run
 * skips what exists. Run `npm run seed:weights` afterwards — a program with no
 * ACTIVE ScoringWeightSet scores every offer 0 (Principle V).
 *
 * DEV DATA: figures are plausible Egyptian-market placeholders, not contracted
 * terms.
 */
import { Prisma, PrismaClient } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import {
  BANK_ALIASES,
  BANK_POSTURE,
  CATEGORY_CODES,
  MATRIX,
  type BankDelta,
  type BankOffering,
} from './data/bank-program-matrix';
import { PROGRAM_BASELINES, type ProgramBaseline } from './data/program-baselines';

const prisma = new PrismaClient();

const SEED_NOTE =
  'Seeded from the predefined program catalog (seed-bank-programs.ts) — dev data, verify terms before shared use.';

/** Employment / transfer / income posture the archetype baseline never carries. */
interface CategorySkeleton {
  programType: 'income_proof' | 'income_surrogate';
  acceptedEmploymentTypes: string[];
  acceptedTransferTypes: string[];
  minMonthsInJob: number;
}

/** Archetypes underwritten on declared revenue rather than a salary certificate. */
const SELF_EMPLOYED_ARCHETYPES = new Set(['doctor', 'professional', 'pharmacy']);

function skeletonFor(catalogKey: string, category: string): CategorySkeleton {
  if (category === 'business') {
    return {
      programType: 'income_surrogate',
      acceptedEmploymentTypes: ['business_owner', 'self_employed'],
      acceptedTransferTypes: ['income_transfer_letter'],
      minMonthsInJob: 12,
    };
  }
  if (SELF_EMPLOYED_ARCHETYPES.has(catalogKey)) {
    return {
      programType: 'income_surrogate',
      acceptedEmploymentTypes: ['self_employed', 'freelancer'],
      acceptedTransferTypes: ['income_transfer_letter'],
      minMonthsInJob: 12,
    };
  }
  if (catalogKey === 'pensioner') {
    return {
      programType: 'income_proof',
      acceptedEmploymentTypes: ['retired'],
      acceptedTransferTypes: ['payroll'],
      minMonthsInJob: 0,
    };
  }
  if (catalogKey === 'govt_employee' || catalogKey === 'armed_forces' || catalogKey === 'police') {
    return {
      programType: 'income_proof',
      acceptedEmploymentTypes: ['government_employee', 'salaried'],
      acceptedTransferTypes: ['payroll', 'salary_transfer_letter'],
      minMonthsInJob: 6,
    };
  }
  return {
    programType: 'income_proof',
    acceptedEmploymentTypes: ['salaried', 'private_employee'],
    acceptedTransferTypes: ['payroll', 'salary_transfer_letter'],
    minMonthsInJob: 6,
  };
}

/** Bank posture first, per-offering delta wins field by field. */
function mergeDeltas(posture: BankDelta | undefined, offering: BankDelta | undefined): BankDelta {
  return { ...(posture ?? {}), ...(offering ?? {}) };
}

/** Money + rates stay Decimal end to end (Principle I) and serialise as strings. */
function addPercent(value: string | undefined, deltaPercent: string | undefined): string | undefined {
  if (!value) return value;
  if (!deltaPercent) return value;
  const next = new Decimal(value).plus(new Decimal(deltaPercent));
  const floored = next.lessThan(new Decimal('1')) ? new Decimal('1') : next;
  return floored.toFixed(4);
}

function scaleAmount(value: string | undefined, factor: number | undefined): string | undefined {
  if (!value) return value;
  if (factor === undefined) return value;
  return new Decimal(value).times(new Decimal(factor.toString())).toFixed(2);
}

function clampPercent(value: string | undefined, deltaPercent: string | undefined): string | undefined {
  if (!value || !deltaPercent) return value;
  let next = new Decimal(value).plus(new Decimal(deltaPercent));
  if (next.lessThan(1)) next = new Decimal(1);
  if (next.greaterThan(100)) next = new Decimal(100);
  return next.toFixed(4);
}

interface ComposedProgram {
  programCode: string;
  bankName: string;
  bankId: string | null;
  friendlyName: string;
  friendlyNameAr: string | null;
  programNameKey: string;
  productCategory: string;
  data: Prisma.BankProgramUncheckedCreateInput;
}

function compose(args: {
  bankName: string;
  bankId: string | null;
  offering: BankOffering;
  baseline: ProgramBaseline;
  labelEn: string;
  labelAr: string;
  actorId: string;
}): ComposedProgram {
  const { bankName, bankId, offering, baseline, labelEn, labelAr, actorId } = args;
  const delta = mergeDeltas(BANK_POSTURE[bankName], offering.delta);
  const skeleton = skeletonFor(offering.catalogKey, offering.category);

  const alias = BANK_ALIASES[bankName] ?? bankName.replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 6);
  const programCode = `${alias}-${CATEGORY_CODES[offering.category] ?? 'GEN'}-${offering.catalogKey.toUpperCase()}`;

  const minMonths = baseline.tenor?.minMonths ?? 12;
  const maxMonthsBase = baseline.tenor?.maxMonths ?? 60;
  const maxMonths = Math.max(minMonths, maxMonthsBase + (delta.tenorMaxMonthsDelta ?? 0));

  const egpBase = baseline.loanLimits?.perCurrency?.['EGP'];
  const minAmount = scaleAmount(egpBase?.minAmount, delta.minAmountFactor) ?? '10000.00';
  const maxAmountScaled = scaleAmount(egpBase?.maxAmount, delta.maxAmountFactor) ?? '1000000.00';
  // A factor must never invert the range.
  const maxAmount = new Decimal(maxAmountScaled).lessThan(new Decimal(minAmount))
    ? minAmount
    : maxAmountScaled;

  const variable = baseline.pricing?.isVariableRate === true;
  const pricing = variable
    ? {
        isVariableRate: true,
        currentEffectiveRatePercent: addPercent(
          baseline.pricing?.currentEffectiveRatePercent ?? '24.0000',
          delta.rateDeltaPercent,
        ),
      }
    : {
        isVariableRate: false,
        baseRatePercent: addPercent(
          baseline.pricing?.baseRatePercent ?? '25.0000',
          delta.rateDeltaPercent,
        ),
      };

  const el = baseline.eligibility ?? {};
  const minIncome = scaleAmount(el.minMonthlyIncomeEGP ?? '8000.00', delta.minIncomeFactor);

  const requiredDocuments = Array.from(
    new Set([...(baseline.requiredDocuments ?? []), ...(delta.extraDocuments ?? [])]),
  );

  const data: Prisma.BankProgramUncheckedCreateInput = {
    programCode,
    bankName,
    bankId,
    friendlyName: labelEn,
    friendlyNameAr: labelAr,
    programNameKey: offering.catalogKey,
    programType: skeleton.programType,
    productCategory: offering.category,
    currencies: ['EGP'],
    active: true,
    isShariaCompliant: delta.isShariaCompliant ?? false,
    version: 1,
    operatorNotes: SEED_NOTE,
    operatorTips: [...(delta.operatorTips ?? [])],
    requiredDocuments,
    tenor: { minMonths, maxMonths },
    loanLimits: { perCurrency: { EGP: { minAmount, maxAmount } } },
    pricing,
    eligibility: {
      acceptedEmploymentTypes: skeleton.acceptedEmploymentTypes,
      ageMin: el.ageMin ?? 21,
      ageMax: el.ageMax ?? 60,
      minMonthlyIncomeEGP: minIncome,
      minMonthsInJob: skeleton.minMonthsInJob,
      dbrCapPercent: clampPercent(el.dbrCapPercent ?? '50.0000', delta.dbrCapDeltaPercent),
      ...(el.dbrBands ? { dbrBands: el.dbrBands } : {}),
      skipDbrCheck: el.skipDbrCheck ?? false,
      acceptedTransferTypes: skeleton.acceptedTransferTypes,
      ...(el.commercialBankIncomePercent
        ? { commercialBankIncomePercent: el.commercialBankIncomePercent }
        : {}),
      ...(el.publicBankIncomePercent
        ? { publicBankIncomePercent: el.publicBankIncomePercent }
        : {}),
      requiresCD: false,
      requiresAutoLoanAtABK: false,
      requiresAutoLoanAtOtherBank: false,
      requiresCreditCardAtOtherBank: false,
      requiresCompoundProperty: false,
      requiresCollateral: el.requiresCollateral ?? false,
      requiresClubMembership: false,
      requiresExistingLoan: false,
      requiresFRMUVerification: false,
      requiresQualitativeReview: false,
      requiresNoDocuments: false,
    } as unknown as Prisma.InputJsonValue,
    incomeAssumption: { strategy: 'declared' },
    fees: {
      adminFeePercent: delta.adminFeePercent ?? baseline.fees?.adminFeePercent ?? '1.0000',
      stampDutyPercent: baseline.fees?.stampDutyPercent ?? '0.5000',
      lifeInsurancePercent: baseline.fees?.lifeInsurancePercent ?? '0.5000',
      lifeInsuranceMandatory: false,
      latePaymentFeePercent: '4.0000',
      payoffCashPercent: '12.0000',
      payoffBuyoutPercent: '15.0000',
    },
    createdBy: actorId,
    updatedBy: actorId,
  };

  return {
    programCode,
    bankName,
    bankId,
    friendlyName: labelEn,
    friendlyNameAr: labelAr,
    programNameKey: offering.catalogKey,
    productCategory: offering.category,
    data,
  };
}

/**
 * Everything that references a bank program by id OR by code snapshot, deleted
 * newest-dependency-first. `BankOffer.programCode` is a plain string, so an
 * offer would otherwise outlive its program and silently score 0 at triage.
 */
async function wipe(): Promise<void> {
  if (process.env['NODE_ENV'] === 'production') {
    throw new Error('[seed-bank-programs] --wipe refuses to run with NODE_ENV=production.');
  }
  const offers = await prisma.bankOffer.deleteMany({});
  const apps = await prisma.application.deleteMany({});
  const programs = await prisma.bankProgram.deleteMany({});
  console.log(
    `[seed-bank-programs] wiped ${programs.count} program(s), ${offers.count} offer(s), ${apps.count} application(s).`,
  );
}

export async function seedBankPrograms(actorStaffId?: string): Promise<void> {
  const force = process.argv.includes('--force');
  const shouldWipe = process.argv.includes('--wipe');

  const actorId = actorStaffId ?? (await resolveSeedActor());
  if (!actorId) {
    console.error('[seed-bank-programs] no active super_admin — run `npx prisma db seed` first.');
    return;
  }

  if (shouldWipe) await wipe();

  const banks = await prisma.bank.findMany({ select: { id: true, nameEnglish: true } });
  const bankIdByName = new Map(banks.map((b) => [b.nameEnglish, b.id]));

  // A predefined program carries no lending values — the two labels are all a
  // bank program takes from it. It does carry one binding: the loan categories
  // it may be OFFERED under, which the API enforces on write, so the seed has
  // to respect it or it would create rows the API itself would reject.
  const members = await prisma.platformEnumeration.findMany({
    where: { type: 'program_name', active: true, deprecatedAt: null },
    select: {
      key: true,
      labelEn: true,
      labelAr: true,
      loanCategories: { select: { category: true } },
    },
  });
  const memberByKey = new Map(members.map((m) => [m.key, m]));

  let created = 0;
  let updated = 0;
  let skipped = 0;
  const problems: string[] = [];

  for (const [bankName, offerings] of Object.entries(MATRIX)) {
    const bankId = bankIdByName.get(bankName) ?? null;
    if (!bankId) {
      problems.push(`bank '${bankName}' missing — run \`npm run seed:banks\` first`);
      continue;
    }

    for (const offering of offerings) {
      const member = memberByKey.get(offering.catalogKey);
      if (!member) {
        problems.push(`program_name '${offering.catalogKey}' not in the catalog — skipped`);
        continue;
      }

      // The catalog decides which loan types may offer a name. Reported rather
      // than thrown, like every other seed guard: an operator narrowing a
      // category should not break `--wipe`, only shrink what it produces.
      if (!member.loanCategories.some((c) => c.category === offering.category)) {
        problems.push(
          `program_name '${offering.catalogKey}' is not assigned to '${offering.category}' — skipped`,
        );
        continue;
      }

      const baseline = PROGRAM_BASELINES[offering.catalogKey];
      if (!baseline) {
        problems.push(`no seed baseline for '${offering.catalogKey}' — skipped`);
        continue;
      }

      const composed = compose({
        bankName,
        bankId,
        offering,
        baseline,
        labelEn: member.labelEn,
        labelAr: member.labelAr,
        actorId,
      });

      const existing = await prisma.bankProgram.findUnique({
        where: { programCode: composed.programCode },
        select: { id: true },
      });

      if (existing && !force) {
        skipped += 1;
        continue;
      }

      if (existing) {
        const { programCode: _code, createdBy: _createdBy, ...rest } = composed.data;
        await prisma.bankProgram.update({ where: { id: existing.id }, data: rest });
        updated += 1;
        continue;
      }

      await prisma.bankProgram.create({ data: composed.data });
      created += 1;
    }
  }

  for (const p of problems) console.warn(`[seed-bank-programs] ! ${p}`);
  console.log(
    `[seed-bank-programs] ${created} created, ${updated} updated, ${skipped} left untouched.`,
  );
  if (created > 0 || updated > 0) {
    console.log('[seed-bank-programs] next: `npm run seed:weights` (no ACTIVE weight set → 0% offers).');
  }
}

async function resolveSeedActor(): Promise<string | null> {
  const staff = await prisma.staffAccount.findFirst({
    where: { role: 'super_admin', isActive: true },
    orderBy: { createdAt: 'asc' },
    select: { id: true },
  });
  return staff?.id ?? null;
}

// Standalone run: `npx tsx prisma/seed-bank-programs.ts`. Skipped when imported.
if (process.argv[1]?.includes('seed-bank-programs')) {
  seedBankPrograms()
    .catch((e: unknown) => {
      console.error(e);
      process.exit(1);
    })
    .finally(() => prisma.$disconnect());
}
