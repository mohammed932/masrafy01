/**
 * One bank program per published sheet — the figures a bank types, as a bank types them.
 *
 * Pure data, like its sibling. Each entry cites the appendix it came from and lists the paths
 * that are estimates rather than published figures; the command writes those into the program's
 * own `valueSources` map, so the admin renders them as estimates instead of implying a bank
 * stated them.
 *
 * ─── The four programs with no calculation at all ─────────────────────────────
 *
 * Three of the eleven predefined products guess no income: each bank states the MAXIMUM it
 * lends against one answer and nothing else (spec §10.2 case 2 — "the three cases the template
 * layer cannot reach at all"). Those programs are `income_proof`: a real payslip, plus a cap
 * keyed by an answer. They are filed under an existing payslip name, because a cap-only product
 * cannot take a catalog name of its own (`SURROGATE_PRODUCT_CAP_ONLY`) and does not need one.
 *
 * ─── Debt burden ─────────────────────────────────────────────────────────────
 *
 * Every sheet in the source material states a flat 50%, so these programs carry
 * `dbrCapPercent` and NO `dbrBands`. That is a decision, not an omission: a banded table
 * overrides the flat cap, so inventing bands would move every figure the sheets publish —
 * a Major's 30,000 assumed income would stop implying the 15,000 capacity §13.5 asserts.
 */

import { PRODUCT_RULE_STRATEGY } from '@/matching/types';
import type { CreateBankProgramDto } from '../dto/create-bank-program.dto';
import type { EstimatedPaths } from './sheet-figures';
import { ABK_PRACTICE_EDGES, DOWN_PAYMENT_EDGES } from './sheet-figures';

export interface ProgramSpec {
  /**
   * The code, non-optional here.
   *
   * `CreateBankProgramDto.programCode` is optional — the service GENERATES one when a body
   * omits it (A33: codes are never hand-typed by an operator). This seed always states its
   * own, because the code is how a re-run finds the row it wrote last time, so the spec
   * carries it as a required field rather than reading it back off an optional one.
   */
  programCode: string;
  /** Where the numbers came from. Printed, and written into `operatorNotes`. */
  sheet: string;
  dto: CreateBankProgramDto;
  estimated: EstimatedPaths;
}

const ABK = 'ABK Egypt';
const EGB = 'EG Bank';
const FAB = 'FABMISR';
const CAE = 'Crédit Agricole Egypt';
const SCB = 'Suez Canal Bank';

/** Nothing extra is required of the applicant unless a sheet says so. */
const NO_REQUIREMENTS = {
  requiresCD: false,
  requiresAutoLoanAtABK: false,
  requiresAutoLoanAtOtherBank: false,
  requiresCreditCardAtOtherBank: false,
  requiresCompoundProperty: false,
  requiresCollateral: false,
  requiresClubMembership: false,
  requiresExistingLoan: false,
  requiresFRMUVerification: false,
  requiresQualitativeReview: false,
  requiresNoDocuments: false,
};

const ALL_EMPLOYMENT = [
  'salaried',
  'self_employed',
  'government_employee',
  'private_employee',
  'business_owner',
  'freelancer',
  'retired',
];

const SALARIED_ONLY = ['salaried', 'government_employee', 'private_employee'];
const SELF_EMPLOYED_ONLY = ['self_employed', 'business_owner', 'freelancer'];

/**
 * A no-payslip program consults no salary transfer, so it accepts the "none" arrangement.
 * A payslip program accepts every arrangement the registry lists.
 */
const NO_TRANSFER = ['none'];
const ANY_TRANSFER = ['payroll', 'salary_transfer_letter', 'income_transfer_letter', 'none'];

interface MaxLoanRow {
  rowKey?: string;
  fromInclusive?: string;
  toExclusive?: string | null;
  columnKey?: string;
  maxAmountEGP: string;
}

interface MaxLoanTable {
  factKey: string;
  columnFactKey?: string;
  rowVia?: 'answer' | 'parentClass';
  columnVia?: 'answer' | 'parentClass';
  rows: MaxLoanRow[];
  onNoMatch: 'useProgramMax' | 'reject';
}

interface Input {
  programCode: string;
  bankName: string;
  friendlyName: string;
  friendlyNameAr: string;
  programNameKey: string;
  programType: 'income_proof' | 'income_surrogate';
  sheet: string;
  notes: string[];
  tips?: string[];
  tenor: {
    minMonths: number;
    maxMonths: number;
    maxMonthsByEmploymentType?: Record<string, number>;
  };
  minAmountEGP: string;
  maxAmountEGP: string;
  ratePercent: string;
  adminFeePercent: string;
  /** The "+2% if admin fees and stamp duty are waived, tenors 3 years and above" line. */
  feeWaiverPenalty?: boolean;
  ageMin?: number;
  ageMax?: number;
  ageMinSelfEmployed?: number;
  ageMaxSelfEmployed?: number;
  minMonthlyIncomeEGP?: string;
  minMonthlyIncomeSelfEmployedEGP?: string;
  minMonthsInJob?: number;
  acceptedEmploymentTypes?: string[];
  dbrCapPercent?: string;
  dbrCapPercentByEmploymentType?: Record<string, string>;
  minimumCreditCardHoldingMonths?: number;
  competitorCardMustBeUnsecured?: boolean;
  requires?: Partial<typeof NO_REQUIREMENTS>;
  requiredDocuments?: string[];
  /** Defaults to `personal` — the ten ABK sheets and their three competitors are all personal. */
  productCategory?: 'personal' | 'car' | 'mortgage' | 'business';
  /** The share of the asset's price this program finances — 40% against a 60% down payment. */
  ltvCeilingPercent?: string;
  /** The bank's own figures, keyed by slot id. Absent on a program with no calculation. */
  stepParams?: Record<string, unknown>;
  /**
   * Which of the product's ways this program sells, as the way's slot id.
   *
   * Stated on EVERY surrogate program under a product, or the save is refused
   * `PROGRAM_INCOME_WAY_REQUIRED` and this seed stops at the first such program — this seed runs
   * the full save path. A single-way product's one way is `primary`; the auto cross-sell's two
   * terms are ONE way (`waysAre: 'combined'`) also named `primary`, with both boxes still
   * filled; only the compound guarantee offers a choice. `sheet-figures-plan.spec.ts` pins
   * every entry here to `waysOfRule(compileTemplate(blueprint))[0].id`, so this literal and the
   * migration's backfill cannot drift apart.
   */
  wayId?: string;
  maxLoanByFact?: MaxLoanTable;
  maxLoanAdjustments?: Array<{
    kind: 'upliftPercent' | 'sharePercent';
    percent: string;
    whenFactKey: string;
    whenOptionCode: string;
  }>;
  additionalIncome?: {
    sources: Array<{ factKey: string; percent: string }>;
    capPercentOfBasic?: string;
  };
  estimated?: EstimatedPaths;
}

/**
 * One program.
 *
 * The defaults are the four Egyptian sheets' common terms — stamp duty 0.50%, life insurance
 * 0.50% and optional, late payment 4%, pay-off 12% cash / 15% buy-out. Only ABK prints them;
 * for the other three banks they are estimates and are marked as such by every caller that
 * does not override them.
 */
