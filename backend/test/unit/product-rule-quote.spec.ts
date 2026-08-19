/**
 * A collateral product through the WHOLE money path — the four banks of the source
 * design, quoted by `quoteProgram`.
 *
 * `ceiling-identity.spec.ts` pins the arithmetic in isolation. This file pins the wiring:
 * that a ceiling clamps the program maximum, that the applicable DBR cap is resolved
 * against the IMPLIED income rather than against zero, that a gate refusal and a missing
 * answer come back as stated reasons with the program still listed, and that the ceiling
 * is reported so the offer can freeze it.
 *
 * Fees are left at zero throughout, deliberately: the source design's golden figures were
 * produced with no fee schedule, so a fee here would make the comparison say nothing.
 */

import { Decimal } from '@prisma/client/runtime/library';
import { describe, expect, it } from 'vitest';
import { quoteProgram } from '../../src/matching/pipeline/quote';
import { PRODUCT_RULE_STRATEGY } from '../../src/matching/types';
import type {
  ApplicantProfile,
  BankProgramSnapshot,
  IncomeAssumptionConfig,
  Quote,
  QuoteOutcome,
  SurrogateFactValue,
} from '../../src/matching/types';
import { eligibilityFixture, profileFixture, programFixture } from '../helpers/matching';

function expectQuoted(outcome: QuoteOutcome): Quote {
  if (!outcome.ok) throw new Error(`expected a quote, got ${outcome.unavailable.reason}`);
  return outcome.quote;
}

/** The compound pipeline, in the shape the catalog states it plus one bank's figures. */
function compoundRule(args: {
  capByType?: Array<{ key: string; incomeEGP: string }>;
  upliftPercent?: string;
  amountMaxEGP?: string;
  minDownPaymentEGP?: string;
  baselineDbrPercent?: string;
}): IncomeAssumptionConfig {
  return {
    strategy: PRODUCT_RULE_STRATEGY,
    steps: [
      { id: 'price', op: 'factNumber', fact: 'compound_unit_price' },
      { id: 'dpPct', op: 'factNumber', fact: 'compound_dp_percent' },
      { id: 'dpAmount', op: 'percentOf', of: [{ step: 'price' }, { step: 'dpPct' }] },
      { id: 'capByType', op: 'factChoiceTable', fact: 'compound_unit_type' },
      { id: 'uplifted', op: 'upliftPercent', of: { step: 'capByType' } },
      { id: 'amountMax', op: 'constant' },
      { id: 'ceiling', op: 'minOf', of: [{ step: 'uplifted' }, { step: 'amountMax' }] },
    ],
    gates: [
      {
        id: 'dpFloor',
        kind: 'number',
        op: 'gte',
        left: { step: 'dpAmount' },
        reasonCode: 'DOWN_PAYMENT_BELOW_MIN',
      },
    ],
    output: {
      kind: 'maxAmount',
      from: 'ceiling',
      ...(args.baselineDbrPercent !== undefined
        ? { baselineDbrPercent: args.baselineDbrPercent }
        : { baselineDbrPercent: '50' }),
    },
    stepParams: {
      // No figure for `dpAmount`: it is price × the percentage the CUSTOMER stated, and
      // the bank's only say is the floor that amount must clear.
      capByType: {
        keyTable: args.capByType ?? [
          { key: 'apartment', incomeEGP: '2000000' },
          { key: 'villa', incomeEGP: '4000000' },
        ],
      },
      uplifted: { scalar: { value: args.upliftPercent ?? '0', unit: 'percent' } },
      amountMax: { valueEGP: args.amountMaxEGP ?? '4500000' },
      dpFloor: { minValue: args.minDownPaymentEGP ?? '0' },
    },
  };
}

