/**
 * Put ONE car application in front of a customer, so the cover figures can be SEEN in the app.
 *
 *   npx tsx scripts/demo-car-insurance-application.ts <mobile> [carPrice] [downPayment] [tenor]
 *   npx tsx scripts/demo-car-insurance-application.ts +201112000001 2000000 600000 60
 *
 * Why this exists: the offer-details screen is the one surface that renders the premium, and
 * reaching it needs an application whose SELECTED offer comes from a programme that demands
 * cover. Every offer already on this database predates the feature, and the demo seeder's own
 * car applications match programmes that state no cover table — so there was nothing to open.
 *
 * It runs the REAL engine over the REAL snapshot mapper (`toBankProgramSnapshot`), which is the
 * part that matters: that mapper is where a programme on `plansSource: 'product'` picks up the
 * product's cover table. `seed-demo-applications.ts` hand-rolls its own mapper and therefore
 * cannot inherit one — which is exactly why its car offers show no premium.
 *
 * The SELECTED offer is the first one that actually carries a premium, so "View offer" opens on
 * the screen this exists to show. Tagged `demo-car-insurance-` so it can be found and deleted.
 */
import { Prisma, PrismaClient } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { EngineService } from '../src/matching/engine.service';
import {
  effectiveProgramNameRule,
  type CatalogRuleResolution,
  type LinkedProduct,
} from '../src/matching/pipeline/income-rule-inherit';
import { asTenorDefaults } from '../src/matching/pipeline/tenor-inherit';
import { asPlanDefaults } from '../src/matching/pipeline/plan-inherit';
import {
  toBankProgramSnapshot,
  type BankProgramRow,
} from '../src/bank-programs/bank-program-snapshot.mapper';
import { MATCHING_ENGINE_VERSION } from '../src/matching/types';
import type {
  ApplicantProfile,
  IncomeAssumptionConfig,
  Offer,
  SurrogateFactValue,
} from '../src/matching/types';

const prisma = new PrismaClient();
const engine = new EngineService();
const num = (v: string): SurrogateFactValue => ({ kind: 'numeric', value: new Decimal(v) });
const pick = (c: string): SurrogateFactValue => ({ kind: 'choice', optionCode: c });

function jsonify(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(
    JSON.stringify(value, (_k, v) => (v instanceof Decimal ? v.toString() : v)),
  ) as Prisma.InputJsonValue;
}