function program(input: Input): ProgramSpec {
  const surrogate = input.programType === 'income_surrogate';
  const dto: CreateBankProgramDto = {
    programCode: input.programCode,
    bankName: input.bankName,
    friendlyName: input.friendlyName,
    friendlyNameAr: input.friendlyNameAr,
    programNameKey: input.programNameKey,
    programType: input.programType,
    productCategory: input.productCategory ?? 'personal',
    isShariaCompliant: false,
    operatorNotes: [`Figures transcribed from ${input.sheet}.`, ...input.notes].join('\n'),
    ...(input.tips ? { operatorTips: input.tips } : {}),
    requiredDocuments: input.requiredDocuments ?? ['national_id', 'utility_bill'],
    tenor: input.tenor,
    loanLimits: {
      minAmountEGP: input.minAmountEGP,
      maxAmountEGP: input.maxAmountEGP,
      ...(input.ltvCeilingPercent ? { ltvCeilingPercent: input.ltvCeilingPercent } : {}),
      ...(input.maxLoanByFact ? { maxLoanByFact: input.maxLoanByFact } : {}),
      ...(input.maxLoanAdjustments ? { maxLoanAdjustments: input.maxLoanAdjustments } : {}),
    },
    pricing: {
      isVariableRate: false,
      baseRatePercent: input.ratePercent,
      // Every sheet that states a basis states declining; the ten ABK sheets state none, and
      // `reducing` is what every program stored on this platform was priced at. Recorded in
      // the notes rather than marked an estimate, because the field is not numeric and
      // `valueSources` addresses numbers.
      rateBasis: 'reducing',
      // Accepting the "no salary transfer" arrangement is refused unless it is either backed
      // by collateral or PRICED explicitly (`NONE_TRANSFER_UNSAFE`) — an applicant with no
      // transfer is the higher-risk case, and every one of these programs is sold to exactly
      // that applicant. So the sheet's own rate is stated for it: the figure is the same, and
      // the platform can see it was a decision rather than an oversight.
      rateByTransferType: { none: { value: input.ratePercent } },
      ...(input.feeWaiverPenalty
        ? { feeWaiverPenaltyRatePercent: '2', feeWaiverPenaltyMinTenorMonths: 36 }
        : {}),
    },
    eligibility: {
      acceptedEmploymentTypes: input.acceptedEmploymentTypes ?? ALL_EMPLOYMENT,
      ageMin: input.ageMin ?? 21,
      ageMax: input.ageMax ?? 60,
      ...(input.ageMinSelfEmployed !== undefined
        ? { ageMinSelfEmployed: input.ageMinSelfEmployed }
        : {}),
      ...(input.ageMaxSelfEmployed !== undefined
        ? { ageMaxSelfEmployed: input.ageMaxSelfEmployed }
        : {}),
      // Zero, and it is the honest figure: the whole point of a no-payslip program is that the
      // bank imputes the income, so it states no floor on a salary the applicant never declares.
      minMonthlyIncomeEGP: input.minMonthlyIncomeEGP ?? (surrogate ? '0' : '6000'),
      ...(input.minMonthlyIncomeSelfEmployedEGP !== undefined
        ? { minMonthlyIncomeSelfEmployedEGP: input.minMonthlyIncomeSelfEmployedEGP }
        : {}),
      minMonthsInJob: input.minMonthsInJob ?? 0,
      dbrCapPercent: input.dbrCapPercent ?? '50',
      ...(input.dbrCapPercentByEmploymentType
        ? { dbrCapPercentByEmploymentType: input.dbrCapPercentByEmploymentType }
        : {}),
      skipDbrCheck: false,
      acceptedTransferTypes: surrogate ? NO_TRANSFER : ANY_TRANSFER,
      ...NO_REQUIREMENTS,
      ...(input.requires ?? {}),
      ...(input.minimumCreditCardHoldingMonths !== undefined
        ? { minimumCreditCardHoldingMonths: input.minimumCreditCardHoldingMonths }
        : {}),
      ...(input.competitorCardMustBeUnsecured !== undefined
        ? { competitorCardMustBeUnsecured: input.competitorCardMustBeUnsecured }
        : {}),
    },
    performanceCriteria: {
      requiredMOBMonths: 0,
      iScoreMOBPerformanceCheck: false,
      requireCurrentLoanStatus: false,
    },
    // Cast, and the DTO's own header says why: `strategy` is validated by `@Matches`
    // because the legal set is not knowable at compile time — a product rule's token is
    // `steps` and a registry fact's is `fact:<key>`, neither of which is in the built-in
    // union the TYPE names. The runtime contract is the pattern, not the union.
    incomeAssumption: (surrogate
      ? {
          strategy: PRODUCT_RULE_STRATEGY,
          amounts: 'own',
          ...(input.wayId !== undefined ? { wayId: input.wayId } : {}),
          stepParams: input.stepParams ?? {},
          ...(input.additionalIncome ? { additionalIncome: input.additionalIncome } : {}),
        }
      : { strategy: 'declared' }) as CreateBankProgramDto['incomeAssumption'],
    fees: {
      adminFeePercent: input.adminFeePercent,
      stampDutyPercent: '0.5',
      lifeInsurancePercent: '0.5',
      lifeInsuranceMandatory: false,
      latePaymentFeePercent: '4',
      payoffCashPercent: '12',
      payoffBuyoutPercent: '15',
    },
  };
  return {
    programCode: input.programCode,
    sheet: input.sheet,
    dto,
    estimated: input.estimated ?? [],
  };
}

/** The four common fee figures, which only the ABK sheets print. */
const ESTIMATED_FEES = [
  'fees.stampDutyPercent',
  'fees.lifeInsurancePercent',
  'fees.latePaymentFeePercent',
  'fees.payoffCashPercent',
  'fees.payoffBuyoutPercent',
];

const money = (key: string, incomeEGP: string) => ({ key, incomeEGP });

/** App. A §10 — one figure per rank, read for a government and a private university alike. */
const ABK_PROFESSOR_RANKS = [
  money('dean', '100000'),
  money('professor_section_head', '75000'),
  money('professor', '50000'),
  money('assistant_professor', '40000'),
  money('lecturer', '30000'),
  money('assistant_teacher', '20000'),
  money('junior_staff', '12000'),
];
const percent = (value: string) => ({ scalar: { value, unit: 'percent' as const } });
const times = (value: string) => ({ scalar: { value, unit: 'multiplier' as const } });
/**
 * The number a savings sheet divides by — "36 months of saving, at 10% of income" is 3.6.
 *
 * `unit: 'multiplier'` because the union has two members and this is the one that means "a
 * plain number, not a percentage"; the unit is inert at runtime and the `divide` op is what
 * says the arithmetic (see `product-rule.ts`).
 */
const divisor = (value: string) => ({ scalar: { value, unit: 'multiplier' as const } });

function banded(
  edges: ReadonlyArray<{ fromInclusive: string; toExclusive: string | null }>,
  amounts: readonly string[],
): { bands: Array<{ fromInclusive: string; toExclusive: string | null; incomeEGP: string }> } {
  return {
    bands: edges.map((edge, index) => {
      const incomeEGP = amounts[index];
      if (incomeEGP === undefined) throw new Error(`sheet-programs: band ${index} has no figure`);
      return { fromInclusive: edge.fromInclusive, toExclusive: edge.toExclusive, incomeEGP };
    }),
  };
}

/**
 * Suez Canal's own divisors: "36 months of saving, and the saving is 10% of income" is 3.6,
 * and the cash buyer's "60 months at 20%" is 12. The sheet prints the first one as
 * `income = down payment ÷ 3.6`, so these are transcriptions, not derivations.
 */
const SCB_DP_DIVISOR = '3.6';
const SCB_CASH_DIVISOR = '12';

/** No slide states a rate, a fee or a basis. Placeholders, and every one is marked below. */
const SCB_RATE = '24';
const SCB_ADMIN_FEE = '1';
const SCB_ESTIMATED: EstimatedPaths = [
  'pricing.baseRatePercent',
  'pricing.rateByTransferType.none.value',
  ...ESTIMATED_FEES,
];

/** App. §4.5 pre-approval, less the two the platform has no key for (application form, BOD declaration). */
const SCB_DP_DOCUMENTS = ['national_id', 'price_quotation', 'down_payment_receipt'];
/** App. §5.4 — the ownership contract is what proves the unit, the invoice what proves the goods. */
const SCB_GREEN_DOCUMENTS = [
  'national_id',
  'home_ownership_contract',
  'proforma_invoice',
  'price_quotation',
];