function compoundProgram(over: {
  rule?: IncomeAssumptionConfig;
  ratePercent?: string;
  maxAmountEGP?: string;
  minAmountEGP?: string;
  dbrCapPercent?: string;
}): BankProgramSnapshot {
  return programFixture({
    programType: 'income_surrogate',
    pricing: { isVariableRate: false, baseRatePercent: over.ratePercent ?? '25.5000' },
    loanLimits: {
      minAmountEGP: over.minAmountEGP ?? '15000',
      maxAmountEGP: over.maxAmountEGP ?? '4500000',
    },
    tenor: { minMonths: 12, maxMonths: 84 },
    eligibility: eligibilityFixture({ dbrCapPercent: over.dbrCapPercent ?? '50.0000' }),
    incomeAssumption: over.rule ?? compoundRule({}),
  });
}

const num = (v: string): SurrogateFactValue => ({ kind: 'numeric', value: new Decimal(v) });
const pick = (code: string): SurrogateFactValue => ({ kind: 'choice', optionCode: code });

/** The source design's baseline applicant: 3 000 000 unit, 20% paid, 5 years, no debts. */
function compoundApplicant(over: {
  obligationsEGP?: string;
  facts?: Record<string, SurrogateFactValue>;
  requestedEGP?: string;
} = {}): ApplicantProfile {
  return profileFixture({
    requestedAmountEGP: new Decimal(over.requestedEGP ?? '4500000'),
    preferredTenorMonths: 60,
    employment: {
      employmentType: 'salaried',
      // ZERO. A collateral product asks about the unit, not the payslip — and a salary
      // here would prove nothing about where the figure came from.
      monthlyNetSalaryEGP: new Decimal('0'),
      monthsInJob: 48,
      salaryTransferType: 'payroll_cat_a',
      companyName: 'Acme',
      companyType: 'private',
    },
    obligations: {
      existingMonthlyObligationsEGP: new Decimal(over.obligationsEGP ?? '0'),
      hasCurrentLoan: over.obligationsEGP !== undefined,
      hasPreviousRejection: false,
    },
    surrogateFacts: over.facts ?? {
      compound_unit_price: num('3000000'),
      compound_dp_percent: num('20'),
      compound_unit_type: pick('apartment'),
    },
  });
}

