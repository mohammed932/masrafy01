/**
 * The program's maximum loan, keyed by an answer (`loanLimits.maxLoanByFact`).
 *
 * Acceptance tests 21–24 of the surrogate-programs spec, plus the resolver's own edges.
 * What is worth pinning here, in order of how expensive getting it wrong is:
 *
 *   · `onNoMatch` in BOTH directions. An answer with no row must fall to the program's own
 *     maximum, and must never become "no cap" (a quote far above policy) or "cap zero" (a
 *     blank card). Both failures are silent on the screen and only show up on a customer.
 *   · The cap and a same-unit `minOf` agree to the piastre. That is the monotonicity
 *     argument the design rests on; if it ever stops holding, the same bank configured two
 *     legitimate ways quotes two different numbers.
 *   · The second axis. A row naming this applicant's column beats a column-agnostic row,
 *     so a bank can state one shared figure and override one column without deleting it.
 */

import { Decimal } from '@prisma/client/runtime/library';
import { describe, expect, it } from 'vitest';
import { quoteProgram } from '../../src/matching/pipeline/quote';
import { resolveMaxLoanByFact } from '../../src/matching/pipeline/max-loan-by-fact';
import type { MaxLoanByFactConfig } from '../../src/matching/pipeline/max-loan-by-fact';
import type { Quote, QuoteOutcome, SurrogateFactValue } from '../../src/matching/types';
import { profileFixture, programFixture } from '../helpers/matching';
import { validateMaxLoanByFact } from '../../src/bank-programs/validation/max-loan-by-fact.validator';
import type { IncomeRuleValidationContext } from '../../src/bank-programs/validation/income-rule.validator';

function expectQuoted(outcome: QuoteOutcome): Quote {
  if (!outcome.ok) throw new Error(`expected a quote, got ${outcome.unavailable.reason}`);
  return outcome.quote;
}

function expectUnavailable(outcome: QuoteOutcome): string {
  if (outcome.ok) throw new Error('expected no quote, got one');
  return outcome.unavailable.reason;
}

const choice = (optionCode: string): SurrogateFactValue => ({ kind: 'choice', optionCode });
const numeric = (value: string): SurrogateFactValue => ({
  kind: 'numeric',
  value: new Decimal(value),
});

// ---------------------------------------------------------------------------
// The resolver
// ---------------------------------------------------------------------------

