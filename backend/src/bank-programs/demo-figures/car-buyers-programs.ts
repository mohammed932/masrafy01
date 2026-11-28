/**
 * The four bank programmes that sell "Car Buyers — Down Payment or Savings" through the
 * `car_buyers_program` catalog name — so a database built from the seeds has the product SOLD,
 * not only defined.
 *
 * COPIED, not invented: every figure below is what the operator typed on the admin screens on
 * 2026-09-23, read back off the database row for row (codes included, since a re-run finds the
 * row it wrote by its code). Nothing here is a sheet figure, so nothing is marked estimated.
 *
 * Since 2026-11-20 each states its own plan tables: three hold a copy of the Suez Canal card
 * the product used to carry (`ownPlans` below), National Bank of Egypt its own. Before that
 * the three read the product's plan tables (`plansSource: 'product'`) and stated only
 * what differs; National Bank of Egypt states its own plans. The product's own defaults — the
 * plans, the duration, the loan size and the I-Score tiers these inherit — are seeded on the
 * product in `sheet-figures.ts` (`down_payment_income`).
 */
import { PRODUCT_RULE_STRATEGY } from '@/matching/types';
import type { CreateBankProgramDto } from '../dto/create-bank-program.dto';
import type { FactGridDto } from '../dto/sub-configs/fact-grid.dto';
import type { ProgramSpec } from './sheet-programs';
import { SCB_AUTO_PLANS } from './sheet-figures';
import { NATIONAL, SCB_CARD } from './car-card-grids';

/**
 * Cast, for the reason `sheet-programs.ts` states at its own: `strategy` is validated by
 * `@Matches` at runtime, and a product rule's token (`steps`) is not in the union the TYPE names.
 */
const rule = (value: object): CreateBankProgramDto['incomeAssumption'] =>
  value as CreateBankProgramDto['incomeAssumption'];

const SOURCE = 'Admin-entered, 2026-09-23 — car_buyers_program';

const grid = (key: keyof typeof SCB_AUTO_PLANS): FactGridDto =>
  structuredClone(SCB_AUTO_PLANS[key]) as FactGridDto;

/** The Suez Canal card as a program's own plan tables, merged into what it already states. */
function ownPlans(dto: Omit<CreateBankProgramDto, 'plansSource'>): CreateBankProgramDto {
  return {
    ...dto,
    plansSource: 'own',
    pricing: { ...dto.pricing, rateByFact: grid('rateByFact') },
    tenor: { ...dto.tenor, maxMonthsByFact: grid('maxMonthsByFact') },
    loanLimits: {
      ...dto.loanLimits,
      ltvCeilingByFact: grid('ltvCeilingByFact'),
      minAmountByFact: grid('minAmountByFact'),
    },
    fees: { ...dto.fees, carInsuranceRateByFact: grid('carInsuranceRateByFact') },
  } as CreateBankProgramDto;
}

/**
 * The card's own estimates, moved with it: all twenty rates and the three term ceilings are
 * this team's illustration (no Suez Canal slide prints them). The cover percentage is not —
 * the operator typed it.
 */
const PLAN_ESTIMATED = [
  ...Array.from({ length: SCB_CARD.rateByFact!.cells.length }, (_, i) => `pricing.rateByFact.cells.${i}.value`),
  ...Array.from({ length: SCB_CARD.maxMonthsByFact!.cells.length }, (_, i) => `tenor.maxMonthsByFact.cells.${i}.value`),
];

