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
import type { FactGridDto } from '../dto/sub-configs/fact-grid.dto';
import type { EstimatedPaths } from './sheet-figures';
import { ABK_PRACTICE_EDGES, DOWN_PAYMENT_EDGES, dpBand } from './sheet-figures';

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
  /**
   * ABSENT means this programme states no duration of its own and reads the surrogate
   * product's (`effectiveTenor`). Six of Suez Canal Bank's seven auto programmes do exactly
   * that; `SCB-CAR-GREEN_POWER` lends to 120 months and states its own.
   *
   * Legal only under a catalog name whose product states a default — the save refuses a
   * programme with neither (`PROGRAM_RANGE_INVALID`), so a spec that drops this without the
   * product declaring `tenorDefaults` fails loudly at seed time rather than quoting nothing.
   */
  tenor?: {
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
  /**
   * The bank's own N-axis tables — a rate grid, and a term ceiling read from the car.
   *
   * Declared here and used by NO programme, deliberately. The reference's §3 prints two ADIB
   * rate cards that disagree with each other, two vehicle-age sets it calls "not
   * reconcilable", and one card whose 40% down-payment row is priced ABOVE its 30% row; §2's
   * HDB figures have no source sheet at all. Seeding any of it would be an engineer deciding
   * which of a bank's two sheets is true, frozen onto immutable offers.
   *
   * What these two lines buy is that the day a bank confirms a card, loading it is a seed
   * edit and nothing else — no migration, no engine change, no release. That is the test of
   * whether the grid was designed right, so the slot exists before the data does.
   */
  rateByFact?: FactGridDto;
  maxMonthsByFact?: FactGridDto;
  minMonthsByFact?: FactGridDto;
  /** A used-car age ceiling in years, keyed the same way as `maxMonthsByFact`. */
  maxVehicleAgeYearsByFact?: FactGridDto;
  ltvCeilingByFact?: FactGridDto;
  minAmountByFact?: FactGridDto;
  /**
   * Whose PLAN tables this programme reads. ABSENT IS `'own'`, so every programme in this
   * file that does not say otherwise is untouched by the mechanism existing.
   */
  plansSource?: 'product' | 'own';
  /**
   * Whose FIGURES this programme quotes from. Absent is `'own'` — the bank's own tables.
   *
   * `'catalog'` means it states none and reads the product's, merged by `effectiveIncomeRule`
   * on every quote rather than copied once. Only legal where the product's figures are the
   * bank's own published ones; a bank with a table of its own states it here instead.
   */
  amounts?: 'own' | 'catalog';
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
    // Omitted when absent rather than sent as `'own'`: absent and `'own'` are the same
    // answer, and one spelling is what keeps the seed's fingerprint stable.
    ...(input.plansSource ? { plansSource: input.plansSource } : {}),
    operatorNotes: [`Figures transcribed from ${input.sheet}.`, ...input.notes].join('\n'),
    ...(input.tips ? { operatorTips: input.tips } : {}),
    requiredDocuments: input.requiredDocuments ?? ['national_id', 'utility_bill'],
    // An EMPTY object when the spec states no months: `tenor` is a required column, and the
    // two months inside it are what is optional. That is the shape that means "read the
    // product's", and the one the wizard posts when an operator picks the same thing.
    tenor: {
      ...(input.tenor ?? {}),
      ...(input.maxMonthsByFact ? { maxMonthsByFact: input.maxMonthsByFact } : {}),
      ...(input.minMonthsByFact ? { minMonthsByFact: input.minMonthsByFact } : {}),
      ...(input.maxVehicleAgeYearsByFact
        ? { maxVehicleAgeYearsByFact: input.maxVehicleAgeYearsByFact }
        : {}),
    },
    loanLimits: {
      minAmountEGP: input.minAmountEGP,
      maxAmountEGP: input.maxAmountEGP,
      ...(input.ltvCeilingPercent ? { ltvCeilingPercent: input.ltvCeilingPercent } : {}),
      ...(input.ltvCeilingByFact ? { ltvCeilingByFact: input.ltvCeilingByFact } : {}),
      ...(input.minAmountByFact ? { minAmountByFact: input.minAmountByFact } : {}),
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
      ...(input.rateByFact ? { rateByFact: input.rateByFact } : {}),
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
          // DEFAULTS TO `'own'`, which is what every programme in this file but two means:
          // the bank states its own figures. `'catalog'` is for a programme whose sheet
          // prints no table of its own and reads the product's — the deposit-secured pair,
          // where the four shares ARE the published figures and duplicating them per bank
          // would be two places to change one number.
          amounts: input.amounts ?? 'own',
          ...(input.wayId !== undefined ? { wayId: input.wayId } : {}),
          // OMITTED on `'catalog'`, not sent empty. `persistableIncomeAssumption` strips
          // every figure key from a programme that inherits, so a `{}` sent here is stored
          // as nothing — and `programFingerprint` then compares a sent `stepParams: {}`
          // against a stored absence and reports a difference on every run. The seed rewrote
          // both deposit-secured programmes, with a new version and an audit event, every
          // time it was run; measured, not reasoned about.
          ...(input.amounts === 'catalog' ? {} : { stepParams: input.stepParams ?? {} }),
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

/**
 * The two self-employed conditions every Suez Canal auto sheet prints, switched ON.
 *
 * A choice condition applies exactly when the bank states `applies: true` — a gate nobody
 * turned on does not apply — so this pair is what turns "24 months in business, and a valid
 * commercial register and tax card" from a line in `notes` into a refusal the customer is
 * actually told about. Both allow-list the exempting answer, so a SALARIED applicant (whom
 * every one of these programmes accepts) passes in one tap rather than being refused for
 * failing to answer a question about a business they do not have.
 */
const SCB_SELF_EMPLOYED_GATES = {
  cond__businessoldenough: { applies: true },
  cond__selfemployedpapers: { applies: true },
};

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

/**
 * Crédit Agricole's auto card — the figures its own product guides print, and the one
 * they do not.
 *
 * ─── WHY THIS BANK AND NOT THE OTHER TWO ──────────────────────────────────────
 *
 * The `rateByFact` / `ltvCeilingByFact` / `maxMonthsByFact` slots on this file's `Input`
 * were declared "used by NO programme, deliberately" because the reference's ADIB card
 * contradicts itself and its HDB figures have no source sheet at all. Crédit Agricole is
 * the case those slots were waiting for: ONE printed guide (Auto Loans Product Guide, and
 * its Electric Vehicles companion), internally consistent across every page, stating the
 * loan ceilings, the financed shares, the terms, the ages and the debt-burden cap.
 *
 * ─── WHAT IT DOES NOT PRINT ───────────────────────────────────────────────────
 *
 * A rate. Not on one page of either guide — the Program Features table runs Target Segment,
 * Loan Amount, Loan Tenor, Car Financing %, Disbursement, Age … Debt Burden Ratio, and
 * stops. So the rate here is a placeholder on exactly the Suez Canal footing: stated once,
 * marked `team_estimated`, priced on the reducing annuity. The STRUCTURAL figures are the
 * bank's own and are NOT marked — claiming a published figure is a guess is the same defect
 * as the reverse.
 */
const CAE_RATE = '19';
const CAE_ADMIN_FEE = '1';
const CAE_ESTIMATED: EstimatedPaths = [
  'pricing.baseRatePercent',
  'pricing.rateByTransferType.none.value',
  ...ESTIMATED_FEES,
];

/**
 * The maximum loan by where the car was built, printed on every Crédit Agricole auto page:
 * Luxury 10 MEGP · European, Japanese & Korean 7 MEGP · Others 4 MEGP.
 *
 * `reject` and NOT `useProgramMax`, and that is the whole point of the table. The
 * programme's own `maxAmountEGP` has to carry the TOP of this range for the luxury row to
 * be reachable at all, so an applicant who skipped the optional origin question would be
 * handed the 10 MEGP ceiling by a `useProgramMax` fallback — the "Others" buyer quoted at
 * two and a half times their row, frozen onto an immutable offer.
 *
 * ─── THE COST, STATED ─────────────────────────────────────────────────────────
 *
 * ABK's doctors table takes the same `reject` and can afford it because its fact is
 * REQUIRED, so that branch is an unreachable safety net for a stale snapshot. `car_origin`
 * is OPTIONAL, so here it is the NORMAL path: an applicant who skips the question loses all
 * three Credit Agricole programmes — listed with a stated reason rather than filtered (A33),
 * and recoverable by answering it. That is the conservative direction and the only one
 * available: `maxLoanByFact` is a row/column table with no wildcard row, so the fallback the
 * Suez Canal RATE grid leans on ("the bare row prices everybody the named rows do not reach,
 * including an applicant who skipped the optional origin or fuel question") cannot be
 * written here. Making `car_origin` required for the `car` category would remove the cost
 * outright, and is a product decision with its own blast radius: required of every car
 * programme, and of every application already in flight.
 *
 * "Luxury" is a BRAND tier the guide names and `car_origin` has no option for, so no row
 * claims it: the eleven origins below are the two rows the question can actually answer.
 */
const CAE_MAX_LOAN_BY_ORIGIN = {
  factKey: 'car_origin',
  onNoMatch: 'reject' as const,
  rows: [
    { rowKey: 'germany', maxAmountEGP: '7000000' },
    { rowKey: 'japan', maxAmountEGP: '7000000' },
    { rowKey: 'korea', maxAmountEGP: '7000000' },
    { rowKey: 'france', maxAmountEGP: '7000000' },
    { rowKey: 'italy', maxAmountEGP: '7000000' },
    { rowKey: 'spain', maxAmountEGP: '7000000' },
    { rowKey: 'czechia', maxAmountEGP: '7000000' },
    { rowKey: 'usa', maxAmountEGP: '4000000' },
    { rowKey: 'china', maxAmountEGP: '4000000' },
    { rowKey: 'egypt', maxAmountEGP: '4000000' },
    { rowKey: 'other_origin', maxAmountEGP: '4000000' },
  ],
};

/**
 * First-stage documents, less the ones the platform has no registry key for.
 *
 * The guide's second stage — the auto loan contract, the Mobaia selling letter, the yearly
 * undated cheques, the signature-verification form, the installments calculation sheet — is
 * POST-APPROVAL paperwork the branch raises, not something an applicant brings. Those stay
 * in `notes` on the footing v27.0.0 put ABK's: a document key is a registry row and a hard
 * 422 on the way in, so minting five of them to describe a branch's own stationery would be
 * a migration bought for nothing.
 */
const CAE_AUTO_DOCUMENTS = ['national_id', 'proforma_invoice', 'car_insurance_policy'];

/** App. §4.5 pre-approval, less the two the platform has no key for (application form, BOD declaration). */
const SCB_DP_DOCUMENTS = ['national_id', 'price_quotation', 'down_payment_receipt'];
/**
 * The list the ONE merged down-payment programme carries, insurance included.
 *
 * App. §4.2 prints insurance per tier and says three different things: N/A at 60/50/40,
 * REQUIRED at 20, and NOTHING AT ALL at 30. While the five tiers were five programmes the
 * silent one was left on the shared list rather than guessed either way, and the 20% tier
 * carried cover on its own.
 *
 * MERGED, THAT DISTINCTION IS NOT EXPRESSIBLE. `requiredDocuments` is one array per
 * programme with no way to key it by the deposit — unlike the rate, the term, the share and
 * the floor, which all moved onto the plan table. So it is demanded of everyone, which
 * over-demands it of four tiers out of five. The alternative is dropping it, and the original
 * reasoning decides between them: a document demanded of an applicant whose bank never asked
 * for it is a refusal at the branch, and one quietly dropped is a loan that cannot complete.
 * The over-demand is the lesser, and the programme's notes say so out loud.
 *
 * The REQUIREMENT only. Insurance as a cost is not modelled: no sheet in the reference prints
 * a premium, and a made-up figure would be financed into an immutable offer (Principle I/A6).
 */
const SCB_DP20_DOCUMENTS = [...SCB_DP_DOCUMENTS, 'car_insurance_policy'];
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
      'Private hospitals only, not governmental — now asked and enforced as a condition. It carries an "I do not work at a hospital" answer, which is allow-listed: the exclusion is about a GOVERNMENT hospital, and everybody else is already priced out by the years band and this programme\u2019s accepted employment types.',
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
      // "Private hospitals only, not governmental" — the sheet's own words, and until now a
      // line in `notes` that refused nobody. `employment_status` is no proxy for it: a
      // government-hospital doctor is salaried and passes `acceptedEmploymentTypes`.
      cond__privatehospitalonly: { applies: true },
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
      'Past half its tenor, at least 12 paid months, and booked with 40% down: all three are now asked and enforced, the first two against the original tenor the applicant states. The FOURTH — the new instalment not exceeding 50% of the existing car instalment — is computed after the rule and is still not expressible.',
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
    stepParams: {
      primary: times('3'),
      alt: percent('10'),
      // The sheet's three conditions on the loan being cross-sold against: past half its
      // tenor, at least 12 instalments paid, and booked with 40% down. All three were
      // `notes` until the questions existed to read.
      cond__paidenoughmonths: { minValue: '12' },
      cond__paidenoughofterm__bound: percent('50'),
      cond__bookedwithdownpayment__bound: percent('40'),
    },
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
    stepParams: {
      primary: times('3'),
      alt: percent('10'),
      // The sheet's three conditions on the loan being cross-sold against: past half its
      // tenor, at least 12 instalments paid, and booked with 40% down. All three were
      // `notes` until the questions existed to read.
      cond__paidenoughmonths: { minValue: '12' },
      cond__paidenoughofterm__bound: percent('50'),
      cond__bookedwithdownpayment__bound: percent('40'),
    },
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
      'The sheet’s second column is X-SELL — the client holds another product, a credit card with a limit of at least 100,000 — and the product now carries that axis on this way (`holds_other_product`), so these figures are read as what they are: 1,250,000 · 1,500,000 · 1,750,000 · 2,000,000. Until 2026-09-09 they sat in a "new loan or top-up" column, which spec §10.3 is explicit is a DIFFERENT question. The ≥100,000 limit itself is still not expressible as a condition.',
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
    // ONE way, two columns: `alt__other_product_held` is the second column of the `alt`
    // bracket table, not a way of its own. The way's id is the bare head — the first column
    // keeps it, and here that is right in substance and not only in mechanics: the first
    // branch is `other_product_none`, which is what NTB means.
    //
    // The column reads `holds_other_product`, which is what the sheet actually prints. It
    // used to read `loan_is_topup` and these four figures sat in its top-up column, so a
    // customer holding a card and no ABK loan was quoted the X-SELL row as though they were
    // topping a loan up. The note below said so for three versions.
    wayId: 'alt',
    stepParams: {
      alt: banded(DOWN_PAYMENT_EDGES, ['750000', '1000000', '1250000', '1500000']),
      alt__other_product_held: banded(DOWN_PAYMENT_EDGES, [
        '1250000',
        '1500000',
        '1750000',
        '2000000',
      ]),
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
      //
      // CAE's two self-employed conditions, switched on. This programme accepts salaried
      // applicants too, which is exactly why both allow-list the exempting answer.
      cond__businessoldenough: { applies: true },
      cond__selfemployedpapers: { applies: true },
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
  // Three programmes off two mechanisms. The down-payment card is ONE programme reading the
  // product's five PLANS: the same `income = down payment ÷ 3.6`, and what separates the
  // tiers — the share of the car's price the bank finances (60% down → 40% financed), the
  // longest term, the floor and the 20% tier's home-ownership rule — is stated once on the
  // product, keyed by the deposit the applicant types. It was five programmes until the plan
  // tables existed, because a programme was the only thing that could carry a different
  // share. Green Finance is the same arithmetic over what the applicant has SAVED, with a
  // second column for a cash buyer.
  //
  // No rate is published on any of these slides, so the rate and the admin fee below are the
  // team's placeholders and every one of them is marked an estimate.
  // -------------------------------------------------------------------------
  program({
    programCode: 'SCB-CAR-DOWN_PAYMENT',
    friendlyName: 'Auto Loan — Down Payment as Income',
    friendlyNameAr: 'قرض سيارة — الدفعة المقدمة كدخل',
    programNameKey: 'auto_down_payment_income',
    sheet: 'App. §4 — Suez Canal unsecured auto, all five down-payment tiers',
    notes: [
      'ONE programme, five plans. The sheet prints five down-payment tiers that differ only ' +
        'in the share financed, the longest term and — on the 20% tier alone — the floor and ' +
        'the home-ownership condition. All five now live in the product\u2019s plan tables, ' +
        'keyed by the deposit the applicant states, so the customer is quoted the tier their ' +
        'own deposit lands in rather than five cards to choose between.',
      'Comprehensive car insurance is required on the 20% tier and on no other (App. §4.2). ' +
        'A required-document list is one array per programme with no way to key it by the ' +
        'deposit, so it is demanded of everyone here. That over-demands it of four tiers out ' +
        'of five, and the alternative — dropping it — is a 20% loan that cannot complete at ' +
        'the branch. The over-demand is the lesser of the two and this note is the record of ' +
        'the choice.',
      'Ban on sale until the loan is settled applies at 50/40/30/20% down and NOT at 60% ' +
        '(App. §4.2). No field expresses it at any tier, and merged it cannot be stated per ' +
        'tier at all — recorded here.',
      'The 12-month service requirement is waived at 40% and 50% down when the I-Score shows ' +
        'regular repayment over the last six months. No field expresses a conditional ' +
        'waiver — recorded here.',
      'The sheet requires 24 months in business for a self-employed applicant and a valid ' +
        'commercial register and tax card. Both are asked and enforced as conditions — each ' +
        'carries an "I do not run a business" answer, so a salaried applicant, whom this ' +
        'programme also accepts, passes rather than being refused for not answering.',
      'The home address must match the National ID and the I-Score, or the National ID and ' +
        'the driving licence; otherwise a utility bill no older than three months or an ' +
        'external verification is required. Not enforced — recorded here.',
      'The slides state no profit rate, no fee and no rate basis; the figures here are ' +
        'placeholders the team chose, marked as estimates, and are priced on the reducing ' +
        'annuity. Every rate in the product\u2019s plan table is an estimate for the same ' +
        'reason.',
    ],
    minAmountEGP: '100000',
    maxAmountEGP: '5000000',
    // THE FALLBACK SHARE, and it is not decoration. `ltvCeilingFor` answers `null` when no
    // scalar is stored, and `null` is NO CLAMP AT ALL — so a build that cannot read the plan
    // table must still find a number here or it would finance the whole car. 40% is the
    // lowest tier the sheet prints, so the fallback under-quotes rather than over-quotes.
    ltvCeilingPercent: '40',
    bankName: SCB,
    programType: 'income_surrogate',
    productCategory: 'car',
    // No duration of its own: it reads the product's 6-84 (`down_payment_income`), and the
    // plan table shortens it per tier.
    //
    // And no plan tables of its own either — it reads the product's, which is the mechanism
    // demonstrating itself: five tiers stated once, on the screen an operator edits.
    plansSource: 'product',
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
    // `cond__homeowned` is deliberately ABSENT, where the 20% tier carried it. A condition
    // applies per PROGRAMME and not per deposit, so switched on here it would refuse a renter
    // putting 60% down — whom this bank accepts. The rule moved onto the axis it was always
    // about: the product's financed-share table states rows for an owner and for a relative's
    // home in the 20-30% band and none for a renter, so the refusal binds in that band alone.
    stepParams: { primary: divisor(SCB_DP_DIVISOR), ...SCB_SELF_EMPLOYED_GATES },
    requiredDocuments: SCB_DP20_DOCUMENTS,
    estimated: SCB_ESTIMATED,
  }),
  program({
    programCode: 'SCB-CAR-GREEN_POWER',
    friendlyName: 'Green Power Loan',
    friendlyNameAr: 'قرض الطاقة الخضراء',
    sheet: 'App. §5 — Suez Canal Green Finance, Green Power Loan',
    notes: [
      'Sold to owners of a delivered unit in a pre-approved compound. Now asked and enforced as one condition — the applicant states whether their home is in a finished, bank-approved compound. The compound LIST itself is still not a field, so the answer is the applicant\u2019s word for it rather than a lookup.',
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
      ...SCB_SELF_EMPLOYED_GATES,
      // Sold only against a delivered unit in a pre-approved compound. On for the Green pair
      // and nobody else.
      cond__unitinapprovedcompound: { applies: true },
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
      'Golf cars, scooters and e-bikes. Sold to owners of a delivered unit in a pre-approved compound — now asked and enforced as one condition. The compound LIST itself is still not a field, so the answer is the applicant\u2019s word for it rather than a lookup.',
      'The slides state no profit rate, no fee and no rate basis; the figures here are placeholders the team chose, marked as estimates, and are priced on the reducing annuity.',
    ],
    // No duration of its own: it reads the product's 6-84 (`down_payment_income`).
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
      ...SCB_SELF_EMPLOYED_GATES,
      // Sold only against a delivered unit in a pre-approved compound. On for the Green pair
      // and nobody else.
      cond__unitinapprovedcompound: { applies: true },
    },
    requiredDocuments: SCB_GREEN_DOCUMENTS,
    estimated: SCB_ESTIMATED,
  }),

  // ───────────────────────────────────────────────────────────────────────────
  // Crédit Agricole Egypt — the Auto Loans and Electric Vehicles product guides
  //
  // THREE programmes, not eleven. The guide prints a card per down-payment tier (New Car at
  // 20/40/50%, an "envelop" and an "Easy envelop" variant, Used Car at 40/50%, EV at
  // 35/40/50%), and the tiers of one card differ only in the share financed. That is the
  // shape v30.0.0 established for Suez Canal's five tiers and the reasoning carries
  // unchanged: the deposit is an ANSWER, so the customer is quoted the tier their own
  // deposit lands in rather than handed five cards to choose between. What genuinely IS a
  // different product gets its own programme — a used car (its own age rules, its own
  // minimum age) and an electric one (its own guide, and a financed share the petrol card
  // never reaches).
  //
  // The "envelop" / "Easy envelop" variants are NOT seeded. They carry the same deposits and
  // the same ceilings and differ in which verification the branch runs, which is an
  // underwriting route rather than a figure — and the platform has no field for it. Noted on
  // the New Car programme rather than invented as a second card quoting identical money.
  // ───────────────────────────────────────────────────────────────────────────
  program({
    programCode: 'SCB-PER-SEMI_COVERED',
    friendlyName: 'Semi-Covered Loan',
    friendlyNameAr: 'قرض بضمان جزئي',
    sheet: 'App. \u00a74 \u2014 Suez Canal Semi-Covered, secured against a certificate of deposit',
    notes: [
      'The sixth programme on the Suez Canal auto card, and the only one that is not sold ' +
        'against a down payment. The loan is a share of a certificate the customer pledges, ' +
        'so the whole eligibility column of \u00a74.1 reads "Not Required" \u2014 no minimum age, no ' +
        'length of service, no minimum salary.',
      'App. \u00a74.2 states it as "up to 100% of the CD amount, where 90% of the loan is secured ' +
        'and the rest is treated unsecured", and allows the secured portion to drop to 80% ' +
        'for semi-annual or annual payment. The SPLIT between the secured and unsecured legs ' +
        'is not modelled \u2014 no field expresses a two-leg facility \u2014 so this programme quotes ' +
        'the share of the pledge and says so here.',
      'A collateral lien form is required, and is the one document this programme needs that ' +
        'the four down-payment tiers do not. There is no registry key for it \u2014 recorded here.',
      'The rate is a placeholder: no Suez Canal slide prints one. Marked as an estimate.',
    ],
    bankName: SCB,
    programType: 'income_surrogate',
    productCategory: 'personal',
    programNameKey: 'deposit_secured',
    tenor: { minMonths: 6, maxMonths: 84 },
    minAmountEGP: '100000',
    maxAmountEGP: '5000000',
    ratePercent: SCB_RATE,
    adminFeePercent: SCB_ADMIN_FEE,
    // \u00a74.1's eligibility column is "Not Required" throughout. The platform has no way to
    // state "no age limit", so the widest legal band stands in and the note above says why.
    ageMin: 21,
    ageMax: 65,
    dbrCapPercent: '50',
    wayId: 'primary',
    amounts: 'catalog',
    // Suez Canal prints no share of its own \u2014 \u00a74.2 gives a ceiling ("up to 100%") and a
    // floor for the long payment gaps, not a table. It takes the product's four, which are
    // Credit Agricole's published figures, and the note records that this is a borrowing.
    stepParams: {},
    estimated: SCB_ESTIMATED,
  }),
  program({
    programCode: 'CAE-PER-DEPOSIT_SECURED',
    friendlyName: 'Secured Against Deposits',
    friendlyNameAr: 'تمويل بضمان الودائع',
    sheet: 'CAE Auto Loans Product Guide \u2014 Secured Against Deposits (0706 / 0707 / 0730)',
    notes: [
      'Three programme codes on one page \u2014 Against CD (0707), Against TD (0706) and Against ' +
        'Floating CD (0730). ONE programme here: the guide states one Program Features table ' +
        'and one financing-percentage table for all three, and what differs is which ' +
        'instrument is pledged, not a figure the engine prices.',
      'Income, business seniority, debt burden and internal verification are all WAIVED on ' +
        'this page. The programme still carries a 50% debt-burden cap because a ceiling ' +
        'product converts through it at a ratio of exactly 1 \u2014 with no obligations the ' +
        'amount comes back as the pledge share, to the cent.',
      'Tenor follows the pledged instrument: the guide allows up to 5 years against a ' +
        'deposit of 25 KEGP and up to 7 years above 100 KEGP. That is a term keyed by the ' +
        'pledge AMOUNT, which `tenor.maxMonthsByFact` could express \u2014 not seeded, because ' +
        'the guide gives two points and not a table, and the gap between them is a guess.',
      'Minors may borrow against a deposit held in their name, with an indemnity letter and ' +
        'a birth certificate. Not modelled \u2014 the platform has no applicant under 21.',
      'The rate is a placeholder: the guide prints none. Marked as an estimate.',
    ],
    bankName: CAE,
    programType: 'income_surrogate',
    productCategory: 'personal',
    programNameKey: 'deposit_secured',
    tenor: { minMonths: 6, maxMonths: 84 },
    minAmountEGP: '15000',
    maxAmountEGP: '10000000',
    ratePercent: CAE_RATE,
    adminFeePercent: CAE_ADMIN_FEE,
    ageMin: 21,
    ageMax: 65,
    dbrCapPercent: '50',
    wayId: 'primary',
    amounts: 'catalog',
    // Takes the product's four shares \u2014 they ARE this bank's published table.
    stepParams: {},
    estimated: CAE_ESTIMATED,
  }),
  program({
    programCode: 'CAE-CAR-NEW_CAR',
    friendlyName: 'Auto Loan — New Car',
    friendlyNameAr: 'قرض سيارة — جديدة',
    sheet: 'CAE Auto Loans Product Guide — New car, 20% / 40% / 50% down payment',
    notes: [
      'ONE programme, three deposit tiers. The guide prints 20%, 40% and 50% down-payment ' +
        'cards that finance 80%, 60% and 50% of the price respectively; all three live in ' +
        'the financed-share table, keyed by the deposit the applicant states.',
      'The guide also prints a 40% "envelop" and a 50% "Easy envelop" variant carrying the ' +
        'same deposits and the same ceilings. What differs is the verification route the ' +
        'branch runs, not a figure the engine prices — and no field expresses it, so they ' +
        'are not seeded as second cards quoting identical money.',
      'Self-employed applicants are held to 60 months across the whole card. The guide caps ' +
        'them at 60 on the 50% tier ALONE and allows 84 on the other two, and a programme ' +
        'has one employment-tenor map with no way to key it by deposit. Capping everywhere ' +
        'shortens a term rather than lengthening one, so it under-quotes rather than over-' +
        'quotes — the direction this file takes wherever a merge cannot state a difference.',
      'The rate is a placeholder: neither guide prints one on any page. Marked as an ' +
        'estimate and priced on the reducing annuity.',
      'Second-stage documents — the auto loan contract, the Mobaia car-selling letter, the ' +
        'yearly undated cheques, the signature-verification form and the installments ' +
        'calculation sheet — are raised by the branch after approval and have no registry ' +
        'key. Recorded here rather than demanded of the applicant up front.',
      'Disbursement is a direct payment to the vendor by bank draft or internal transfer, ' +
        'never to the customer. No field expresses it — recorded here.',
    ],
    bankName: CAE,
    programType: 'income_proof',
    productCategory: 'car',
    programNameKey: 'new_car',
    tenor: {
      minMonths: 6,
      maxMonths: 84,
      // The 50% tier's self-employed cap, applied card-wide. See the note above.
      maxMonthsByEmploymentType: { self_employed: 60 },
    },
    minAmountEGP: '15000',
    // The TOP of the origin table, which `maxLoanByFact` then narrows per answer. A ceiling
    // below 10,000,000 here would make the luxury row unreachable.
    maxAmountEGP: '10000000',
    // The fallback share, and it is the SMALLEST the card sells rather than the largest: a
    // build that cannot read the grid must under-quote. 50% is the 50%-deposit tier's.
    ltvCeilingPercent: '50',
    ltvCeilingByFact: {
      axes: [{ factKey: 'car_down_payment_percent' }],
      cells: [
        { keys: [dpBand('20', '40')], value: '80' },
        { keys: [dpBand('40', '50')], value: '60' },
        { keys: [dpBand('50', null)], value: '50' },
      ],
      // A deposit under the lowest tier is a loan this bank does not write.
      onNoMatch: 'reject',
    },
    /**
     * The Chinese-car term rule, printed as a General Condition on every page of the guide:
     * "Finance all Chinese cars for 60 months except for Chinese cars sold by Ghabbour &
     * Mansour Company tenor to reach 84 Months".
     *
     * Two axes, because it is two facts: where the car was BUILT and who is SELLING it. Only
     * the Chinese rows are stated — `useFallback` leaves every other origin on the
     * programme's own 6-84, which is what the guide says about them (nothing).
     *
     * `useFallback` and NOT `reject`, unlike the origin ceiling on the same programme. A term
     * has a safe fallback and a loan ceiling does not: an applicant who skips the optional
     * dealer question should be financed over the programme's own term, not refused. The
     * wildcard Chinese row is what makes that safe in the other direction — a Chinese car
     * with no dealer stated still lands on 60, so the extension has to be claimed, never
     * assumed.
     */
    maxMonthsByFact: {
      axes: [{ factKey: 'car_origin' }, { factKey: 'car_dealer' }],
      cells: [
        { keys: [{ key: 'china' }, null], value: '60' },
        { keys: [{ key: 'china' }, { key: 'ghabbour_mansour' }], value: '84' },
      ],
      onNoMatch: 'useFallback',
    },
    maxLoanByFact: CAE_MAX_LOAN_BY_ORIGIN,
    ratePercent: CAE_RATE,
    adminFeePercent: CAE_ADMIN_FEE,
    ageMin: 21,
    ageMax: 65,
    ageMinSelfEmployed: 21,
    ageMaxSelfEmployed: 65,
    dbrCapPercent: '50',
    requiredDocuments: CAE_AUTO_DOCUMENTS,
    estimated: CAE_ESTIMATED,
  }),
  program({
    programCode: 'CAE-CAR-USED_CAR',
    friendlyName: 'Auto Loan — Used Car',
    friendlyNameAr: 'قرض سيارة — مستعملة',
    sheet: 'CAE Auto Loans Product Guide — Used car, 40% & 50% down payment',
    notes: [
      'Its own programme and not a tier of the new-car card: the minimum age is 25 rather ' +
        'than 21, the loan term is measured from the manufacturing date, and the guide ' +
        'prints a vehicle-age table the new-car pages have no equivalent of.',
      'The age table is enforced for European, Japanese, Korean and every other origin at ' +
        '8 years back, and for a Chinese car at 5 unless it is sold through Ghabbour & ' +
        'Mansour — the same dealer exception the term rule states, read here as "back to ' +
        'the general 8" rather than "60 becomes 84". "Luxury" gets no row: the guide names ' +
        'it as a BRAND TIER and `car_origin` has no option for one — the same gap the ' +
        'origin loan ceiling states above it. A luxury car is priced and termed as ' +
        'whichever of the eleven origins it was actually built in.',
      '`car_age_years` is engine-derived — `car_model_year` read against the clock once per ' +
        'quote, never stored — so a model-year table cannot go stale under a frozen offer ' +
        '(Principle V / A6) the way a table of absolute years would have.',
      'The maximum loan by origin IS enforced, and it is the half of that table that does ' +
        'not rot: 7,000,000 for a European, Japanese or Korean car and 4,000,000 otherwise.',
      'Both deposit tiers finance up to 60% of the price — the guide states one share for ' +
        'the pair, so the financed-share table states it once rather than twice.',
      'A vehicle evaluation certificate (30-day validity, issued by an approved service ' +
        'centre) and the vendor-coding criteria are eligibility steps the branch runs. ' +
        'Neither has a registry key — recorded here.',
      'The mileage ceiling — 40,000 km a year for an economy car, 100,000 for a luxury one ' +
        '— is a stated rejection reason in the guide and no fact expresses it.',
      'The rate is a placeholder: the guide prints none. Marked as an estimate.',
    ],
    bankName: CAE,
    programType: 'income_proof',
    productCategory: 'car',
    programNameKey: 'used_car',
    tenor: {
      minMonths: 6,
      maxMonths: 84,
      maxMonthsByEmploymentType: { self_employed: 60 },
    },
    minAmountEGP: '15000',
    maxAmountEGP: '10000000',
    ltvCeilingPercent: '60',
    ltvCeilingByFact: {
      axes: [{ factKey: 'car_down_payment_percent' }],
      cells: [{ keys: [dpBand('40', null)], value: '60' }],
      onNoMatch: 'reject',
    },
    /**
     * The Chinese-car term rule, printed as a General Condition on every page of the guide:
     * "Finance all Chinese cars for 60 months except for Chinese cars sold by Ghabbour &
     * Mansour Company tenor to reach 84 Months".
     *
     * Two axes, because it is two facts: where the car was BUILT and who is SELLING it. Only
     * the Chinese rows are stated — `useFallback` leaves every other origin on the
     * programme's own 6-84, which is what the guide says about them (nothing).
     *
     * `useFallback` and NOT `reject`, unlike the origin ceiling on the same programme. A term
     * has a safe fallback and a loan ceiling does not: an applicant who skips the optional
     * dealer question should be financed over the programme's own term, not refused. The
     * wildcard Chinese row is what makes that safe in the other direction — a Chinese car
     * with no dealer stated still lands on 60, so the extension has to be claimed, never
     * assumed.
     */
    maxMonthsByFact: {
      axes: [{ factKey: 'car_origin' }, { factKey: 'car_dealer' }],
      cells: [
        { keys: [{ key: 'china' }, null], value: '60' },
        { keys: [{ key: 'china' }, { key: 'ghabbour_mansour' }], value: '84' },
      ],
      onNoMatch: 'useFallback',
    },
    /**
     * The used-car age table — a REFUSAL, not a term. Same axes as the term grid above and
     * safely so: the applicant's age is compared OUTSIDE this grid (`quote.ts`), never as a
     * third axis inside it, so origin and dealer alone decide which cell wins.
     *
     * NO WILDCARD ROW — `validateFactGrid` refuses a cell naming no axis at all
     * (`cell_all_wildcard`), so "8 for everyone" has to be TEN origin rows rather than one,
     * exactly like `CAE_MAX_LOAN_BY_ORIGIN` above it. This is also the safer shape: a
     * banded age axis sharing space with a origin wildcard would have let a Chinese car
     * aged 6-8 slip through on the general row (verified against `resolveFactGrid`'s
     * specificity ordering while designing this, not assumed) — enumerating origins avoids
     * the question rather than relying on getting a wildcard-and-band interaction right.
     *
     * `useFallback` here means "this table has nothing to say about this applicant" — an
     * unanswered origin or dealer is not refused, matching the optional questions it reads.
     */
    maxVehicleAgeYearsByFact: {
      axes: [{ factKey: 'car_origin' }, { factKey: 'car_dealer' }],
      cells: [
        { keys: [{ key: 'germany' }, null], value: '8' },
        { keys: [{ key: 'japan' }, null], value: '8' },
        { keys: [{ key: 'korea' }, null], value: '8' },
        { keys: [{ key: 'france' }, null], value: '8' },
        { keys: [{ key: 'italy' }, null], value: '8' },
        { keys: [{ key: 'spain' }, null], value: '8' },
        { keys: [{ key: 'czechia' }, null], value: '8' },
        { keys: [{ key: 'usa' }, null], value: '8' },
        { keys: [{ key: 'egypt' }, null], value: '8' },
        { keys: [{ key: 'other_origin' }, null], value: '8' },
        { keys: [{ key: 'china' }, null], value: '5' },
        { keys: [{ key: 'china' }, { key: 'ghabbour_mansour' }], value: '8' },
      ],
      onNoMatch: 'useFallback',
    },
    maxLoanByFact: CAE_MAX_LOAN_BY_ORIGIN,
    ratePercent: CAE_RATE,
    adminFeePercent: CAE_ADMIN_FEE,
    // The used-car pages raise the floor to 25. The new-car ones say 21.
    ageMin: 25,
    ageMax: 65,
    ageMinSelfEmployed: 25,
    ageMaxSelfEmployed: 65,
    dbrCapPercent: '50',
    requiredDocuments: CAE_AUTO_DOCUMENTS,
    estimated: CAE_ESTIMATED,
  }),
  program({
    programCode: 'CAE-CAR-EV',
    friendlyName: 'Electric Vehicle Auto Loan',
    friendlyNameAr: 'قرض السيارات الكهربائية',
    sheet: 'CAE Electric Vehicles Product Guide — 35% / 40% / 50% down payment',
    notes: [
      'Its own guide at the bank and its own programme here, for one figure: a 35% deposit ' +
        'finances 65% of the price. No tier of the petrol card reaches that share.',
      'It files under the New Car catalog name rather than an electric one of its own. A ' +
        'catalog name is what the CUSTOMER picks, and somebody buying an electric car is ' +
        'buying a new car — what makes this programme theirs is the fuel they answer, not a ' +
        'second row in the picker. The term table is what enforces it: it states rows for an ' +
        'electric and a hybrid car and none for petrol, so a petrol applicant is listed with ' +
        'a stated reason rather than quoted an EV share.',
      'Hybrids are accepted on the same terms as fully electric. The guide is written for ' +
        '"Electric Vehicles" and does not name hybrids either way; including them is this ' +
        'team’s reading and is the one row here that is not transcribed from the page.',
      'The rate is a placeholder: the guide prints none. Marked as an estimate.',
    ],
    bankName: CAE,
    programType: 'income_proof',
    productCategory: 'car',
    programNameKey: 'new_car',
    tenor: { minMonths: 6, maxMonths: 84 },
    minAmountEGP: '15000',
    maxAmountEGP: '10000000',
    ltvCeilingPercent: '50',
    ltvCeilingByFact: {
      axes: [{ factKey: 'car_down_payment_percent' }],
      cells: [
        { keys: [dpBand('35', '40')], value: '65' },
        { keys: [dpBand('40', '50')], value: '60' },
        { keys: [dpBand('50', null)], value: '50' },
      ],
      onNoMatch: 'reject',
    },
    // What makes this the EV programme. Rows for the two fuels it is sold against and none
    // for petrol, so `reject` refuses a petrol car HERE while the petrol card prices it
    // normally — the programme stays listed with a reason (Principle V / A33), never filtered.
    maxMonthsByFact: {
      // THREE axes, because this one table answers two questions at once: which fuels the
      // programme is sold against at all, and how long a Chinese one is financed for.
      //
      // `specificity()` is a bitmask with axis 0 most significant, so the cells are tried
      // 3-stated, then 2-stated, then 1-stated: a Chinese electric car from Ghabbour lands on
      // 84, any other Chinese electric car on 60, and every other electric car on the
      // programme's own 84. Stating the Chinese rows for BOTH fuels is not duplication — a
      // wildcard on axis 0 would also match petrol, and petrol matching anything at all is
      // what this grid exists to prevent.
      axes: [{ factKey: 'car_fuel_type' }, { factKey: 'car_origin' }, { factKey: 'car_dealer' }],
      cells: [
        { keys: [{ key: 'electric' }, null, null], value: '84' },
        { keys: [{ key: 'hybrid' }, null, null], value: '84' },
        { keys: [{ key: 'electric' }, { key: 'china' }, null], value: '60' },
        { keys: [{ key: 'hybrid' }, { key: 'china' }, null], value: '60' },
        {
          keys: [{ key: 'electric' }, { key: 'china' }, { key: 'ghabbour_mansour' }],
          value: '84',
        },
        { keys: [{ key: 'hybrid' }, { key: 'china' }, { key: 'ghabbour_mansour' }], value: '84' },
      ],
      onNoMatch: 'reject',
    },
    maxLoanByFact: CAE_MAX_LOAN_BY_ORIGIN,
    ratePercent: CAE_RATE,
    adminFeePercent: CAE_ADMIN_FEE,
    ageMin: 21,
    ageMax: 65,
    ageMinSelfEmployed: 21,
    ageMaxSelfEmployed: 65,
    dbrCapPercent: '50',
    requiredDocuments: CAE_AUTO_DOCUMENTS,
    estimated: CAE_ESTIMATED,
  }),
];