describe('resolveMaxLoanByFact', () => {
  const byCity: MaxLoanByFactConfig = {
    factKey: 'clinic_city_tier',
    columnFactKey: 'bank_relationship',
    onNoMatch: 'useProgramMax',
    rows: [
      { rowKey: 'cairo_alex', columnKey: 'ntb', maxAmountEGP: '1500000' },
      { rowKey: 'cairo_alex', columnKey: 'xsell', maxAmountEGP: '2000000' },
      { rowKey: 'other', columnKey: 'ntb', maxAmountEGP: '500000' },
      { rowKey: 'other', columnKey: 'xsell', maxAmountEGP: '750000' },
    ],
  };

  it('reads the cell at the row and the column (ABK 7 Doctors)', () => {
    const cairoNtb = resolveMaxLoanByFact({
      config: byCity,
      facts: { clinic_city_tier: choice('cairo_alex'), bank_relationship: choice('ntb') },
    });
    expect(cairoNtb.matched && cairoNtb.maxAmountEGP.toFixed(2)).toBe('1500000.00');

    // Same applicant, Tanta — the other row of the same table.
    const tantaNtb = resolveMaxLoanByFact({
      config: byCity,
      facts: { clinic_city_tier: choice('other'), bank_relationship: choice('ntb') },
    });
    expect(tantaNtb.matched && tantaNtb.maxAmountEGP.toFixed(2)).toBe('500000.00');
  });

  it('prefers a row naming this column over a column-agnostic one', () => {
    // The shared figure is written once and one column is overridden. Deleting the shared
    // row to override a single column is what this ordering exists to avoid.
    const shared: MaxLoanByFactConfig = {
      factKey: 'property_type',
      columnFactKey: 'bank_relationship',
      onNoMatch: 'useProgramMax',
      rows: [
        { rowKey: 'apartment', maxAmountEGP: '2000000' },
        { rowKey: 'apartment', columnKey: 'xsell', maxAmountEGP: '3000000' },
      ],
    };
    const ntb = resolveMaxLoanByFact({
      config: shared,
      facts: { property_type: choice('apartment'), bank_relationship: choice('ntb') },
    });
    expect(ntb.matched && ntb.maxAmountEGP.toFixed(2)).toBe('2000000.00');
    const xsell = resolveMaxLoanByFact({
      config: shared,
      facts: { property_type: choice('apartment'), bank_relationship: choice('xsell') },
    });
    expect(xsell.matched && xsell.maxAmountEGP.toFixed(2)).toBe('3000000.00');
  });

  it('bands half-open — the FABMISR down-payment brackets', () => {
    // `250K–500K` and `>500K–1M`: exactly 500,000 belongs to the SECOND row.
    const byDownPayment: MaxLoanByFactConfig = {
      factKey: 'down_payment_paid',
      onNoMatch: 'useProgramMax',
      rows: [
        { fromInclusive: '250000', toExclusive: '500000', maxAmountEGP: '750000' },
        { fromInclusive: '500000', toExclusive: '1000000', maxAmountEGP: '1000000' },
        { fromInclusive: '1000000', toExclusive: '1500000', maxAmountEGP: '1250000' },
        { fromInclusive: '1500000', toExclusive: null, maxAmountEGP: '1500000' },
      ],
    };
    const at500k = resolveMaxLoanByFact({
      config: byDownPayment,
      facts: { down_payment_paid: numeric('500000') },
    });
    expect(at500k.matched && at500k.maxAmountEGP.toFixed(2)).toBe('1000000.00');

    const at1_2m = resolveMaxLoanByFact({
      config: byDownPayment,
      facts: { down_payment_paid: numeric('1200000') },
    });
    expect(at1_2m.matched && at1_2m.maxAmountEGP.toFixed(2)).toBe('1250000.00');

    // Below the first edge is NOT a match — the bank prices from 250,000 up.
    const below = resolveMaxLoanByFact({
      config: byDownPayment,
      facts: { down_payment_paid: numeric('100000') },
    });
    expect(below.matched).toBe(false);
  });

  it('reports the two no-match causes separately', () => {
    const unanswered = resolveMaxLoanByFact({ config: byCity, facts: {} });
    expect(unanswered.matched).toBe(false);
    expect(!unanswered.matched && unanswered.reason).toBe('fact_not_answered');

    const answered = resolveMaxLoanByFact({
      config: byCity,
      facts: { clinic_city_tier: choice('sinai'), bank_relationship: choice('ntb') },
    });
    expect(!answered.matched && answered.reason).toBe('no_matching_row');
  });

  it('treats a non-positive or unreadable figure as not configured, never as a cap of zero', () => {
    const zeroed: MaxLoanByFactConfig = {
      factKey: 'school_type',
      onNoMatch: 'useProgramMax',
      rows: [
        { rowKey: 'national', maxAmountEGP: '0' },
        { rowKey: 'international', maxAmountEGP: 'not a number' },
      ],
    };
    expect(
      resolveMaxLoanByFact({ config: zeroed, facts: { school_type: choice('national') } }).matched,
    ).toBe(false);
    expect(
      resolveMaxLoanByFact({ config: zeroed, facts: { school_type: choice('international') } })
        .matched,
    ).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// End to end through quoteProgram
// ---------------------------------------------------------------------------

describe('quoteProgram — the cap keyed by an answer', () => {
  /** A program whose DBR-derived headroom is far above any cap in these tables. */
  const roomyProgram = (maxLoanByFact: MaxLoanByFactConfig) =>
    programFixture({
      bankName: 'ABK Egypt',
      loanLimits: { minAmountEGP: '15000', maxAmountEGP: '3000000', maxLoanByFact },
      fees: { adminFeePercent: '0' },
    });

  /** An applicant who can afford far more than any cap here. */
  const richProfile = (surrogateFacts: Record<string, SurrogateFactValue>) =>
    profileFixture({
      requestedAmountEGP: new Decimal('3000000'),
      employment: {
        employmentType: 'salaried',
        monthlyNetSalaryEGP: new Decimal('120000'),
        monthsInJob: 48,
        salaryTransferType: 'payroll_cat_a',
        companyName: 'Acme',
        companyType: 'private',
      },
      surrogateFacts,
    });

  const doctorsCap: MaxLoanByFactConfig = {
    factKey: 'clinic_city_tier',
    columnFactKey: 'bank_relationship',
    onNoMatch: 'useProgramMax',
    rows: [
      { rowKey: 'cairo_alex', columnKey: 'ntb', maxAmountEGP: '1500000' },
      { rowKey: 'other', columnKey: 'ntb', maxAmountEGP: '500000' },
    ],
  };

  // Test 21 — the mixed case end to end.
  it('caps a Cairo doctor at 1,500,000 and the same doctor in Tanta at 500,000', () => {
    const cairo = expectQuoted(
      quoteProgram({
        profile: richProfile({ clinic_city_tier: choice('cairo_alex') }),
        program: roomyProgram(doctorsCap),
      }),
    );
    expect(cairo.offeredAmountEGP.toFixed(2)).toBe('1500000.00');
    expect(cairo.bindingConstraint).toBe('program_max_by_fact');

    const tanta = expectQuoted(
      quoteProgram({
        profile: richProfile({ clinic_city_tier: choice('other') }),
        program: roomyProgram(doctorsCap),
      }),
    );
    expect(tanta.offeredAmountEGP.toFixed(2)).toBe('500000.00');
  });

  // Test 22 — a cap on a program with no surrogate rule at all.
  it('caps a real-payslip program with no income rule (Arabic SALARIED, CAT B)', () => {
    const capped = expectQuoted(
      quoteProgram({
        profile: richProfile({ company_coding: choice('cat_b') }),
        program: roomyProgram({
          factKey: 'company_coding',
          onNoMatch: 'useProgramMax',
          rows: [
            { rowKey: 'cat_a', maxAmountEGP: '6000000' },
            { rowKey: 'cat_b', maxAmountEGP: '1000000' },
            { rowKey: 'cat_c', maxAmountEGP: '500000' },
          ],
        }),
      }),
    );
    // `programType` is `income_proof` and `incomeAssumption` is `declared` — there is no
    // template to hang a second path on, which is the whole point of test 22.
    expect(capped.offeredAmountEGP.toFixed(2)).toBe('1000000.00');
  });

  // Test 23 — `onNoMatch`, asserted in BOTH failure directions.
  describe('onNoMatch', () => {
    const noRow = { clinic_city_tier: choice('sinai') };

    it('falls back to the program maximum — never to "no cap", never to zero', () => {
      const quote = expectQuoted(
        quoteProgram({
          profile: richProfile(noRow),
          program: roomyProgram({ ...doctorsCap, onNoMatch: 'useProgramMax' }),
        }),
      );
      // Stated as an IDENTITY against the same program with no table at all, which is what
      // "the program's own maximum still applies" actually means. Asserting a literal here
      // would pin whichever ceiling happens to bind for this fixture — the affordability
      // one, as it turns out — and would stop testing the fallback the day the fixture's
      // income moves.
      const asIfNoTable = expectQuoted(
        quoteProgram({
          profile: richProfile(noRow),
          program: programFixture({
            bankName: 'ABK Egypt',
            loanLimits: { minAmountEGP: '15000', maxAmountEGP: '3000000' },
            fees: { adminFeePercent: '0' },
          }),
        }),
      );
      expect(quote.offeredAmountEGP.toFixed(2)).toBe(asIfNoTable.offeredAmountEGP.toFixed(2));
      expect(quote.bindingConstraint).toBe(asIfNoTable.bindingConstraint);

      // Neither of the two silent failures: not zero, and not above the program's ceiling.
      expect(quote.offeredAmountEGP.greaterThan(0)).toBe(true);
      expect(quote.offeredAmountEGP.lessThanOrEqualTo(new Decimal('3000000'))).toBe(true);
      expect(quote.bindingConstraint).not.toBe('program_max_by_fact');
    });

    it('refuses with a stated reason when the bank chose to reject', () => {
      const outcome = quoteProgram({
        profile: richProfile(noRow),
        program: roomyProgram({ ...doctorsCap, onNoMatch: 'reject' }),
      });
      expect(expectUnavailable(outcome)).toBe('NO_MAX_LOAN_FOR_ANSWER');
    });
  });

  // Test 24 — the cap and a same-unit minimum agree to the piastre.
  it('agrees to the piastre with capping the program maximum directly', () => {
    // The monotonicity argument, made concrete: a table row of 1,200,000 and a flat
    // `maxAmountEGP` of 1,200,000 must produce the SAME quote, because `min` commutes with
    // the monotonic income → amount map. If these ever diverge, something downstream has
    // stopped being monotonic.
    const viaTable = expectQuoted(
      quoteProgram({
        profile: richProfile({ property_type: choice('apartment') }),
        program: roomyProgram({
          factKey: 'property_type',
          onNoMatch: 'useProgramMax',
          rows: [{ rowKey: 'apartment', maxAmountEGP: '1200000' }],
        }),
      }),
    );
    const viaFlatMax = expectQuoted(
      quoteProgram({
        profile: richProfile({ property_type: choice('apartment') }),
        program: programFixture({
          bankName: 'ABK Egypt',
          loanLimits: { minAmountEGP: '15000', maxAmountEGP: '1200000' },
          fees: { adminFeePercent: '0' },
        }),
      }),
    );
    expect(viaTable.offeredAmountEGP.toFixed(2)).toBe(viaFlatMax.offeredAmountEGP.toFixed(2));
    expect(viaTable.monthlyInstallmentEGP.toFixed(2)).toBe(
      viaFlatMax.monthlyInstallmentEGP.toFixed(2),
    );
    expect(viaTable.totalPayableEGP.toFixed(2)).toBe(viaFlatMax.totalPayableEGP.toFixed(2));
  });

  it('leaves a program with no cap table exactly as it was', () => {
    const withoutTable = expectQuoted(
      quoteProgram({ profile: profileFixture(), program: programFixture() }),
    );
    expect(withoutTable.offeredAmountEGP.toFixed(2)).toBe('300000.00');
  });

  it('takes the LOWEST ceiling when the flat maximum is lower than the row', () => {
    const quote = expectQuoted(
      quoteProgram({
        profile: richProfile({ property_type: choice('villa') }),
        program: programFixture({
          bankName: 'ABK Egypt',
          fees: { adminFeePercent: '0' },
          loanLimits: {
            minAmountEGP: '15000',
            maxAmountEGP: '900000',
            maxLoanByFact: {
              factKey: 'property_type',
              onNoMatch: 'useProgramMax',
              rows: [{ rowKey: 'villa', maxAmountEGP: '4000000' }],
            },
          },
        }),
      }),
    );
    expect(quote.offeredAmountEGP.toFixed(2)).toBe('900000.00');
    expect(quote.bindingConstraint).toBe('program_max');
  });
});

// ---------------------------------------------------------------------------
// Save-time validation
// ---------------------------------------------------------------------------

describe('validateMaxLoanByFact', () => {
  /**
   * A registry stub with one choice fact and one numeric one, plus the derived
   * `bank_relationship` the validator answers from the engine's own closed list.
   */
  const OPTIONS: Record<string, string[]> = {
    q_city_tier: ['cairo_alex', 'other'],
    q_property_type: ['apartment', 'twin', 'villa'],
  };
  const ctx: IncomeRuleValidationContext = {
    isActiveMember: async () => true,
    activeMembers: async () => [],
    surrogateFacts: async () => [
      { key: 'clinic_city_tier', questionCode: 'q_city_tier', type: 'SINGLE_SELECT' },
      { key: 'property_type', questionCode: 'q_property_type', type: 'SINGLE_SELECT' },
      { key: 'down_payment_paid', questionCode: 'q_down_payment', type: 'NUMERIC' },
    ],
    questionOptionCodes: async (questionCode) => OPTIONS[questionCode] ?? [],
  };

  const reasonOf = async (config: MaxLoanByFactConfig): Promise<string | undefined> =>
    (await validateMaxLoanByFact(config, ctx))?.reason;

  it('accepts a table nothing is wrong with', async () => {
    expect(
      await reasonOf({
        factKey: 'clinic_city_tier',
        columnFactKey: 'bank_relationship',
        onNoMatch: 'useProgramMax',
        rows: [
          { rowKey: 'cairo_alex', columnKey: 'ntb', maxAmountEGP: '1500000' },
          { rowKey: 'other', columnKey: 'ntb', maxAmountEGP: '500000' },
        ],
      }),
    ).toBeUndefined();
  });

  it('accepts an absent table', async () => {
    expect(await validateMaxLoanByFact(undefined, ctx)).toBeUndefined();
  });

  it('refuses a fact the registry cannot serve', async () => {
    expect(
      await reasonOf({
        factKey: 'not_a_fact',
        onNoMatch: 'useProgramMax',
        rows: [{ rowKey: 'x', maxAmountEGP: '1' }],
      }),
    ).toBe('unknown_fact');
  });

  it('refuses rows keyed the wrong way for the fact type', async () => {
    // Bands on a choice fact, and an option code on a numeric one: both match NOTHING at
    // runtime, so both would read as a configured table that caps nobody.
    expect(
      await reasonOf({
        factKey: 'property_type',
        onNoMatch: 'useProgramMax',
        rows: [{ fromInclusive: '0', toExclusive: '10', maxAmountEGP: '1' }],
      }),
    ).toBe('band_on_choice_fact');
    expect(
      await reasonOf({
        factKey: 'down_payment_paid',
        onNoMatch: 'useProgramMax',
        rows: [{ rowKey: 'apartment', maxAmountEGP: '1' }],
      }),
    ).toBe('row_key_on_numeric_fact');
  });

  it('refuses an option code the question does not offer', async () => {
    expect(
      await reasonOf({
        factKey: 'property_type',
        onNoMatch: 'useProgramMax',
        rows: [{ rowKey: 'penthouse', maxAmountEGP: '1' }],
      }),
    ).toBe('unknown_row_key');
  });

  it('accepts the derived bank_relationship codes and refuses anything else in that column', async () => {
    expect(
      await reasonOf({
        factKey: 'property_type',
        columnFactKey: 'bank_relationship',
        onNoMatch: 'useProgramMax',
        rows: [{ rowKey: 'villa', columnKey: 'ntb', maxAmountEGP: '4000000' }],
      }),
    ).toBeUndefined();
    expect(
      await reasonOf({
        factKey: 'property_type',
        columnFactKey: 'bank_relationship',
        onNoMatch: 'useProgramMax',
        rows: [{ rowKey: 'villa', columnKey: 'topup', maxAmountEGP: '4000000' }],
      }),
    ).toBe('unknown_column_key');
  });

  it('refuses a repeated cell — first-match would hide the second row', async () => {
    expect(
      await reasonOf({
        factKey: 'property_type',
        onNoMatch: 'useProgramMax',
        rows: [
          { rowKey: 'villa', maxAmountEGP: '4000000' },
          { rowKey: 'villa', maxAmountEGP: '4500000' },
        ],
      }),
    ).toBe('duplicate_row');
  });

  it('refuses a gap and an overlap in the bands, per column', async () => {
    expect(
      await reasonOf({
        factKey: 'down_payment_paid',
        onNoMatch: 'useProgramMax',
        rows: [
          { fromInclusive: '250000', toExclusive: '500000', maxAmountEGP: '750000' },
          { fromInclusive: '600000', toExclusive: null, maxAmountEGP: '1000000' },
        ],
      }),
    ).toBe('bands_gap');

    expect(
      await reasonOf({
        factKey: 'down_payment_paid',
        onNoMatch: 'useProgramMax',
        rows: [
          { fromInclusive: '250000', toExclusive: '600000', maxAmountEGP: '750000' },
          { fromInclusive: '500000', toExclusive: null, maxAmountEGP: '1000000' },
        ],
      }),
    ).toBe('bands_overlap');

    // Two columns each stating their own run: a gap in one is not a gap in the other, so a
    // per-table check would reject a table that is fine.
    expect(
      await reasonOf({
        factKey: 'down_payment_paid',
        columnFactKey: 'bank_relationship',
        onNoMatch: 'useProgramMax',
        rows: [
          { fromInclusive: '0', toExclusive: '500000', columnKey: 'ntb', maxAmountEGP: '750000' },
          { fromInclusive: '500000', toExclusive: null, columnKey: 'ntb', maxAmountEGP: '1000000' },
          {
            fromInclusive: '0',
            toExclusive: '500000',
            columnKey: 'xsell',
            maxAmountEGP: '1250000',
          },
          {
            fromInclusive: '500000',
            toExclusive: null,
            columnKey: 'xsell',
            maxAmountEGP: '1750000',
          },
        ],
      }),
    ).toBeUndefined();
  });

  it('names the ORIGINAL row number when a band run is filtered by column', async () => {
    const violation = await validateMaxLoanByFact(
      {
        factKey: 'down_payment_paid',
        columnFactKey: 'bank_relationship',
        onNoMatch: 'useProgramMax',
        rows: [
          { fromInclusive: '0', toExclusive: '500000', columnKey: 'ntb', maxAmountEGP: '750000' },
          {
            fromInclusive: '0',
            toExclusive: '500000',
            columnKey: 'xsell',
            maxAmountEGP: '1250000',
          },
          // Row 2 gaps against row 0 — and it is row 2 the operator is looking at.
          { fromInclusive: '600000', toExclusive: null, columnKey: 'ntb', maxAmountEGP: '1000000' },
        ],
      },
      ctx,
    );
    expect(violation?.reason).toBe('bands_gap');
    expect(violation?.index).toBe(2);
  });

  it('refuses a second axis keyed by a number — it has no branches', async () => {
    expect(
      await reasonOf({
        factKey: 'property_type',
        columnFactKey: 'down_payment_paid',
        onNoMatch: 'useProgramMax',
        rows: [{ rowKey: 'villa', maxAmountEGP: '4000000' }],
      }),
    ).toBe('column_fact_not_choice');
  });
});

// ---------------------------------------------------------------------------
// Adjustment scope (§10.4)
// ---------------------------------------------------------------------------

describe('adjustments that act on the cap', () => {
  /**
   * The §10.4 worked case, both ways.
   *
   * A villa owner has paid 20,000,000, the rule gives 15% of that = 3,000,000, and the Villa
   * NTB cap is 4,000,000. The applicant declares a second residential unit, which one ABK
   * line says lifts the figure by 10%.
   *
   *   +10% on both sides   → min(3,300,000 · 4,400,000) = 3,300,000
   *   +10% on the cap only → min(3,000,000 · 4,400,000) = 3,000,000
   *
   * Asserted BOTH ways round, so the scope is pinned by a test rather than by whoever
   * happens to configure the program.
   */
  const villaOwner = profileFixture({
    requestedAmountEGP: new Decimal('5000000'),
    employment: {
      employmentType: 'salaried',
      monthlyNetSalaryEGP: new Decimal('400000'),
      monthsInJob: 48,
      salaryTransferType: 'payroll_cat_a',
      companyName: 'Acme',
      companyType: 'private',
    },
    surrogateFacts: {
      property_type: choice('villa'),
      multi_unit: choice('yes'),
    },
  });

  const abkProgram = (over: {
    maxAmountEGP: string;
    adjustments?: Array<{
      kind: 'upliftPercent' | 'sharePercent';
      percent: string;
      whenFactKey: string;
      whenOptionCode: string;
    }>;
  }) =>
    programFixture({
      bankName: 'ABK Egypt',
      fees: { adminFeePercent: '0' },
      loanLimits: {
        minAmountEGP: '15000',
        maxAmountEGP: '10000000',
        maxLoanByFact: {
          factKey: 'property_type',
          onNoMatch: 'useProgramMax',
          rows: [{ rowKey: 'villa', maxAmountEGP: over.maxAmountEGP }],
        },
        ...(over.adjustments !== undefined ? { maxLoanAdjustments: over.adjustments } : {}),
      },
    });

  it('lifts the cap by 10% when the adjustment is scoped to the cap', () => {
    const quote = expectQuoted(
      quoteProgram({
        profile: villaOwner,
        program: abkProgram({
          maxAmountEGP: '4000000',
          adjustments: [
            {
              kind: 'upliftPercent',
              percent: '10',
              whenFactKey: 'multi_unit',
              whenOptionCode: 'yes',
            },
          ],
        }),
      }),
    );
    expect(quote.offeredAmountEGP.toFixed(2)).toBe('4400000.00');
    expect(quote.bindingConstraint).toBe('program_max_by_fact');
  });

  it('leaves the cap alone when the applicant does not meet the condition', () => {
    const singleUnit = profileFixture({
      ...villaOwner,
      surrogateFacts: { property_type: choice('villa'), multi_unit: choice('no') },
    });
    const quote = expectQuoted(
      quoteProgram({
        profile: singleUnit,
        program: abkProgram({
          maxAmountEGP: '4000000',
          adjustments: [
            {
              kind: 'upliftPercent',
              percent: '10',
              whenFactKey: 'multi_unit',
              whenOptionCode: 'yes',
            },
          ],
        }),
      }),
    );
    expect(quote.offeredAmountEGP.toFixed(2)).toBe('4000000.00');
  });

  it('leaves the cap alone when the fact is unanswered — never "for everyone"', () => {
    const unanswered = profileFixture({
      ...villaOwner,
      surrogateFacts: { property_type: choice('villa') },
    });
    const quote = expectQuoted(
      quoteProgram({
        profile: unanswered,
        program: abkProgram({
          maxAmountEGP: '4000000',
          adjustments: [
            {
              kind: 'upliftPercent',
              percent: '10',
              whenFactKey: 'multi_unit',
              whenOptionCode: 'yes',
            },
          ],
        }),
      }),
    );
    expect(quote.offeredAmountEGP.toFixed(2)).toBe('4000000.00');
  });

  it('halves the cap on joint ownership (FABMISR — 50% of the loan amount)', () => {
    const jointOwner = profileFixture({
      ...villaOwner,
      surrogateFacts: { property_type: choice('villa'), joint_ownership: choice('yes') },
    });
    const quote = expectQuoted(
      quoteProgram({
        profile: jointOwner,
        program: abkProgram({
          maxAmountEGP: '4000000',
          adjustments: [
            {
              kind: 'sharePercent',
              percent: '50',
              whenFactKey: 'joint_ownership',
              whenOptionCode: 'yes',
            },
          ],
        }),
      }),
    );
    expect(quote.offeredAmountEGP.toFixed(2)).toBe('2000000.00');
  });

  it('applies several adjustments in declared order', () => {
    // +10% then 50%: 4,000,000 → 4,400,000 → 2,200,000. Declared order is configuration,
    // because `percentOf` rounds to piastres at every step and rounding does not commute.
    const both = profileFixture({
      ...villaOwner,
      surrogateFacts: {
        property_type: choice('villa'),
        multi_unit: choice('yes'),
        joint_ownership: choice('yes'),
      },
    });
    const quote = expectQuoted(
      quoteProgram({
        profile: both,
        program: abkProgram({
          maxAmountEGP: '4000000',
          adjustments: [
            {
              kind: 'upliftPercent',
              percent: '10',
              whenFactKey: 'multi_unit',
              whenOptionCode: 'yes',
            },
            {
              kind: 'sharePercent',
              percent: '50',
              whenFactKey: 'joint_ownership',
              whenOptionCode: 'yes',
            },
          ],
        }),
      }),
    );
    expect(quote.offeredAmountEGP.toFixed(2)).toBe('2200000.00');
  });

  it('lifts every ceiling the PROGRAM states, flat maximum included', () => {
    // "Program loan amounts can be increased by 10%" means the program's amount, whichever
    // of its own ceilings is currently binding. Here the flat maximum (3,000,000) is lower
    // than the table row (4,000,000), so it is the one that moves.
    const quote = expectQuoted(
      quoteProgram({
        profile: villaOwner,
        program: programFixture({
          bankName: 'ABK Egypt',
          fees: { adminFeePercent: '0' },
          loanLimits: {
            minAmountEGP: '15000',
            maxAmountEGP: '3000000',
            maxLoanByFact: {
              factKey: 'property_type',
              onNoMatch: 'useProgramMax',
              rows: [{ rowKey: 'villa', maxAmountEGP: '4000000' }],
            },
            maxLoanAdjustments: [
              {
                kind: 'upliftPercent',
                percent: '10',
                whenFactKey: 'multi_unit',
                whenOptionCode: 'yes',
              },
            ],
          },
        }),
      }),
    );
    expect(quote.offeredAmountEGP.toFixed(2)).toBe('3300000.00');
  });

  it('cannot lift the amount past what the applicant can afford', () => {
    // The other half of the ordering rule: an adjustment on the CAP moves a ceiling, and a
    // ceiling is only ever one of the values the final amount is the minimum of. A poor
    // applicant with a generous cap is still bound by the debt-burden check.
    const modestIncome = profileFixture({
      requestedAmountEGP: new Decimal('5000000'),
      surrogateFacts: { property_type: choice('villa'), multi_unit: choice('yes') },
    });
    const withUplift = expectQuoted(
      quoteProgram({
        profile: modestIncome,
        program: abkProgram({
          maxAmountEGP: '4000000',
          adjustments: [
            {
              kind: 'upliftPercent',
              percent: '10',
              whenFactKey: 'multi_unit',
              whenOptionCode: 'yes',
            },
          ],
        }),
      }),
    );
    const withoutUplift = expectQuoted(
      quoteProgram({
        profile: modestIncome,
        program: abkProgram({ maxAmountEGP: '4000000' }),
      }),
    );
    expect(withUplift.bindingConstraint).toBe('dbr_affordability');
    expect(withUplift.offeredAmountEGP.toFixed(2)).toBe(withoutUplift.offeredAmountEGP.toFixed(2));
  });
});