async function main(): Promise<void> {
  const [mobileArg, priceArg, downArg, tenorArg] = process.argv.slice(2);
  if (mobileArg === undefined) {
    console.error('usage: npx tsx scripts/demo-car-insurance-application.ts <mobile> [carPrice] [downPayment] [tenor]');
    process.exit(2);
  }
  const price = new Decimal(priceArg ?? '2000000');
  const down = new Decimal(downArg ?? '600000');
  const tenorMonths = Number(tenorArg ?? 60);

  const customer = await prisma.customerAccount.findFirst({
    where: { phone: mobileArg },
    select: { id: true, phone: true, firstName: true, lastName: true },
  });
  if (customer === null) throw new Error(`no customer with mobile ${mobileArg}`);

  // The catalog, resolved exactly as the quote path resolves it.
  const enumRows = await prisma.platformEnumeration.findMany({
    where: { type: { in: ['program_name', 'surrogate_product'] } },
    select: {
      type: true, key: true, incomeRule: true, tenorDefaults: true, planDefaults: true,
      surrogateProductKey: true, active: true, deprecatedAt: true,
    },
  });
  const products = new Map<string, LinkedProduct>();
  for (const row of enumRows) {
    if (row.type !== 'surrogate_product') continue;
    products.set(row.key, {
      key: row.key,
      active: row.active,
      deprecatedAt: row.deprecatedAt,
      rule: row.incomeRule === null ? undefined : (row.incomeRule as IncomeAssumptionConfig),
      tenorDefaults: asTenorDefaults(row.tenorDefaults),
      planDefaults: asPlanDefaults(row.planDefaults),
    });
  }
  const catalog = new Map<string, CatalogRuleResolution>();
  for (const row of enumRows) {
    if (row.type !== 'program_name') continue;
    const r = effectiveProgramNameRule(
      row.incomeRule === null ? undefined : (row.incomeRule as IncomeAssumptionConfig),
      row.surrogateProductKey === null ? undefined : products.get(row.surrogateProductKey),
    );
    if (r !== undefined) catalog.set(row.key, r);
  }

  const rows = await prisma.bankProgram.findMany({
    where: { active: true, productCategory: 'car' },
    include: { bank: { select: { isFeatured: true } } },
  });
  const programs = rows.map((p) => toBankProgramSnapshot(p as unknown as BankProgramRow, catalog));

  const profile: ApplicantProfile = {
    age: 35,
    loanPurpose: 'car',
    requestedAmountEGP: price.minus(down),
    preferredTenorMonths: tenorMonths,
    priority: 'lowest_installment',
    employment: {
      employmentType: 'private_sector_employee',
      monthlyNetSalaryEGP: new Decimal('80000'),
      monthsInJob: 48,
      salaryTransferType: 'none',
      companyName: 'Acme',
      companyType: 'private',
    },
    obligations: {
      existingMonthlyObligationsEGP: new Decimal('0'),
      hasCurrentLoan: false,
      hasPreviousRejection: false,
    },
    assets: {},
    surrogateFacts: {
      car_price: num(price.toString()),
      car_down_payment: num(down.toString()),
      car_origin: pick('germany'),
      car_fuel_type: pick('petrol_diesel'),
      vehicle_condition: pick('new'),
      home_ownership: pick('owned_by_me'),
      i_score: num('700'),
      business_months: pick('24m_or_more'),
      self_employed_licence: pick('yes'),
    },
    carDetails: { carValueEGP: price, downPaymentEGP: down },
  };

  const result = engine.run({ profile, programs, skipEligibility: true });
  if (result.offers.length === 0) throw new Error('engine produced no offer for this profile');

  const insured = result.offers.filter(
    (o) => o.feesBreakdown.carInsuranceAnnualEGP !== undefined,
  );
  console.log(`# ${result.offers.length} offer(s); ${insured.length} carry a cover premium`);
  for (const o of result.offers) {
    const b = o.feesBreakdown;
    console.log(
      `  ${o.programCode} — ${b.carInsuranceAnnualEGP ?? 'no cover'}` +
        (b.carInsuranceAnnualEGP ? ` /yr x ${b.carInsuranceYears} = ${b.carInsuranceTotalEGP}` : ''),
    );
  }
  if (insured.length === 0) {
    throw new Error('no offer carries a premium — nothing to show; check the deposit share');
  }

  const now = new Date();
  const version = await prisma.questionnaireVersion.findFirst({
    where: { isActive: true },
    orderBy: { versionNumber: 'desc' },
    select: { id: true },
  });

  const applicationId = await prisma.$transaction(async (tx) => {
    const app = await tx.application.create({
      data: {
        applicantUserId: customer.id,
        submissionCorrelationId: `demo-car-insurance-${now.getTime()}`,
        status: 'matched',
        leadStatus: 'pending',
        priority: 'lowest_installment',
        requestedAmountEGP: new Prisma.Decimal(price.minus(down).toString()),
        preferredTenorMonths: tenorMonths,
        loanPurpose: 'car',
        category: 'car',
        questionnaireVersionId: version?.id ?? null,
        age: 35,
        applicantProfile: jsonify(profile),
        summary: jsonify({
          programsCheckedCount: result.programsChecked,
          eligibleProgramsCount: result.eligibleCount,
          engineDurationMs: result.engineDurationMs,
        }),
        engineDurationMs: result.engineDurationMs,
        programsCheckedCount: result.programsChecked,
        eligibleProgramsCount: result.eligibleCount,
        createdAt: now,
      },
      select: { id: true },
    });

    let selectedOfferId: string | null = null;
    for (const [rankIndex, offer] of result.offers.entries()) {
      const o = offer as Offer;
      const row = await tx.bankOffer.create({
        data: {
          applicationId: app.id,
          programCode: o.programCode,
          programVersion: o.programVersion,
          bankName: o.bankName,
          bankIsFeatured: o.bankIsFeatured,
          isShariaCompliant: o.isShariaCompliant,
          programFriendlyName: o.programFriendlyName,
          effectiveRatePercent: new Prisma.Decimal(o.effectiveRatePercent.toString()),
          monthlyInstallmentEGP: new Prisma.Decimal(o.monthlyInstallmentEGP.toString()),
          requestedLoanAmountEGP: new Prisma.Decimal(o.requestedLoanAmountEGP.toString()),
          effectiveLoanAmountEGP: new Prisma.Decimal(o.effectiveLoanAmountEGP.toString()),
          requestedTenorMonths: o.requestedTenorMonths,
          effectiveTenorMonths: o.effectiveTenorMonths,
          feesBreakdown: jsonify(o.feesBreakdown),
          rankIndex,
          engineVersion: MATCHING_ENGINE_VERSION,
          requiredDocuments: o.requiredDocuments,
          matchReasons: o.matchReasons,
          cascadeTrace: jsonify(o.cascadeTrace),
          qualitativeReviewBadge: o.qualitativeReviewBadge,
          selfDeclared: o.selfDeclared,
          maxLoanAvailableEGP: o.maxLoanAvailableEGP
            ? new Prisma.Decimal(o.maxLoanAvailableEGP.toString())
            : null,
          createdAt: now,
        },
        select: { id: true },
      });
      // The SELECTED offer is the first INSURED one, so "View offer" opens on the screen
      // this script exists to show rather than on whichever programme ranked first.
      if (selectedOfferId === null && o.feesBreakdown.carInsuranceAnnualEGP !== undefined) {
        selectedOfferId = row.id;
      }
    }

    // Both are required or `listMine` filters the row out — it shows only applications the
    // customer has proceeded with, keyed on the offer they picked.
    await tx.application.update({
      where: { id: app.id },
      data: { userSelectedBankOfferId: selectedOfferId, userProceededAt: now },
    });
    return app.id;
  });

  console.log(`# application ${applicationId} created for ${customer.phone} — open "My Loans" in the app`);
  await prisma.$disconnect();
}

void main();
