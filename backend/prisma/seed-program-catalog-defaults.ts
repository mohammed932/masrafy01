/**
 * Feature 010 (FR-004) — seeded per-category lending defaults for the predefined
 * program catalog, so a fresh install has usable prefill instead of an empty form.
 *
 * IDEMPOTENT: a member whose `defaults` is already non-empty is left alone, so
 * running this after an admin has tuned the catalog never clobbers their work.
 * Pass `--force` to overwrite.
 *
 * These figures are STARTING POINTS for the Egyptian retail market, not policy
 * truth. They are prefill only: copied into a bank program on save (FR-009) and
 * never consulted at match time (FR-021b).
 *
 *   npm run seed:catalog-defaults
 *   npm run seed:catalog-defaults -- --force
 */

import { Prisma, PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/** Partial bank-program shape — mirrors `ProgramDefaultsDto`. */
interface CatalogDefaults {
  tenor?: { minMonths?: number; maxMonths?: number };
  loanLimits?: { perCurrency?: Record<string, { minAmount?: string; maxAmount?: string }> };
  eligibility?: {
    ageMin?: number;
    ageMax?: number;
    minMonthlyIncomeEGP?: string;
    dbrCapPercent?: string;
    dbrBands?: Array<{ upToIncomeEGP: string | null; capPercent: string }>;
    skipDbrCheck?: boolean;
    requiresCollateral?: boolean;
    commercialBankIncomePercent?: string;
    publicBankIncomePercent?: string;
  };
  pricing?: {
    isVariableRate?: boolean;
    baseRatePercent?: string;
    currentEffectiveRatePercent?: string;
  };
  fees?: {
    adminFeePercent?: string;
    stampDutyPercent?: string;
    lifeInsurancePercent?: string;
    lifeInsuranceMinLoanEGP?: string;
  };
  requiredDocuments?: string[];
}

const egp = (minAmount: string, maxAmount: string) => ({ perCurrency: { EGP: { minAmount, maxAmount } } });

/**
 * The standard income-banded DBR curve: lower earners keep a larger share of
 * income, so their cap is tighter. Programs that want a flat cap simply omit
 * `dbrBands` and keep `dbrCapPercent` (FR-020).
 */
const STANDARD_DBR_BANDS = [
  { upToIncomeEGP: '10000.00', capPercent: '35.0000' },
  { upToIncomeEGP: '25000.00', capPercent: '45.0000' },
  { upToIncomeEGP: null, capPercent: '55.0000' },
];

const SALARIED_DOCS = ['national_id', 'salary_certificate', 'hr_letter', 'bank_statement'];
const SELF_EMPLOYED_DOCS = ['national_id', 'commercial_register', 'tax_card', 'bank_statement'];

/** Baseline every personal-loan archetype starts from, then overrides. */
const PERSONAL_BASE: CatalogDefaults = {
  tenor: { minMonths: 12, maxMonths: 60 },
  loanLimits: egp('20000.00', '1000000.00'),
  eligibility: {
    ageMin: 21,
    ageMax: 60,
    minMonthlyIncomeEGP: '8000.00',
    dbrCapPercent: '50.0000',
    dbrBands: STANDARD_DBR_BANDS,
    skipDbrCheck: false,
    requiresCollateral: false,
  },
  pricing: { isVariableRate: false, baseRatePercent: '26.0000' },
  fees: {
    adminFeePercent: '1.0000',
    stampDutyPercent: '0.5000',
    lifeInsurancePercent: '0.5000',
  },
  requiredDocuments: SALARIED_DOCS,
};

/** Deep-merges an override onto a base so archetypes stay one-liners. */
function extend(base: CatalogDefaults, override: CatalogDefaults): CatalogDefaults {
  return {
    ...base,
    ...override,
    tenor: { ...base.tenor, ...override.tenor },
    loanLimits: override.loanLimits ?? base.loanLimits,
    eligibility: { ...base.eligibility, ...override.eligibility },
    pricing: { ...base.pricing, ...override.pricing },
    fees: { ...base.fees, ...override.fees },
  };
}

/**
 * `program_name` key → per-category defaults. Keys come from the
 * `program_name_enumeration` migration. The name itself is category-agnostic —
 * the categories listed per key are simply the ones with meaningful defaults.
 */
const CATALOG: Record<string, Record<string, CatalogDefaults>> = {
  // --- personal ------------------------------------------------------------
  doctor: {
    personal: extend(PERSONAL_BASE, {
      tenor: { maxMonths: 84 },
      loanLimits: egp('50000.00', '2000000.00'),
      eligibility: { minMonthlyIncomeEGP: '15000.00' },
      pricing: { baseRatePercent: '23.5000' },
      requiredDocuments: SELF_EMPLOYED_DOCS,
    }),
    car: {
      tenor: { minMonths: 12, maxMonths: 60 },
      loanLimits: egp('100000.00', '3000000.00'),
      eligibility: {
        ageMin: 21,
        ageMax: 60,
        minMonthlyIncomeEGP: '15000.00',
        dbrCapPercent: '50.0000',
        dbrBands: STANDARD_DBR_BANDS,
        skipDbrCheck: false,
        requiresCollateral: true,
      },
      pricing: { isVariableRate: false, baseRatePercent: '21.0000' },
      fees: { adminFeePercent: '1.0000', stampDutyPercent: '0.5000', lifeInsurancePercent: '0.4000' },
      requiredDocuments: SELF_EMPLOYED_DOCS,
    },
  },
  armed_forces: {
    personal: extend(PERSONAL_BASE, {
      tenor: { maxMonths: 84 },
      eligibility: { minMonthlyIncomeEGP: '6000.00', publicBankIncomePercent: '100.0000' },
      pricing: { baseRatePercent: '22.0000' },
    }),
  },
  police: {
    personal: extend(PERSONAL_BASE, {
      tenor: { maxMonths: 84 },
      eligibility: { minMonthlyIncomeEGP: '6000.00', publicBankIncomePercent: '100.0000' },
      pricing: { baseRatePercent: '22.0000' },
    }),
  },
  pensioner: {
    personal: extend(PERSONAL_BASE, {
      tenor: { maxMonths: 36 },
      loanLimits: egp('10000.00', '300000.00'),
      eligibility: { ageMin: 50, ageMax: 70, minMonthlyIncomeEGP: '4000.00' },
      pricing: { baseRatePercent: '27.0000' },
      requiredDocuments: ['national_id', 'bank_statement'],
    }),
  },
  youth: {
    personal: extend(PERSONAL_BASE, {
      tenor: { maxMonths: 48 },
      loanLimits: egp('10000.00', '250000.00'),
      eligibility: { ageMin: 21, ageMax: 35, minMonthlyIncomeEGP: '6000.00' },
      pricing: { baseRatePercent: '25.0000' },
    }),
  },
  bankers: {
    personal: extend(PERSONAL_BASE, {
      tenor: { maxMonths: 84 },
      loanLimits: egp('50000.00', '1500000.00'),
      eligibility: {
        minMonthlyIncomeEGP: '12000.00',
        // FR-015b: the two bank-staff percentages drive recognised income.
        commercialBankIncomePercent: '90.0000',
        publicBankIncomePercent: '100.0000',
      },
      pricing: { baseRatePercent: '23.0000' },
    }),
  },
  govt_employee: {
    personal: extend(PERSONAL_BASE, {
      eligibility: { minMonthlyIncomeEGP: '5000.00', publicBankIncomePercent: '100.0000' },
      pricing: { baseRatePercent: '24.0000' },
    }),
  },
  private_sector: {
    personal: extend(PERSONAL_BASE, {
      eligibility: { minMonthlyIncomeEGP: '8000.00' },
      pricing: { baseRatePercent: '26.0000' },
    }),
  },
  professional: {
    personal: extend(PERSONAL_BASE, {
      tenor: { maxMonths: 72 },
      eligibility: { minMonthlyIncomeEGP: '12000.00' },
      pricing: { baseRatePercent: '25.0000' },
      requiredDocuments: SELF_EMPLOYED_DOCS,
    }),
  },
  pharmacy: {
    personal: extend(PERSONAL_BASE, {
      eligibility: { minMonthlyIncomeEGP: '12000.00' },
      pricing: { baseRatePercent: '25.0000' },
      requiredDocuments: SELF_EMPLOYED_DOCS,
    }),
    car: {
      tenor: { minMonths: 12, maxMonths: 60 },
      loanLimits: egp('100000.00', '2000000.00'),
      eligibility: {
        ageMin: 21,
        ageMax: 60,
        minMonthlyIncomeEGP: '12000.00',
        dbrCapPercent: '50.0000',
        dbrBands: STANDARD_DBR_BANDS,
        skipDbrCheck: false,
        requiresCollateral: true,
      },
      pricing: { isVariableRate: false, baseRatePercent: '22.0000' },
      fees: { adminFeePercent: '1.0000', stampDutyPercent: '0.5000', lifeInsurancePercent: '0.4000' },
      requiredDocuments: SELF_EMPLOYED_DOCS,
    },
    business: {
      tenor: { minMonths: 12, maxMonths: 60 },
      loanLimits: egp('100000.00', '5000000.00'),
      eligibility: {
        ageMin: 25,
        ageMax: 65,
        minMonthlyIncomeEGP: '25000.00',
        dbrCapPercent: '50.0000',
        skipDbrCheck: false,
        requiresCollateral: true,
      },
      pricing: { isVariableRate: true, currentEffectiveRatePercent: '24.0000' },
      fees: { adminFeePercent: '1.5000', stampDutyPercent: '0.5000', lifeInsurancePercent: '0.5000' },
      requiredDocuments: SELF_EMPLOYED_DOCS,
    },
  },

  // --- car -----------------------------------------------------------------
  new_car: {
    car: {
      tenor: { minMonths: 12, maxMonths: 84 },
      loanLimits: egp('100000.00', '3000000.00'),
      eligibility: {
        ageMin: 21,
        ageMax: 60,
        minMonthlyIncomeEGP: '10000.00',
        dbrCapPercent: '50.0000',
        dbrBands: STANDARD_DBR_BANDS,
        skipDbrCheck: false,
        requiresCollateral: true,
      },
      pricing: { isVariableRate: false, baseRatePercent: '21.0000' },
      fees: { adminFeePercent: '1.0000', stampDutyPercent: '0.5000', lifeInsurancePercent: '0.4000' },
      requiredDocuments: SALARIED_DOCS,
    },
  },
  used_car: {
    car: {
      tenor: { minMonths: 12, maxMonths: 60 },
      loanLimits: egp('75000.00', '1500000.00'),
      eligibility: {
        ageMin: 21,
        ageMax: 60,
        minMonthlyIncomeEGP: '10000.00',
        dbrCapPercent: '50.0000',
        dbrBands: STANDARD_DBR_BANDS,
        skipDbrCheck: false,
        requiresCollateral: true,
      },
      pricing: { isVariableRate: false, baseRatePercent: '23.5000' },
      fees: { adminFeePercent: '1.0000', stampDutyPercent: '0.5000', lifeInsurancePercent: '0.4000' },
      requiredDocuments: SALARIED_DOCS,
    },
  },

  // --- mortgage ------------------------------------------------------------
  home_purchase: {
    mortgage: {
      tenor: { minMonths: 60, maxMonths: 240 },
      loanLimits: egp('300000.00', '10000000.00'),
      eligibility: {
        ageMin: 25,
        ageMax: 65,
        minMonthlyIncomeEGP: '20000.00',
        dbrCapPercent: '45.0000',
        dbrBands: STANDARD_DBR_BANDS,
        skipDbrCheck: false,
        requiresCollateral: true,
      },
      pricing: { isVariableRate: true, currentEffectiveRatePercent: '22.0000' },
      fees: { adminFeePercent: '1.5000', stampDutyPercent: '0.5000', lifeInsurancePercent: '0.6000' },
      requiredDocuments: [...SALARIED_DOCS, 'property_deed'],
    },
  },
  home_finishing: {
    mortgage: {
      tenor: { minMonths: 24, maxMonths: 120 },
      loanLimits: egp('100000.00', '2000000.00'),
      eligibility: {
        ageMin: 25,
        ageMax: 65,
        minMonthlyIncomeEGP: '15000.00',
        dbrCapPercent: '45.0000',
        dbrBands: STANDARD_DBR_BANDS,
        skipDbrCheck: false,
        requiresCollateral: true,
      },
      pricing: { isVariableRate: true, currentEffectiveRatePercent: '23.0000' },
      fees: { adminFeePercent: '1.5000', stampDutyPercent: '0.5000', lifeInsurancePercent: '0.6000' },
      requiredDocuments: [...SALARIED_DOCS, 'property_deed'],
    },
  },

  // --- business ------------------------------------------------------------
  working_capital: {
    business: {
      tenor: { minMonths: 6, maxMonths: 36 },
      loanLimits: egp('100000.00', '5000000.00'),
      eligibility: {
        ageMin: 25,
        ageMax: 65,
        minMonthlyIncomeEGP: '30000.00',
        dbrCapPercent: '50.0000',
        skipDbrCheck: false,
        requiresCollateral: false,
      },
      pricing: { isVariableRate: true, currentEffectiveRatePercent: '25.0000' },
      fees: { adminFeePercent: '1.5000', stampDutyPercent: '0.5000', lifeInsurancePercent: '0.5000' },
      requiredDocuments: SELF_EMPLOYED_DOCS,
    },
  },
  equipment_finance: {
    business: {
      tenor: { minMonths: 12, maxMonths: 60 },
      loanLimits: egp('200000.00', '10000000.00'),
      eligibility: {
        ageMin: 25,
        ageMax: 65,
        minMonthlyIncomeEGP: '40000.00',
        dbrCapPercent: '50.0000',
        skipDbrCheck: false,
        requiresCollateral: true,
      },
      pricing: { isVariableRate: true, currentEffectiveRatePercent: '23.5000' },
      fees: { adminFeePercent: '1.5000', stampDutyPercent: '0.5000', lifeInsurancePercent: '0.5000' },
      requiredDocuments: SELF_EMPLOYED_DOCS,
    },
  },
};

async function main(): Promise<void> {
  const force = process.argv.includes('--force');
  const members = await prisma.platformEnumeration.findMany({ where: { type: 'program_name' } });

  let written = 0;
  let skipped = 0;
  let missing = 0;

  for (const [key, byCategory] of Object.entries(CATALOG)) {
    const member = members.find((m) => m.key === key);
    if (!member) {
      console.warn(`  ! program_name '${key}' not in the registry — skipped`);
      missing++;
      continue;
    }

    const current = (member.defaults ?? {}) as Record<string, unknown>;
    if (Object.keys(current).length > 0 && !force) {
      console.log(`  = ${key}: already has defaults — left untouched (use --force to overwrite)`);
      skipped++;
      continue;
    }

    // Program names are category-agnostic: every category listed for the key is
    // reachable by prefill, so all of them are written as-is.
    const defaults: Record<string, CatalogDefaults> = { ...byCategory };
    if (Object.keys(defaults).length === 0) {
      skipped++;
      continue;
    }

    await prisma.platformEnumeration.update({
      where: { id: member.id },
      // Structured `CatalogDefaults` -> Prisma `InputJsonValue` boundary cast.
      data: { defaults: defaults as unknown as Prisma.InputJsonValue },
    });
    console.log(`  + ${key}: seeded ${Object.keys(defaults).join(', ')}`);
    written++;
  }

  console.log(
    `\nCatalog defaults: ${written} written, ${skipped} skipped, ${missing} missing from registry.`,
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