export const CAR_BUYERS_PROGRAMS: readonly ProgramSpec[] = [
  {
    programCode: 'CRE-CAR-3743',
    sheet: SOURCE,
    estimated: PLAN_ESTIMATED,
    dto: ownPlans({
      programCode: 'CRE-CAR-3743',
      bankName: 'Crédit Agricole Egypt',
      friendlyName: 'Agricole Car Buyers Program',
      friendlyNameAr: 'شراء سيارة الزراعي',
      programNameKey: 'car_buyers_program',
      programType: 'income_surrogate',
      productCategory: 'car',
      isShariaCompliant: false,
      requiredDocuments: ['NATIONAL_ID_FRONT', 'NATIONAL_ID_BACK', 'national_id'],
      tenor: {
        maxMonths: 84,
        minMonths: 6,
      },
      loanLimits: {
        maxAmountEGP: '4000000',
        minAmountEGP: '500000',
        ltvCeilingPercent: '20',
      },
      pricing: {
        rateBasis: 'reducing',
        isVariableRate: false,
      },
      eligibility: {
        ageMax: 60,
        ageMin: 21,
        requiresCD: false,
        skipDbrCheck: false,
        dbrCapPercent: '50.0',
        minMonthsInJob: 6,
        requiresCollateral: false,
        minMonthlyIncomeEGP: '5000',
        requiresNoDocuments: false,
        requiresExistingLoan: false,
        acceptedTransferTypes: ['payroll', 'salary_transfer_letter', 'income_transfer_letter'],
        requiresAutoLoanAtABK: false,
        requiresClubMembership: false,
        acceptedEmploymentTypes: ['salaried'],
        requiresCompoundProperty: false,
        requiresFRMUVerification: false,
        requiresQualitativeReview: false,
        requiresAutoLoanAtOtherBank: false,
        requiresCreditCardAtOtherBank: false,
      },
      incomeAssumption: rule({
        wayId: 'primary',
        amounts: 'own',
        strategy: PRODUCT_RULE_STRATEGY,
        stepParams: {
          primary: {
            scalar: {
              unit: 'multiplier',
              value: '3.6',
            },
          },
        },
      }),
      fees: {
        adminFeePercent: '1.0',
        stampDutyPercent: '0.5',
        payoffCashPercent: '12.0',
        payoffBuyoutPercent: '15.0',
        lifeInsurancePercent: '0.5',
        latePaymentFeePercent: '4.0',
        lifeInsuranceMandatory: false,
      },
    }),
  },
  {
    programCode: 'BANK-CAR-EA65',
    sheet: SOURCE,
    estimated: PLAN_ESTIMATED,
    dto: ownPlans({
      programCode: 'BANK-CAR-EA65',
      bankName: 'Bank NXT',
      friendlyName: 'NXT Car',
      friendlyNameAr: 'NXT سيارة',
      programNameKey: 'car_buyers_program',
      programType: 'income_surrogate',
      productCategory: 'car',
      isShariaCompliant: false,
      requiredDocuments: [],
      tenor: {},
      loanLimits: {},
      pricing: {
        rateBasis: 'reducing',
        isVariableRate: false,
        baseRatePercent: '20',
      },
      eligibility: {
        ageMax: 60,
        ageMin: 21,
        requiresCD: false,
        skipDbrCheck: false,
        dbrCapPercent: '50.0',
        minMonthsInJob: 6,
        requiresCollateral: false,
        minMonthlyIncomeEGP: '5000',
        requiresNoDocuments: false,
        requiresExistingLoan: false,
        acceptedTransferTypes: ['payroll', 'salary_transfer_letter', 'income_transfer_letter'],
        requiresAutoLoanAtABK: false,
        requiresClubMembership: false,
        acceptedEmploymentTypes: ['salaried'],
        requiresCompoundProperty: false,
        requiresFRMUVerification: false,
        requiresQualitativeReview: false,
        requiresAutoLoanAtOtherBank: false,
        requiresCreditCardAtOtherBank: false,
      },
      incomeAssumption: rule({
        wayId: 'alt',
        amounts: 'own',
        strategy: PRODUCT_RULE_STRATEGY,
        stepParams: {
          alt: {
            scalar: {
              unit: 'multiplier',
              value: '6',
            },
          },
          alt__cash_buyer: {
            scalar: {
              unit: 'multiplier',
              value: '10',
            },
          },
        },
      }),
      fees: {
        adminFeePercent: '1.0',
        stampDutyPercent: '0.5',
        payoffCashPercent: '12.0',
        payoffBuyoutPercent: '15.0',
        lifeInsurancePercent: '0.5',
        latePaymentFeePercent: '4.0',
        lifeInsuranceMandatory: false,
      },
    }),
  },
  {
    programCode: 'BANQUE-CAR-0549',
    sheet: SOURCE,
    estimated: PLAN_ESTIMATED,
    dto: ownPlans({
      programCode: 'BANQUE-CAR-0549',
      bankName: 'Banque Misr',
      friendlyName: 'Banque Misr Car Buyers',
      friendlyNameAr: 'شراء سيارة بنك مصر',
      programNameKey: 'car_buyers_program',
      programType: 'income_surrogate',
      productCategory: 'car',
      isShariaCompliant: false,
      requiredDocuments: ['property_deed', 'NATIONAL_ID_FRONT', 'NATIONAL_ID_BACK'],
      tenor: {
        maxMonths: 84,
        minMonths: 6,
      },
      loanLimits: {
        maxAmountEGP: '300000',
        minAmountEGP: '200000',
        ltvCeilingPercent: '20',
      },
      pricing: {
        rateBasis: 'reducing',
        isVariableRate: false,
      },
      eligibility: {
        ageMax: 60,
        ageMin: 21,
        requiresCD: false,
        skipDbrCheck: false,
        dbrCapPercent: '50.0',
        minMonthsInJob: 6,
        requiresCollateral: false,
        minMonthlyIncomeEGP: '5000',
        requiresNoDocuments: false,
        requiresExistingLoan: false,
        acceptedTransferTypes: ['payroll', 'salary_transfer_letter', 'income_transfer_letter'],
        requiresAutoLoanAtABK: false,
        requiresClubMembership: false,
        acceptedEmploymentTypes: ['salaried'],
        requiresCompoundProperty: false,
        requiresFRMUVerification: false,
        requiresQualitativeReview: false,
        requiresAutoLoanAtOtherBank: false,
        requiresCreditCardAtOtherBank: false,
      },
      incomeAssumption: rule({
        wayId: 'primary',
        amounts: 'own',
        strategy: PRODUCT_RULE_STRATEGY,
        stepParams: {
          primary: {
            scalar: {
              unit: 'multiplier',
              value: '3',
            },
          },
        },
      }),
      fees: {
        adminFeePercent: '1.0',
        stampDutyPercent: '0.5',
        payoffCashPercent: '12.0',
        payoffBuyoutPercent: '15.0',
        lifeInsurancePercent: '0.5',
        latePaymentFeePercent: '4.0',
        lifeInsuranceMandatory: false,
      },
    }),
  },
  {
    programCode: 'NATIONAL-CAR-C483',
    sheet: SOURCE,
    estimated: [],
    dto: {
      programCode: 'NATIONAL-CAR-C483',
      bankName: 'National Bank of Egypt',
      friendlyName: 'NBE AUTO LOAN',
      friendlyNameAr: 'شراء سيارة NBE',
      programNameKey: 'car_buyers_program',
      programType: 'income_surrogate',
      productCategory: 'car',
      isShariaCompliant: false,
      plansSource: 'own',
      requiredDocuments: ['NATIONAL_ID_FRONT', 'tax_card', 'commercial_register', 'bank_statement'],
      tenor: {
        maxMonths: 24,
        minMonths: 6,
        maxMonthsByFact: NATIONAL.maxMonthsByFact as FactGridDto,
      },
      loanLimits: {
        maxAmountEGP: '2000000',
        minAmountEGP: '50000',
        minAmountByFact: {
          axes: [
            {
              factKey: 'car_down_payment_percent',
            },
          ],
          cells: [
            {
              keys: [
                {
                  toExclusive: '30',
                  fromInclusive: '20',
                },
              ],
              value: '1000000',
            },
          ],
          onNoMatch: 'useFallback',
        },
        ltvCeilingByFact: {
          axes: [
            {
              factKey: 'car_down_payment_percent',
            },
            {
              factKey: 'home_ownership',
            },
          ],
          cells: [
            {
              keys: [
                {
                  toExclusive: '20',
                  fromInclusive: '10',
                },
                null,
              ],
              value: '80',
            },
            {
              keys: [
                {
                  toExclusive: '30',
                  fromInclusive: '20',
                },
                {
                  key: 'owned_by_me',
                },
              ],
              value: '80',
            },
            {
              keys: [
                {
                  toExclusive: '30',
                  fromInclusive: '20',
                },
                {
                  key: 'owned_by_relative',
                },
              ],
              value: '80',
            },
            {
              keys: [
                {
                  toExclusive: '40',
                  fromInclusive: '30',
                },
                null,
              ],
              value: '70',
            },
            {
              keys: [
                {
                  toExclusive: '50',
                  fromInclusive: '40',
                },
                null,
              ],
              value: '60',
            },
            {
              keys: [
                {
                  toExclusive: '60',
                  fromInclusive: '50',
                },
                null,
              ],
              value: '50',
            },
            {
              keys: [
                {
                  toExclusive: null,
                  fromInclusive: '60',
                },
                null,
              ],
              value: '40',
            },
          ],
          onNoMatch: 'reject',
        },
      },
      pricing: {
        rateBasis: 'reducing',
        rateByFact: NATIONAL.rateByFact as FactGridDto,
        isVariableRate: false,
        baseRatePercent: '9',
      },
      eligibility: {
        ageMax: 60,
        ageMin: 21,
        requiresCD: false,
        skipDbrCheck: false,
        dbrCapPercent: '50.0',
        minMonthsInJob: 6,
        requiresCollateral: false,
        minMonthlyIncomeEGP: '5000',
        requiresNoDocuments: false,
        requiresExistingLoan: false,
        acceptedTransferTypes: ['payroll', 'salary_transfer_letter', 'income_transfer_letter'],
        requiresAutoLoanAtABK: false,
        requiresClubMembership: false,
        acceptedEmploymentTypes: ['salaried'],
        requiresCompoundProperty: false,
        requiresFRMUVerification: false,
        requiresQualitativeReview: false,
        requiresAutoLoanAtOtherBank: false,
        requiresCreditCardAtOtherBank: false,
      },
      incomeAssumption: rule({
        wayId: 'primary',
        amounts: 'own',
        strategy: PRODUCT_RULE_STRATEGY,
        stepParams: {
          primary: {
            scalar: {
              unit: 'multiplier',
              value: '3.6',
            },
          },
        },
      }),
      fees: {
        adminFeePercent: '1.0',
        stampDutyPercent: '0.5',
        payoffCashPercent: '12.0',
        payoffBuyoutPercent: '15.0',
        lifeInsurancePercent: '0.5',
        latePaymentFeePercent: '4.0',
        carInsuranceRateByFact: NATIONAL.carInsuranceRateByFact as FactGridDto,
        lifeInsuranceMandatory: false,
      },
    },
  },
];