describe('collateral ceiling through quoteProgram', () => {
  it('prices off the unit with no payslip at all, and reports the ceiling', () => {
    const quote = expectQuoted(
      quoteProgram({ profile: compoundApplicant(), program: compoundProgram({}) }),
    );

    expect(quote.collateralCeilingEGP?.toString()).toBe('2000000');
    // The income the pipeline never asked for, derived from what the unit supports.
    expect(quote.recognisedIncomeEGP.greaterThan(0)).toBe(true);
    expect(quote.incomeResolution?.origin).toBe('ceiling');
    // Lossless: no obligations and cap == baseline, so the ceiling comes back whole.
    expect(quote.maxAffordableAmountEGP.toString()).toBe('2000000');
    // The ask was 4 500 000; the unit is what cut it, not the program maximum.
    expect(quote.bindingConstraint).toBe('collateral_ceiling');
    expect(quote.offeredAmountEGP.toString()).toBe('2000000');
  });

  it('reproduces the source design’s four banks (table A, then B)', () => {
    const BANKS = [
      { bank: 'ABK', capEGP: '2000000', rate: '25.5000', uplift: '0', maxLoanB: 1662677 },
      { bank: 'EGBank', capEGP: '2000000', rate: '25.0000', uplift: '0', maxLoanB: 1659300 },
      { bank: 'FABMISR', capEGP: '1000000', rate: '25.0000', uplift: '0', maxLoanB: 659300 },
      { bank: 'CAE', capEGP: '300000', rate: '25.0000', uplift: '0', maxLoanB: 0 },
    ] as const;

    for (const { bank, capEGP, rate, uplift, maxLoanB } of BANKS) {
      const program = compoundProgram({
        ratePercent: rate,
        rule: compoundRule({
          capByType: [{ key: 'apartment', incomeEGP: capEGP }],
          upliftPercent: uplift,
          amountMaxEGP: '6000000',
        }),
        // A floor of 15 000 would refuse CAE's zero answer; the source design's own
        // `amount_min` per bank is exercised in its own case below.
        minAmountEGP: '0',
      });

      const noDebts = expectQuoted(quoteProgram({ profile: compoundApplicant(), program }));
      expect(noDebts.maxAffordableAmountEGP.toString(), `${bank} table A`).toBe(
        new Decimal(capEGP).toString(),
      );

      const withDebts = quoteProgram({
        profile: compoundApplicant({ obligationsEGP: '10000' }),
        program,
      });
      if (maxLoanB === 0) {
        // CAE's ceiling implies an instalment of 8 805 a month, which a 10 000 obligation
        // consumes outright. "You can borrow nothing" is an explainable answer, not an error.
        expect(withDebts.ok, `${bank} table B`).toBe(false);
        if (!withDebts.ok) {
          expect(withDebts.unavailable.reason).toBe('OBLIGATIONS_EXCEED_ALLOWANCE');
          expect(withDebts.unavailable.maxAffordableAmountEGP?.toString()).toBe('0');
        }
        continue;
      }
      const quoted = expectQuoted(withDebts);
      const drift = quoted.maxAffordableAmountEGP.minus(maxLoanB).abs();
      expect(drift.lessThanOrEqualTo(new Decimal('1')), `${bank} drift ${drift}`).toBe(true);
    }
  });

  it('haircuts the ceiling when the applicable cap is tighter than the baseline (CAE self-employed)', () => {
    const program = compoundProgram({
      ratePercent: '25.0000',
      dbrCapPercent: '40.0000',
      rule: compoundRule({
        capByType: [{ key: 'apartment', incomeEGP: '2000000' }],
        baselineDbrPercent: '50',
      }),
    });
    const quote = expectQuoted(quoteProgram({ profile: compoundApplicant(), program }));
    // 40 ÷ 50 = 0.8 of the ceiling, with no setting for the ratio itself.
    expect(quote.maxAffordableAmountEGP.toString()).toBe('1600000');
    expect(quote.dbrCapPercent.toFixed(0)).toBe('40');
  });

  it('applies the multi-unit uplift inside the ceiling', () => {
    const program = compoundProgram({
      rule: compoundRule({
        capByType: [{ key: 'apartment', incomeEGP: '2000000' }],
        upliftPercent: '10',
      }),
    });
    const quote = expectQuoted(quoteProgram({ profile: compoundApplicant(), program }));
    expect(quote.collateralCeilingEGP?.toString()).toBe('2200000');
  });

  it('clamps the ceiling to the bank’s own amount maximum', () => {
    const program = compoundProgram({
      rule: compoundRule({
        capByType: [{ key: 'villa', incomeEGP: '4000000' }],
        amountMaxEGP: '3000000',
      }),
    });
    const quote = expectQuoted(
      quoteProgram({
        profile: compoundApplicant({
          facts: {
            compound_unit_price: num('9000000'),
            compound_dp_percent: num('20'),
            compound_unit_type: pick('villa'),
          },
        }),
        program,
      }),
    );
    expect(quote.collateralCeilingEGP?.toString()).toBe('3000000');
  });

  it('reports BELOW_PROGRAM_MIN_AMOUNT when the ceiling leaves less than the bank lends', () => {
    const outcome = quoteProgram({
      profile: compoundApplicant({ obligationsEGP: '10000' }),
      program: compoundProgram({
        ratePercent: '25.0000',
        minAmountEGP: '750000',
        rule: compoundRule({ capByType: [{ key: 'apartment', incomeEGP: '1000000' }] }),
      }),
    });
    // FABMISR's own case in the source design: 659 300 against a 750 000 floor.
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.unavailable.reason).toBe('BELOW_PROGRAM_MIN_AMOUNT');
  });
});