export const SHEET_PROGRAMS: readonly ProgramSpec[] = [
  // -------------------------------------------------------------------------
  // ABK Egypt — Appendix A
  // -------------------------------------------------------------------------
  program({
    programCode: 'ABK-PER-ARMED_FORCES',
    bankName: ABK,
    friendlyName: 'Armed Forces',
    friendlyNameAr: 'القوات المسلحة',
    programNameKey: 'armed_forces_no_payslip',
    programType: 'income_surrogate',
    sheet: 'App. A §11 — Egyptian Armed Forces',
    notes: [
      'Rate basis is not stated on the sheet; priced on the reducing annuity, the platform default.',
      'The sheet also asks for a military ID and a copy bearing "original seen" — neither has a document key in the registry yet.',
    ],
    tenor: { minMonths: 6, maxMonths: 120 },
    minAmountEGP: '15000',
    maxAmountEGP: '500000',
    ratePercent: '25',
    adminFeePercent: '2',
    minMonthsInJob: 3,
    acceptedEmploymentTypes: SALARIED_ONLY,
    wayId: 'primary',
    stepParams: {
      primary: {
        keyTable: [
          money('grade_major_general', '75000'),
          money('grade_brigadier_general', '60000'),
          money('grade_colonel', '45000'),
          money('grade_lt_colonel', '40000'),
          money('grade_major', '30000'),
          money('grade_captain', '28000'),
          money('grade_first_lieutenant', '18000'),
          money('general', '40000'),
          money('senior_officer', '25000'),
          money('officer', '15000'),
        ],
      },
    },
    estimated: [
      'incomeAssumption.stepParams.primary.keyTable.general.incomeEGP',
      'incomeAssumption.stepParams.primary.keyTable.senior_officer.incomeEGP',
      'incomeAssumption.stepParams.primary.keyTable.officer.incomeEGP',
    ],
  }),

  program({
    programCode: 'ABK-PER-PROFESSORS',
    bankName: ABK,
    friendlyName: 'University Professors',
    friendlyNameAr: 'أساتذة الجامعات',
    programNameKey: 'university_professors',
    programType: 'income_surrogate',
    sheet: 'App. A §10 — University Professors',
    notes: [
      'This sheet publishes ONE figure per rank, whatever kind of university it is — so both columns carry the same figures rather than one being left blank. That is what the sheet says: a professor is priced at 50,000 at a government university and at a private one.',
      'Rate basis is not stated on the sheet; priced on the reducing annuity.',
    ],
    tenor: { minMonths: 6, maxMonths: 60 },
    minAmountEGP: '15000',
    maxAmountEGP: '500000',
    ratePercent: '25.5',
    adminFeePercent: '2.5',
    feeWaiverPenalty: true,
    acceptedEmploymentTypes: SALARIED_ONLY,
    requiredDocuments: ['national_id', 'utility_bill', 'hr_letter'],
    wayId: 'primary',
    stepParams: {
      primary: { keyTable: ABK_PROFESSOR_RANKS },
      // The same figures, deliberately repeated rather than left blank. Leaving the second
      // column empty works — `pickByFact` falls back to the first configured one — but it
      // reads on the grid as a column this bank has not got round to, and what the sheet
      // actually says is that the kind of university does not change the figure.
      primary__uni_private: { keyTable: ABK_PROFESSOR_RANKS },
    },
  }),

  program({
    programCode: 'ABK-PER-DOCTORS_CLINIC',
    bankName: ABK,
    friendlyName: 'Doctors — Clinic Owners',
    friendlyNameAr: 'الأطباء — أصحاب العيادات',
    // Its own catalog name since v25.0.0. The two doctor sheets used to file under one name
    // and were told apart by an ownership condition; now the applicant picks which of the two
    // programmes is theirs, and the name is what carries the product's calculation.
    programNameKey: 'doctors_clinic_owner',
    programType: 'income_surrogate',
    sheet: 'App. A §7 — Doctors (Clinic Owners)',
    notes: [
      'The sheet tiers cities as Cairo & Alexandria against everywhere else, so the same figures are filed against the secondary and other classes.',
      'Clinic location — a main area, a prime polyclinic with a weekly slot, or coded in Vezeeta — is a condition the platform has no list and no source data for.',
      'Rate basis is not stated on the sheet; priced on the reducing annuity.',
    ],
    tenor: { minMonths: 12, maxMonths: 120 },
    minAmountEGP: '15000',
    maxAmountEGP: '2000000',
    ratePercent: '26.5',
    adminFeePercent: '2.5',
    feeWaiverPenalty: true,
    ageMin: 32,
    ageMax: 65,
    minMonthsInJob: 36,
    acceptedEmploymentTypes: SELF_EMPLOYED_ONLY,
    requiredDocuments: [
      'national_id',
      'utility_bill',
      // App. A §7's own list. Registry rows seeded by `20260905090100_doctor_documents`;
      // without them `validateAgainstRegistry` refuses this whole programme (422), which is
      // why that migration has to be applied before this seed runs.
      'syndicate_card',
      'medical_facility_licence',
      'professional_practice_certificate',
    ],
    wayId: 'primary',
    stepParams: {
      // The same figures in all three tiers, deliberately repeated rather than left blank.
      // Leaving a column empty works — `pickByFact` falls back to the first configured one —
      // but it reads on the grid as a column this bank has not filled, and what the sheet
      // says is that Cairo and Alexandria pay what everywhere else pays. The city changes the
      // CAP below, not the income.
      primary: banded(ABK_PRACTICE_EDGES, [
        '30000',
        '60000',
        '80000',
        '120000',
        '180000',
        '300000',
      ]),
      primary__city_tier_secondary: banded(ABK_PRACTICE_EDGES, [
        '30000',
        '60000',
        '80000',
        '120000',
        '180000',
        '300000',
      ]),
      primary__city_tier_other: banded(ABK_PRACTICE_EDGES, [
        '30000',
        '60000',
        '80000',
        '120000',
        '180000',
        '300000',
      ]),
    },
    maxLoanByFact: {
      factKey: 'practice_governorate',
      columnFactKey: 'loan_is_topup',
      rowVia: 'parentClass',
      // `reject`, not `useProgramMax`, and the two halves are deliberate. The question is
      // REQUIRED, so on a current snapshot this branch is unreachable — but a required flag
      // is a promise about the LIVE question table, and an application submitted against an
      // older snapshot can still arrive with no answer. `useProgramMax` would then quote
      // 2,000,000, the top-up Cairo cell, to a doctor whose city nobody knows, and freeze it
      // onto an immutable offer. The programme stays listed with `NO_MAX_LOAN_FOR_ANSWER`
      // instead — a stated reason, which is what a 200-body refusal is for (A33).
      onNoMatch: 'reject',
      rows: [
        { rowKey: 'city_tier_major', columnKey: 'new_loan', maxAmountEGP: '1500000' },
        { rowKey: 'city_tier_major', columnKey: 'top_up', maxAmountEGP: '2000000' },
        { rowKey: 'city_tier_secondary', columnKey: 'new_loan', maxAmountEGP: '500000' },
        { rowKey: 'city_tier_secondary', columnKey: 'top_up', maxAmountEGP: '750000' },
        { rowKey: 'city_tier_other', columnKey: 'new_loan', maxAmountEGP: '500000' },
        { rowKey: 'city_tier_other', columnKey: 'top_up', maxAmountEGP: '750000' },
      ],
    },
  }),

  program({
    programCode: 'ABK-PER-DOCTORS_PRACTICE',
    bankName: ABK,
    friendlyName: 'Doctors — In Practice',
    friendlyNameAr: 'الأطباء — الممارسة',
    programNameKey: 'doctors_in_practice',
    programType: 'income_surrogate',
    sheet: 'App. A §8 — Doctors (In Practice)',
    notes: [
      'Private hospitals only, not governmental — an exclusion the platform has no field for.',
      'The weighted additional-income table is transcribed from the unattributed Arabic COMPOUND sheet (spec §10.11) because it is the only sheet in the source material that states one; ABK states none. Every percentage is marked an estimate — confirm with ABK before this program goes live.',
      'Rate basis is not stated on the sheet; priced on the reducing annuity.',
    ],
    tenor: { minMonths: 12, maxMonths: 120 },
    minAmountEGP: '15000',
    maxAmountEGP: '1000000',
    ratePercent: '30',
    adminFeePercent: '2.5',
    feeWaiverPenalty: true,
    minMonthsInJob: 36,
    // SALARIED, not self-employed: this sheet's doctor is EMPLOYED at a private hospital and
    // proves it with an employment letter — the clinic OWNER is §7. It read
    // `SELF_EMPLOYED_ONLY`, which is the opposite of what the sheet says. Not dead data even
    // though eligibility never filters: it rides the customer-facing programme payload.
    acceptedEmploymentTypes: SALARIED_ONLY,
    requiredDocuments: ['national_id', 'utility_bill', 'hr_letter'],
    wayId: 'primary',
    stepParams: {
      // ONE slot, because §8 prints one table. The merged product carried a city-tier column
      // this sheet does not use, so this programme held the identical figures in three slots
      // and read as pricing by city. Exactly half the clinic-owner figure at every band.
      primary: banded(ABK_PRACTICE_EDGES, ['15000', '30000', '40000', '60000', '90000', '150000']),
    },
    additionalIncome: {
      sources: [
        { factKey: 'rental_income_monthly', percent: '50' },
        { factKey: 'cd_returns_monthly', percent: '75' },
        { factKey: 'fixed_allowances_monthly', percent: '100' },
        { factKey: 'variable_allowances_monthly', percent: '75' },
      ],
      capPercentOfBasic: '100',
    },
    estimated: [
      'incomeAssumption.additionalIncome.sources.0.percent',
      'incomeAssumption.additionalIncome.sources.1.percent',
      'incomeAssumption.additionalIncome.sources.2.percent',
      'incomeAssumption.additionalIncome.sources.3.percent',
      'incomeAssumption.additionalIncome.capPercentOfBasic',
    ],
  }),

  program({
    programCode: 'ABK-PER-PL_TO_CARD',
    bankName: ABK,
    friendlyName: 'Personal Loan against a Credit Card',
    friendlyNameAr: 'تمويل شخصي مقابل بطاقة ائتمان',
    programNameKey: 'pl_to_card',
    programType: 'income_surrogate',
    sheet: 'App. A §6 — PL Cross Sell to Credit Card, Other Banks',
    notes: [
      'Multiple cards cannot be combined: the card with the highest limit that meets the holding period is the one read. The platform asks for one limit, so this is not enforced.',
      'Admin fee is waived at 28.5% and above subject to a minimum tenor of 3 years.',
      'Rate basis is not stated on the sheet; priced on the reducing annuity.',
    ],
    tenor: { minMonths: 6, maxMonths: 120, maxMonthsByEmploymentType: { self_employed: 84 } },
    minAmountEGP: '15000',
    maxAmountEGP: '750000',
    ratePercent: '28.5',
    adminFeePercent: '2.5',
    feeWaiverPenalty: true,
    ageMinSelfEmployed: 25,
    ageMaxSelfEmployed: 65,
    minimumCreditCardHoldingMonths: 6,
    competitorCardMustBeUnsecured: true,
    requires: { requiresCreditCardAtOtherBank: true },
    wayId: 'primary',
    stepParams: { primary: percent('50') },
  }),

  program({
    programCode: 'ABK-PER-CDS_HOLDER',
    bankName: ABK,
    friendlyName: 'Certificate & Deposit Holders',
    friendlyNameAr: 'حاملو الشهادات والودائع',
    programNameKey: 'cds_holder',
    programType: 'income_surrogate',
    sheet: 'App. A §3 — Liabilities Cross Sell (CDs Holder)',
    notes: [
      'The caps apply three months after issuance; before that the sheet states a maximum of 10% of the certificate, which is a second figure on one cap row and has no representation yet.',
      'The assumed income floor — the lesser of 50,000 and 10% of total deposits — is also unrepresentable; only the 30% share is configured.',
      'Rate basis is not stated on the sheet; priced on the reducing annuity.',
    ],
    tenor: { minMonths: 12, maxMonths: 84 },
    minAmountEGP: '15000',
    maxAmountEGP: '2000000',
    ratePercent: '24',
    adminFeePercent: '0',
    ageMinSelfEmployed: 25,
    ageMaxSelfEmployed: 65,
    requires: { requiresCD: true, requiresCollateral: true },
    requiredDocuments: ['national_id', 'utility_bill', 'bank_statement'],
    wayId: 'primary',
    stepParams: {
      primary: percent('30'),
      // Three months after issuance, which is when the sheet's cap table applies at all.
      cond__heldlongenough: { minValue: '3' },
    },
    maxLoanByFact: {
      factKey: 'pledged_free_amount',
      onNoMatch: 'useProgramMax',
      rows: [
        { fromInclusive: '0', toExclusive: '2000000', maxAmountEGP: '500000' },
        { fromInclusive: '2000000', toExclusive: '5000000', maxAmountEGP: '1000000' },
        { fromInclusive: '5000000', toExclusive: '10000000', maxAmountEGP: '1500000' },
        { fromInclusive: '10000000', toExclusive: null, maxAmountEGP: '2000000' },
      ],
    },
  }),

  program({
    programCode: 'ABK-PER-AUTO_XSELL_OTHER',
    bankName: ABK,
    friendlyName: 'Personal Loan against a Car Loan Elsewhere',
    friendlyNameAr: 'تمويل شخصي مقابل قرض سيارة في بنك آخر',
    programNameKey: 'pl_to_auto_loan',
    programType: 'income_surrogate',
    sheet: 'App. A §4 — PL Cross Sell to Auto Loan, Other Banks',
    notes: [
      'The sheet also requires the existing loan to be past half its tenor with at least 12 paid months, booked with 40% down, and the new instalment not to exceed 50% of the existing car instalment — the last is computed after the rule and is not expressible.',
      'Rate basis is not stated on the sheet; priced on the reducing annuity.',
    ],
    tenor: { minMonths: 12, maxMonths: 84 },
    minAmountEGP: '15000',
    maxAmountEGP: '400000',
    ratePercent: '26.5',
    adminFeePercent: '2.5',
    feeWaiverPenalty: true,
    requires: { requiresAutoLoanAtOtherBank: true, requiresExistingLoan: true },
    wayId: 'primary',
    stepParams: { primary: times('3'), alt: percent('10') },
  }),

  program({
    programCode: 'ABK-PER-AUTO_XSELL_ABK',
    bankName: ABK,
    friendlyName: 'Personal Loan against a Car Loan at ABK',
    friendlyNameAr: 'تمويل شخصي مقابل قرض سيارة في البنك',
    programNameKey: 'pl_to_auto_loan',
    programType: 'income_surrogate',
    sheet: 'App. A §5 — PL Cross Sell to Auto Loan at ABK',
    notes: [
      'The sheet sizes this off the original auto-loan program and keeps its MCE and tenor on a cross-sell; the platform prices it as its own program, so the figures below are the §4 mechanism against this sheet’s own ceiling.',
      'Rate basis is not stated on the sheet; priced on the reducing annuity.',
    ],
    tenor: { minMonths: 12, maxMonths: 84 },
    minAmountEGP: '15000',
    maxAmountEGP: '750000',
    ratePercent: '26.5',
    adminFeePercent: '2.5',
    feeWaiverPenalty: true,
    requires: { requiresAutoLoanAtABK: true, requiresExistingLoan: true },
    wayId: 'primary',
    stepParams: { primary: times('3'), alt: percent('10') },
    estimated: ['incomeAssumption.stepParams.alt.scalar.value'],
  }),

  program({
    programCode: 'ABK-PER-COMPOUND_OWNER',
    bankName: ABK,
    friendlyName: 'Compound Owner',
    friendlyNameAr: 'مالك وحدة في كومباوند',
    programNameKey: 'compound_owner_4',
    programType: 'income_surrogate',
    sheet: 'App. A §2 — Compound Owner',
    notes: [
      'The 18-month rule is waived for fully settled or cash units, where ownership must be at least 6 months — a conditional waiver the gate cannot express, so the 18-month floor applies to everyone.',
      'Applicants owning apartments in high-end compounds take the VILLA cap row. That is a row swap the cap table cannot express; the apartment row is what is configured.',
      'Rate basis is not stated on the sheet; priced on the reducing annuity.',
    ],
    tenor: { minMonths: 12, maxMonths: 84 },
    minAmountEGP: '15000',
    maxAmountEGP: '4500000',
    ratePercent: '25.5',
    adminFeePercent: '2.5',
    feeWaiverPenalty: true,
    ageMinSelfEmployed: 25,
    ageMaxSelfEmployed: 65,
    requires: { requiresCompoundProperty: true, requiresFRMUVerification: true },
    requiredDocuments: ['national_id', 'utility_bill', 'property_deed'],
    wayId: 'alt__unit_paid_to_date',
    stepParams: {
      // 15% of the down payment plus the instalments honoured to date — everything paid, so
      // the share reads `unit_paid_to_date` and not the down payment on its own.
      alt__unit_paid_to_date: percent('15'),
      // Property purchase date not less than 18 months.
      cond__ownedlongenough: { minValue: '18' },
    },
    maxLoanByFact: {
      factKey: 'owned_unit_type',
      columnFactKey: 'loan_is_topup',
      onNoMatch: 'useProgramMax',
      rows: [
        { rowKey: 'apartment', columnKey: 'new_loan', maxAmountEGP: '2000000' },
        { rowKey: 'apartment', columnKey: 'top_up', maxAmountEGP: '3000000' },
        { rowKey: 'twin_or_town_house', columnKey: 'new_loan', maxAmountEGP: '3000000' },
        { rowKey: 'twin_or_town_house', columnKey: 'top_up', maxAmountEGP: '3500000' },
        { rowKey: 'villa', columnKey: 'new_loan', maxAmountEGP: '4000000' },
        { rowKey: 'villa', columnKey: 'top_up', maxAmountEGP: '4500000' },
      ],
    },
    // "Program loan amounts can be increased by 10% in case applicants provide more than one
    // residential unit" — loan AMOUNTS, so it lifts the cap and not the imputed ceiling (§10.4).
    maxLoanAdjustments: [
      {
        kind: 'upliftPercent',
        percent: '10',
        whenFactKey: 'unit_count_owned',
        whenOptionCode: 'unit_more_than_one',
      },
    ],
  }),

  // -------------------------------------------------------------------------
  // EG Bank — Appendix B
  // -------------------------------------------------------------------------
  program({
    programCode: 'EGB-PER-COMPOUND_OWNER',
    bankName: EGB,
    friendlyName: 'Compound Owner',
    friendlyNameAr: 'مالك وحدة في كومباوند',
    programNameKey: 'compound_owner_4',
    programType: 'income_surrogate',
    sheet: 'App. B — EG Bank compound owner (categories AA–C)',
    notes: [
      'Minimum unit price varies by contract year (2024+ 3M · 2023 2.5M · 2022 2M · 2021 1.5M · before 2021 1M). One bound is configurable, so the earliest floor is applied and the rest are policy the operator must read here.',
      'Minimum paid share varies by unit price (20% at 15M and above · 30% at 10M and above · 40% otherwise). The 40% case is configured.',
      'Rate and fees are not stated on the sheet.',
    ],
    tenor: { minMonths: 6, maxMonths: 84 },
    minAmountEGP: '100000',
    maxAmountEGP: '6000000',
    ratePercent: '25',
    adminFeePercent: '2.5',
    minMonthlyIncomeEGP: '10000',
    minMonthlyIncomeSelfEmployedEGP: '25000',
    requires: { requiresCompoundProperty: true },
    requiredDocuments: ['national_id', 'utility_bill', 'property_deed'],
    wayId: 'primary',
    stepParams: {
      primary: {
        keyTable: [
          money('compound_tier_aa', '6000000'),
          money('compound_tier_ab', '5000000'),
          money('compound_tier_a', '4000000'),
          money('compound_tier_b', '3000000'),
          money('compound_tier_c', '2000000'),
          money('compound_tier_other', '2000000'),
        ],
      },
      cond__unitworthenough: { minValue: '1000000' },
      cond__paidenough__bound: percent('40'),
    },
    estimated: [
      'pricing.baseRatePercent',
      'fees.adminFeePercent',
      ...ESTIMATED_FEES,
      'incomeAssumption.stepParams.primary.keyTable.compound_tier_other.incomeEGP',
    ],
  }),

  program({
    programCode: 'EGB-PER-PL_TO_CARD',
    bankName: EGB,
    friendlyName: 'Personal Loan against a Credit Card',
    friendlyNameAr: 'تمويل شخصي مقابل بطاقة ائتمان',
    programNameKey: 'private_sector',
    programType: 'income_proof',
    sheet: 'App. B — EG Bank PL to card (a ceiling by card limit)',
    notes: [
      'This sheet states a ceiling by card limit and an income FLOOR as eligibility, not a share of the limit — so the program reads a real declared income and caps it by the answer.',
      'The self-employed column (500,000 / 750,000) is one figure per bracket lower than the salaried one. A cap table takes one column keyed by an answer, and employment is not one of this product’s asks, so the salaried figures are configured and the self-employed ones are policy the operator must read here.',
      'Maximum tenor was not legible on the source sheet; the program default applies.',
      'Rate and fees are not stated on the sheet.',
    ],
    tenor: { minMonths: 6, maxMonths: 84 },
    minAmountEGP: '25000',
    maxAmountEGP: '1000000',
    ratePercent: '25',
    adminFeePercent: '2.5',
    minMonthlyIncomeEGP: '10000',
    minMonthlyIncomeSelfEmployedEGP: '25000',
    minimumCreditCardHoldingMonths: 6,
    competitorCardMustBeUnsecured: true,
    requires: { requiresCreditCardAtOtherBank: true },
    maxLoanByFact: {
      factKey: 'credit_card_limit',
      onNoMatch: 'useProgramMax',
      rows: [
        { fromInclusive: '25000', toExclusive: '100000', maxAmountEGP: '750000' },
        { fromInclusive: '100000', toExclusive: null, maxAmountEGP: '1000000' },
      ],
    },
    estimated: ['pricing.baseRatePercent', 'fees.adminFeePercent', ...ESTIMATED_FEES],
  }),

  // -------------------------------------------------------------------------
  // FABMISR — Appendix B
  // -------------------------------------------------------------------------
  program({
    programCode: 'FAB-PER-COMPOUND_OWNER',
    bankName: FAB,
    friendlyName: 'Compound Owner',
    friendlyNameAr: 'مالك وحدة في كومباوند',
    programNameKey: 'compound_owner_4',
    programType: 'income_surrogate',
    sheet: 'App. B — FABMISR compound owner (down-payment brackets × NTB / X-SELL)',
    notes: [
      'The sheet’s second column is X-SELL — the client holds another product, a credit card with a limit of at least 100,000. This product’s second column is "new loan or top-up", which spec §10.3 is explicit is a DIFFERENT question. The X-SELL figures are filed in the second column so the grid is complete, and they are the sheet’s own numbers: 1,250,000 · 1,500,000 · 1,750,000 · 2,000,000. Read them as X-SELL, not as top-up, until the product carries a "holds another product" column.',
      'The brackets are keyed by the DOWN PAYMENT, which is the figure the sheet prints them against — not by everything paid to date, which is what two other banks on this product take their share of. Minimum down payment 250,000 is expressed by the first bracket starting there: a smaller down payment falls in no bracket and is answered with a stated reason.',
      'Jointly owned units are accepted at 50% of the imputed income and 50% of the loan amount.',
      'Two lines were not legible on the source photo and are deliberately not encoded: "Clear I-Score: 500K" and "Income will be derived according to down payment within 6 months".',
      'Rate and fees are not stated on the sheet.',
    ],
    tenor: { minMonths: 6, maxMonths: 72 },
    minAmountEGP: '100000',
    maxAmountEGP: '2000000',
    ratePercent: '25',
    adminFeePercent: '2.5',
    ageMin: 30,
    minMonthlyIncomeEGP: '10000',
    minMonthlyIncomeSelfEmployedEGP: '15000',
    requires: { requiresCompoundProperty: true, requiresFRMUVerification: true },
    requiredDocuments: ['national_id', 'utility_bill', 'property_deed'],
    // ONE way, two columns: `alt__top_up` is the second column of the `alt` bracket table,
    // not a way of its own. The way's id is the bare head — the first column keeps it.
    wayId: 'alt',
    stepParams: {
      alt: banded(DOWN_PAYMENT_EDGES, ['750000', '1000000', '1250000', '1500000']),
      alt__top_up: banded(DOWN_PAYMENT_EDGES, ['1250000', '1500000', '1750000', '2000000']),
    },
    estimated: ['pricing.baseRatePercent', 'fees.adminFeePercent', ...ESTIMATED_FEES],
  }),

  program({
    programCode: 'FAB-PER-CLUB_MEMBERSHIP',
    bankName: FAB,
    friendlyName: 'Club Membership',
    friendlyNameAr: 'عضوية النادي',
    programNameKey: 'private_sector',
    programType: 'income_proof',
    sheet: 'App. B — FABMISR Al Ahly club membership',
    notes: [
      'Two checks apply together and the lower wins: the branch ceiling below, and an ordinary debt-burden check against the customer’s real declared income.',
      'The sheet also prints a minimum down payment per branch (85,500 · 85,500 · 256,500). A cap row holds one figure, so those are policy the operator must read here.',
      'The debt-burden percentage is not shown on the sheet — 50% is an estimate.',
      'Credit card / Murabaha maximum limit 100,000.',
    ],
    tenor: { minMonths: 6, maxMonths: 72 },
    minAmountEGP: '20000',
    maxAmountEGP: '750000',
    ratePercent: '25',
    adminFeePercent: '2.5',
    ageMin: 25,
    minMonthsInJob: 3,
    requires: { requiresClubMembership: true },
    maxLoanByFact: {
      factKey: 'club_branch',
      onNoMatch: 'useProgramMax',
      rows: [
        { rowKey: 'branch_new_cairo', maxAmountEGP: '750000' },
        { rowKey: 'branch_sheikh_zayed', maxAmountEGP: '510000' },
        { rowKey: 'branch_main', maxAmountEGP: '160000' },
      ],
    },
    estimated: [
      'eligibility.dbrCapPercent',
      'pricing.baseRatePercent',
      'fees.adminFeePercent',
      ...ESTIMATED_FEES,
    ],
  }),

  // -------------------------------------------------------------------------
  // Crédit Agricole Egypt — Appendix B
  // -------------------------------------------------------------------------
  program({
    programCode: 'CAE-PER-COMPOUND_OWNER',
    bankName: CAE,
    friendlyName: 'Compound Owner',
    friendlyNameAr: 'مالك وحدة في كومباوند',
    programNameKey: 'compound_owner_4',
    programType: 'income_surrogate',
    sheet: 'App. B — Crédit Agricole compound owner (50% of the amount paid)',
    notes: [
      'One program, both employment types. The sheet prints two codes — Employed 0771 and Self-Employed 0772 — and the platform expresses the difference with the self-employed age and debt-burden fields rather than two rows.',
      'The self-employed conditions the platform has no field for: minimum 2 years in business, 100,000 paid-in capital, 6-month credit history, no scoring cut-off exceptions.',
      'Owning two units in different compounds still gives one loan; joint ownership needs dual approval and the maximum is shared across owners.',
      'Rate and fees are not stated on the sheet.',
    ],
    tenor: { minMonths: 6, maxMonths: 84 },
    minAmountEGP: '50000',
    maxAmountEGP: '3000000',
    ratePercent: '25',
    adminFeePercent: '2.5',
    ageMinSelfEmployed: 25,
    ageMaxSelfEmployed: 65,
    dbrCapPercentByEmploymentType: { salaried: '50', self_employed: '40' },
    requires: { requiresCompoundProperty: true },
    requiredDocuments: ['national_id', 'utility_bill', 'property_deed'],
    wayId: 'alt__unit_paid_to_date',
    stepParams: {
      // 50% of the amount paid to the developer — the total, as the sheet writes it.
      alt__unit_paid_to_date: percent('50'),
      // The sheet's "jointly owned accepted at 50%" is no longer a bank figure: the
      // applicant states the percentage of the unit they own and the rule scales by it, so
      // a half-owner reaches the same 50% and an owner of some other share is priced as
      // what they actually own rather than as a half.
    },
    estimated: ['pricing.baseRatePercent', 'fees.adminFeePercent', ...ESTIMATED_FEES],
  }),

  program({
    programCode: 'CAE-PER-TEACHERS_PREDEFINED',
    bankName: CAE,
    friendlyName: 'Teachers — Predefined Limit',
    friendlyNameAr: 'المعلمون — حد محدد مسبقًا',
    programNameKey: 'teachers_predefined',
    programType: 'income_surrogate',
    sheet: 'App. B — Crédit Agricole Teachers, Predefined Limit (0760-22 / 0760-23)',
    notes: [
      'The sheet waives the income check entirely. The engine still reduces the ceiling by the applicant’s existing debts, which is a stated assumption (spec §11 item 1) — a loan the customer cannot pay is not one to show.',
      'The predefined limit excludes certain subjects and school types (military, commercial, agriculture, hospitality, special needs) — an exclusion list the platform has no field for.',
      'Rate, tenor and the debt-burden percentage are not stated on the sheet.',
    ],
    tenor: { minMonths: 6, maxMonths: 84 },
    minAmountEGP: '50000',
    maxAmountEGP: '600000',
    ratePercent: '25',
    adminFeePercent: '2.5',
    acceptedEmploymentTypes: SALARIED_ONLY,
    requiredDocuments: ['national_id', 'utility_bill', 'hr_letter'],
    wayId: 'primary',
    stepParams: {
      primary: {
        keyTable: [
          money('stage_primary', '100000'),
          money('stage_preparatory', '200000'),
          money('stage_secondary', '300000'),
        ],
      },
      primary__school_international: {
        keyTable: [
          money('stage_primary', '200000'),
          money('stage_preparatory', '400000'),
          money('stage_secondary', '600000'),
        ],
      },
    },
    estimated: ['pricing.baseRatePercent', 'fees.adminFeePercent', ...ESTIMATED_FEES],
  }),

  program({
    programCode: 'CAE-PER-TEACHERS_STANDARD',
    bankName: CAE,
    friendlyName: 'Teachers — Standard',
    friendlyNameAr: 'المعلمون — البرنامج القياسي',
    programNameKey: 'private_sector',
    programType: 'income_proof',
    sheet: 'App. B — Crédit Agricole Teachers, standard (0759-17 / 0759-18)',
    notes: [
      'Two checks apply together and the lower wins: the school-type ceiling below, and a real income and debt-burden check "as per retail risk policy".',
      'That percentage is not printed on the sheet — 50% is an estimate, and until a bank gives the real one every figure this program quotes is provisional.',
      'International means an American diploma, an international Bachelor, or IGCSE following an international curriculum.',
      'Rate and fees are not stated on the sheet.',
    ],
    tenor: { minMonths: 6, maxMonths: 84 },
    minAmountEGP: '50000',
    maxAmountEGP: '750000',
    ratePercent: '25',
    adminFeePercent: '2.5',
    acceptedEmploymentTypes: SALARIED_ONLY,
    requiredDocuments: ['national_id', 'utility_bill', 'hr_letter'],
    maxLoanByFact: {
      factKey: 'school_type',
      onNoMatch: 'useProgramMax',
      rows: [
        { rowKey: 'school_national', maxAmountEGP: '500000' },
        { rowKey: 'school_international', maxAmountEGP: '750000' },
      ],
    },
    estimated: [
      'eligibility.dbrCapPercent',
      'pricing.baseRatePercent',
      'fees.adminFeePercent',
      ...ESTIMATED_FEES,
    ],
  }),

  // -------------------------------------------------------------------------
  // The company-coding cap — App. C SALARIED, the cap table only
  // -------------------------------------------------------------------------
  program({
    programCode: 'ABK-PER-SALARIED_CODING',
    bankName: ABK,
    friendlyName: 'Salaried — Company Coding',
    friendlyNameAr: 'أصحاب الرواتب — تصنيف جهة العمل',
    programNameKey: 'private_sector',
    programType: 'income_proof',
    sheet: 'App. C SALARIED — the maximum available by company coding',
    notes: [
      'Only the cap table is transcribed. The rest of that sheet belongs to a bank the source material does not identify (spec §10.8), so no rate, tenor or fee from it is used here and the terms below are this bank’s own personal-loan terms.',
      'A loan without salary transfer is available only for companies coded at the bank (A + B + C + D); the sheet prints figures for A, B and C.',
      'Rate and fees are not stated for this product.',
    ],
    tenor: { minMonths: 6, maxMonths: 108 },
    minAmountEGP: '15000',
    maxAmountEGP: '6000000',
    ratePercent: '25',
    adminFeePercent: '2.5',
    minMonthsInJob: 3,
    acceptedEmploymentTypes: SALARIED_ONLY,
    requiredDocuments: ['national_id', 'utility_bill', 'salary_certificate', 'bank_statement'],
    maxLoanByFact: {
      factKey: 'employer_coding',
      onNoMatch: 'useProgramMax',
      rows: [
        { rowKey: 'coding_cat_a', maxAmountEGP: '6000000' },
        { rowKey: 'coding_cat_b', maxAmountEGP: '1000000' },
        { rowKey: 'coding_cat_c', maxAmountEGP: '500000' },
      ],
    },
    estimated: ['pricing.baseRatePercent', 'fees.adminFeePercent'],
  }),

  // -------------------------------------------------------------------------
  // Suez Canal Bank — the unsecured auto programmes and Green Finance
  //
  // Seven programmes off two mechanisms. The five down-payment programmes are ONE product
  // sold five ways: the same `income = down payment ÷ 3.6`, and what separates them is the
  // share of the car's price the bank will finance (60% down → 40% financed) plus the
  // floors and the conditions each tier carries. Green Finance is the same arithmetic over
  // what the applicant has SAVED, with a second column for a cash buyer.
  //
  // No rate is published on any of these slides, so the rate and the admin fee below are the
  // team's placeholders and every one of them is marked an estimate.
  // -------------------------------------------------------------------------
  program({
    programCode: 'SCB-CAR-DP60',
    friendlyName: 'Auto Loan — 60% Down Payment',
    friendlyNameAr: 'قرض سيارة — مقدم 60%',
    programNameKey: 'auto_down_payment_income',
    sheet: 'App. §4 — Suez Canal unsecured auto, 60% down payment',
    notes: [
      'No car insurance and no ban on sale on this programme.',
      'The sheet requires 24 months in business for a self-employed applicant and a valid commercial register and tax card; the platform states one service floor per programme, so only the salaried 6 months is enforced.',
      'The home address must match the National ID and the I-Score, or the National ID and the driving licence; otherwise a utility bill no older than three months or an external verification is required. Not enforced — recorded here.',
      'The slides state no profit rate, no fee and no rate basis; the figures here are placeholders the team chose, marked as estimates, and are priced on the reducing annuity.',
    ],
    minAmountEGP: '100000',
    maxAmountEGP: '5000000',
    ltvCeilingPercent: '40',
    bankName: SCB,
    programType: 'income_surrogate',
    productCategory: 'car',
    tenor: { minMonths: 6, maxMonths: 84 },
    ratePercent: SCB_RATE,
    adminFeePercent: SCB_ADMIN_FEE,
    ageMin: 21,
    ageMax: 60,
    ageMinSelfEmployed: 25,
    ageMaxSelfEmployed: 65,
    minMonthlyIncomeEGP: '6000',
    minMonthlyIncomeSelfEmployedEGP: '15000',
    minMonthsInJob: 6,
    dbrCapPercent: '50',
    wayId: 'primary',
    stepParams: { primary: divisor(SCB_DP_DIVISOR) },
    requiredDocuments: SCB_DP_DOCUMENTS,
    estimated: SCB_ESTIMATED,
  }),
  program({
    programCode: 'SCB-CAR-DP50',
    friendlyName: 'Auto Loan — 50% Down Payment',
    friendlyNameAr: 'قرض سيارة — مقدم 50%',
    programNameKey: 'auto_down_payment_income',
    sheet: 'App. §4 — Suez Canal unsecured auto, 50% down payment',
    notes: [
      'Ban on sale until the loan is settled.',
      'The 12-month service requirement is waived when the I-Score shows regular repayment over the last six months. No field expresses a conditional waiver — recorded here.',
      'The sheet requires 24 months in business for a self-employed applicant and a valid commercial register and tax card; the platform states one service floor per programme, so only the salaried 6 months is enforced.',
      'The home address must match the National ID and the I-Score, or the National ID and the driving licence; otherwise a utility bill no older than three months or an external verification is required. Not enforced — recorded here.',
      'The slides state no profit rate, no fee and no rate basis; the figures here are placeholders the team chose, marked as estimates, and are priced on the reducing annuity.',
    ],
    minAmountEGP: '100000',
    maxAmountEGP: '5000000',
    ltvCeilingPercent: '50',
    bankName: SCB,
    programType: 'income_surrogate',
    productCategory: 'car',
    tenor: { minMonths: 6, maxMonths: 84 },
    ratePercent: SCB_RATE,
    adminFeePercent: SCB_ADMIN_FEE,
    ageMin: 21,
    ageMax: 60,
    ageMinSelfEmployed: 25,
    ageMaxSelfEmployed: 65,
    minMonthlyIncomeEGP: '6000',
    minMonthlyIncomeSelfEmployedEGP: '15000',
    minMonthsInJob: 6,
    dbrCapPercent: '50',
    wayId: 'primary',
    stepParams: { primary: divisor(SCB_DP_DIVISOR) },
    requiredDocuments: SCB_DP_DOCUMENTS,
    estimated: SCB_ESTIMATED,
  }),
  program({
    programCode: 'SCB-CAR-DP40',
    friendlyName: 'Auto Loan — 40% Down Payment',
    friendlyNameAr: 'قرض سيارة — مقدم 40%',
    programNameKey: 'auto_down_payment_income',
    sheet: 'App. §4 — Suez Canal unsecured auto, 40% down payment',
    notes: [
      'Ban on sale until the loan is settled.',
      'The 12-month service requirement is waived when the I-Score shows regular repayment over the last six months. No field expresses a conditional waiver — recorded here.',
      'The sheet requires 24 months in business for a self-employed applicant and a valid commercial register and tax card; the platform states one service floor per programme, so only the salaried 6 months is enforced.',
      'The home address must match the National ID and the I-Score, or the National ID and the driving licence; otherwise a utility bill no older than three months or an external verification is required. Not enforced — recorded here.',
      'The slides state no profit rate, no fee and no rate basis; the figures here are placeholders the team chose, marked as estimates, and are priced on the reducing annuity.',
    ],
    minAmountEGP: '100000',
    maxAmountEGP: '5000000',
    ltvCeilingPercent: '60',
    bankName: SCB,
    programType: 'income_surrogate',
    productCategory: 'car',
    tenor: { minMonths: 6, maxMonths: 84 },
    ratePercent: SCB_RATE,
    adminFeePercent: SCB_ADMIN_FEE,
    ageMin: 21,
    ageMax: 60,
    ageMinSelfEmployed: 25,
    ageMaxSelfEmployed: 65,
    minMonthlyIncomeEGP: '6000',
    minMonthlyIncomeSelfEmployedEGP: '15000',
    minMonthsInJob: 6,
    dbrCapPercent: '50',
    wayId: 'primary',
    stepParams: { primary: divisor(SCB_DP_DIVISOR) },
    requiredDocuments: SCB_DP_DOCUMENTS,
    estimated: SCB_ESTIMATED,
  }),
  program({
    programCode: 'SCB-CAR-DP30',
    friendlyName: 'Auto Loan — 30% Down Payment',
    friendlyNameAr: 'قرض سيارة — مقدم 30%',
    programNameKey: 'auto_down_payment_income',
    sheet: 'App. §4 — Suez Canal unsecured auto, 30% down payment',
    notes: [
      'Ban on sale until the loan is settled.',
      'The sheet requires 24 months in business for a self-employed applicant and a valid commercial register and tax card; the platform states one service floor per programme, so only the salaried 6 months is enforced.',
      'The home address must match the National ID and the I-Score, or the National ID and the driving licence; otherwise a utility bill no older than three months or an external verification is required. Not enforced — recorded here.',
      'The slides state no profit rate, no fee and no rate basis; the figures here are placeholders the team chose, marked as estimates, and are priced on the reducing annuity.',
    ],
    minAmountEGP: '100000',
    maxAmountEGP: '5000000',
    ltvCeilingPercent: '70',
    bankName: SCB,
    programType: 'income_surrogate',
    productCategory: 'car',
    tenor: { minMonths: 6, maxMonths: 84 },
    ratePercent: SCB_RATE,
    adminFeePercent: SCB_ADMIN_FEE,
    ageMin: 21,
    ageMax: 60,
    ageMinSelfEmployed: 25,
    ageMaxSelfEmployed: 65,
    minMonthlyIncomeEGP: '6000',
    minMonthlyIncomeSelfEmployedEGP: '15000',
    minMonthsInJob: 6,
    dbrCapPercent: '50',
    wayId: 'primary',
    stepParams: { primary: divisor(SCB_DP_DIVISOR) },
    requiredDocuments: SCB_DP_DOCUMENTS,
    estimated: SCB_ESTIMATED,
  }),
  program({
    programCode: 'SCB-CAR-DP20',
    friendlyName: 'Auto Loan — 20% Down Payment',
    friendlyNameAr: 'قرض سيارة — مقدم 20%',
    programNameKey: 'auto_down_payment_income',
    sheet: 'App. §4 — Suez Canal unsecured auto, 20% down payment',
    notes: [
      'Car insurance is required on this programme, and the home must be owned by the applicant or a first-degree relative. Neither is expressible as a field — recorded here.',
      'Ban on sale until the loan is settled.',
      'The sheet requires 24 months in business for a self-employed applicant and a valid commercial register and tax card; the platform states one service floor per programme, so only the salaried 6 months is enforced.',
      'The home address must match the National ID and the I-Score, or the National ID and the driving licence; otherwise a utility bill no older than three months or an external verification is required. Not enforced — recorded here.',
      'The slides state no profit rate, no fee and no rate basis; the figures here are placeholders the team chose, marked as estimates, and are priced on the reducing annuity.',
    ],
    minAmountEGP: '1000000',
    maxAmountEGP: '5000000',
    ltvCeilingPercent: '80',
    bankName: SCB,
    programType: 'income_surrogate',
    productCategory: 'car',
    tenor: { minMonths: 6, maxMonths: 84 },
    ratePercent: SCB_RATE,
    adminFeePercent: SCB_ADMIN_FEE,
    ageMin: 21,
    ageMax: 60,
    ageMinSelfEmployed: 25,
    ageMaxSelfEmployed: 65,
    minMonthlyIncomeEGP: '6000',
    minMonthlyIncomeSelfEmployedEGP: '15000',
    minMonthsInJob: 6,
    dbrCapPercent: '50',
    wayId: 'primary',
    stepParams: { primary: divisor(SCB_DP_DIVISOR) },
    requiredDocuments: SCB_DP_DOCUMENTS,
    estimated: SCB_ESTIMATED,
  }),
  program({
    programCode: 'SCB-CAR-GREEN_POWER',
    friendlyName: 'Green Power Loan',
    friendlyNameAr: 'قرض الطاقة الخضراء',
    sheet: 'App. §5 — Suez Canal Green Finance, Green Power Loan',
    notes: [
      'Sold to owners of a delivered unit in a pre-approved compound. Neither the compound list nor the delivery status is a field — recorded here.',
      'The slides state no profit rate, no fee and no rate basis; the figures here are placeholders the team chose, marked as estimates, and are priced on the reducing annuity.',
    ],
    tenor: { minMonths: 6, maxMonths: 120 },
    bankName: SCB,
    programType: 'income_surrogate',
    productCategory: 'car',
    programNameKey: 'green_finance_savings',
    minAmountEGP: '100000',
    maxAmountEGP: '1000000',
    ratePercent: SCB_RATE,
    adminFeePercent: SCB_ADMIN_FEE,
    ageMin: 25,
    ageMax: 60,
    ageMinSelfEmployed: 25,
    ageMaxSelfEmployed: 65,
    minMonthlyIncomeEGP: '50000',
    minMonthsInJob: 6,
    dbrCapPercent: '50',
    // The SAVINGS way of the one auto product (`alt`); the five down-payment programmes sell
    // `primary`. The cash column hangs off this way alone.
    wayId: 'alt',
    stepParams: {
      alt: divisor(SCB_DP_DIVISOR),
      alt__cash_buyer: divisor(SCB_CASH_DIVISOR),
    },
    requiredDocuments: SCB_GREEN_DOCUMENTS,
    estimated: SCB_ESTIMATED,
  }),
  program({
    programCode: 'SCB-CAR-MICRO_MOBILITY',
    friendlyName: 'Micro Mobility',
    friendlyNameAr: 'التنقل الخفيف',
    sheet: 'App. §5 — Suez Canal Green Finance, Micro Mobility',
    notes: [
      'Golf cars, scooters and e-bikes. Sold to owners of a delivered unit in a pre-approved compound. Neither the compound list nor the delivery status is a field — recorded here.',
      'The slides state no profit rate, no fee and no rate basis; the figures here are placeholders the team chose, marked as estimates, and are priced on the reducing annuity.',
    ],
    tenor: { minMonths: 6, maxMonths: 84 },
    bankName: SCB,
    programType: 'income_surrogate',
    productCategory: 'car',
    programNameKey: 'green_finance_savings',
    minAmountEGP: '100000',
    maxAmountEGP: '1000000',
    ratePercent: SCB_RATE,
    adminFeePercent: SCB_ADMIN_FEE,
    ageMin: 25,
    ageMax: 60,
    ageMinSelfEmployed: 25,
    ageMaxSelfEmployed: 65,
    minMonthlyIncomeEGP: '50000',
    minMonthsInJob: 6,
    dbrCapPercent: '50',
    // The SAVINGS way of the one auto product (`alt`); the five down-payment programmes sell
    // `primary`. The cash column hangs off this way alone.
    wayId: 'alt',
    stepParams: {
      alt: divisor(SCB_DP_DIVISOR),
      alt__cash_buyer: divisor(SCB_CASH_DIVISOR),
    },
    requiredDocuments: SCB_GREEN_DOCUMENTS,
    estimated: SCB_ESTIMATED,
  }),
];