describe('a refusal keeps the program listed and says why', () => {
  it('a failed gate returns PRODUCT_RULE_GATE_FAILED with its reason code', () => {
    const outcome = quoteProgram({
      profile: compoundApplicant({
        // 5% of 3 000 000 = 150 000, under a 250 000 floor. The source design's bug #1:
        // its prototype handed this applicant the HIGHEST cap instead of refusing.
        facts: {
          compound_unit_price: num('3000000'),
          compound_dp_percent: num('5'),
          compound_unit_type: pick('apartment'),
        },
      }),
      program: compoundProgram({
        rule: compoundRule({ minDownPaymentEGP: '250000' }),
      }),
    });

    expect(outcome.ok).toBe(false);
    if (!outcome.ok) {
      expect(outcome.unavailable.reason).toBe('PRODUCT_RULE_GATE_FAILED');
      expect(outcome.unavailable.gateReasonCode).toBe('DOWN_PAYMENT_BELOW_MIN');
      expect(outcome.unavailable.gateId).toBe('dpFloor');
    }
  });

  it('a gate uses the DP the customer stated, so 20% of the same unit passes', () => {
    const program = compoundProgram({ rule: compoundRule({ minDownPaymentEGP: '250000' }) });
    expect(quoteProgram({ profile: compoundApplicant(), program }).ok).toBe(true);
  });

  it('an unanswered fact names WHICH answers are missing', () => {
    const outcome = quoteProgram({
      profile: compoundApplicant({ facts: { compound_unit_price: num('3000000') } }),
      program: compoundProgram({}),
    });
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) {
      expect(outcome.unavailable.reason).toBe('SURROGATE_FACT_MISSING');
      expect(outcome.unavailable.missingFactKeys?.sort()).toEqual([
        'compound_dp_percent',
        'compound_unit_type',
      ]);
    }
  });

  it('an answer the bank has no row for is SURROGATE_NO_MATCHING_ROW', () => {
    const outcome = quoteProgram({
      profile: compoundApplicant({
        facts: {
          compound_unit_price: num('3000000'),
          compound_dp_percent: num('20'),
          compound_unit_type: pick('penthouse'),
        },
      }),
      program: compoundProgram({}),
    });
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.unavailable.reason).toBe('SURROGATE_NO_MATCHING_ROW');
  });

  it('a declared salary does NOT rescue a collateral program', () => {
    // The applicant earns 80 000 a month and answered nothing about a unit. An
    // income-based rule would fall back to the salary; a collateral rule must not — the
    // bank has not priced this person's collateral, so there is nothing to lend against.
    const outcome = quoteProgram({
      profile: profileFixture({
        employment: {
          employmentType: 'salaried',
          monthlyNetSalaryEGP: new Decimal('80000'),
          monthsInJob: 48,
          salaryTransferType: 'payroll_cat_a',
          companyName: 'Acme',
          companyType: 'private',
        },
        surrogateFacts: {},
      }),
      program: compoundProgram({}),
    });
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.unavailable.reason).toBe('SURROGATE_FACT_MISSING');
  });
});

describe('a product rule whose answer is an INCOME behaves like any other rule', () => {
  it('lands as a surrogate income, with no ceiling and no amount clamp', () => {
    const rule: IncomeAssumptionConfig = {
      strategy: PRODUCT_RULE_STRATEGY,
      steps: [
        { id: 'patients', op: 'factNumber', fact: 'weekly_patients' },
        { id: 'income', op: 'multiply', of: { step: 'patients' } },
      ],
      output: { kind: 'monthlyIncome', from: 'income' },
      stepParams: { income: { scalar: { value: '400', unit: 'multiplier' } } },
    };
    const quote = expectQuoted(
      quoteProgram({
        profile: compoundApplicant({
          requestedEGP: '300000',
          facts: { weekly_patients: num('60') },
        }),
        program: compoundProgram({ rule, maxAmountEGP: '1000000' }),
      }),
    );

    expect(quote.recognisedIncomeEGP.toString()).toBe('24000');
    expect(quote.incomeResolution?.origin).toBe('surrogate');
    expect(quote.collateralCeilingEGP).toBeUndefined();
    expect(quote.bindingConstraint).not.toBe('collateral_ceiling');
  });
});
