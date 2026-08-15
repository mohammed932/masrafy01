import { Decimal } from '@prisma/client/runtime/library';
import { describe, expect, it } from 'vitest';
import { quoteProgram } from '../../src/matching/pipeline/quote';
import type { DbrBand, Quote, QuoteOutcome } from '../../src/matching/types';
import { eligibilityFixture, profileFixture, programFixture } from '../helpers/matching';

/** Narrow to the success arm, failing loudly with the reason when it isn't. */
function expectQuoted(outcome: QuoteOutcome): Quote {
  if (!outcome.ok) {
    throw new Error(`expected a quote, got ${outcome.unavailable.reason}`);
  }
  return outcome.quote;
}

function expectUnavailable(outcome: QuoteOutcome): string {
  if (outcome.ok) throw new Error('expected no quote, got one');
  return outcome.unavailable.reason;
}

describe('quoteProgram', () => {
  describe('money identities (FR-022a)', () => {
    it('holds every identity with fees financed into the principal', () => {
      const quote = expectQuoted(
        quoteProgram({
          profile: profileFixture(),
          program: programFixture({ fees: { adminFeePercent: '1.5000' } }),
        }),
      );

      // cashToCustomer = offered − fees. The gap between "the loan" and "the
      // money that lands in the account" is exactly the financed fees.
      expect(quote.cashToCustomerEGP.toFixed(2)).toBe(
        quote.offeredAmountEGP.minus(quote.totalFeesEGP).toFixed(2),
      );
      // The customer asked for 300 000 and receives 300 000; the bank books more.
      expect(quote.cashToCustomerEGP.toFixed(2)).toBe('300000.00');
      expect(quote.offeredAmountEGP.greaterThan(quote.cashToCustomerEGP)).toBe(true);
      expect(quote.totalFeesEGP.toFixed(2)).toBe('4500.00');

      expect(quote.totalPayableEGP.toFixed(2)).toBe(
        quote.monthlyInstallmentEGP.mul(quote.effectiveTenorMonths).toFixed(2),
      );
      expect(quote.totalCostOfCreditEGP.toFixed(2)).toBe(
        quote.totalPayableEGP.minus(quote.cashToCustomerEGP).toFixed(2),
      );
    });

    it('computes the installment on the fee-inflated principal, not the ask', () => {
      const withoutFees = expectQuoted(
        quoteProgram({ profile: profileFixture(), program: programFixture() }),
      );
      const withFees = expectQuoted(
        quoteProgram({
          profile: profileFixture(),
          program: programFixture({ fees: { adminFeePercent: '5.0000' } }),
        }),
      );
      expect(withFees.monthlyInstallmentEGP.greaterThan(withoutFees.monthlyInstallmentEGP)).toBe(
        true,
      );
      expect(withFees.cashToCustomerEGP.toFixed(2)).toBe(withoutFees.cashToCustomerEGP.toFixed(2));
    });
  });

  describe('stamp duty', () => {
    // Regression: `fees.ts` read `stampDutyEGP` while every writer set
    // `stampDutyPercent`, so stamp duty was 0.00 on every offer ever produced.
    it('charges a percent-configured stamp duty', () => {
      const quote = expectQuoted(
        quoteProgram({
          profile: profileFixture(),
          program: programFixture({ fees: { adminFeePercent: '0', stampDutyPercent: '0.5000' } }),
        }),
      );
      expect(quote.feesBreakdown.stampDutyEGP).toBe('1500.00');
      expect(quote.totalFeesEGP.toFixed(2)).toBe('1500.00');
    });

    it('adds a flat and a percent stamp duty together', () => {
      const quote = expectQuoted(
        quoteProgram({
          profile: profileFixture(),
          program: programFixture({
            fees: { adminFeePercent: '0', stampDutyEGP: '50', stampDutyPercent: '0.5000' },
          }),
        }),
      );
      expect(quote.feesBreakdown.stampDutyEGP).toBe('1550.00');
    });

    it('charges nothing when neither key is set', () => {
      const quote = expectQuoted(
        quoteProgram({ profile: profileFixture(), program: programFixture() }),
      );
      expect(quote.feesBreakdown.stampDutyEGP).toBe('0.00');
    });
  });

  describe('binding constraint (FR-023)', () => {
    it('reports requested_amount when nothing reduced the ask', () => {
      const quote = expectQuoted(
        quoteProgram({ profile: profileFixture(), program: programFixture() }),
      );
      expect(quote.bindingConstraint).toBe('requested_amount');
    });

    it('reports program_max and clamps the amount down', () => {
      const quote = expectQuoted(
        quoteProgram({
          profile: profileFixture(),
          program: programFixture({
            loanLimits: { minAmountEGP: '10000', maxAmountEGP: '100000' },
          }),
        }),
      );
      expect(quote.bindingConstraint).toBe('program_max');
      expect(quote.cashToCustomerEGP.toFixed(2)).toBe('100000.00');
    });

    // A modest ask, so the shortened term stays well inside the DBR cap and the
    // tenor constraint is the only one in play. At the default 300 000 ask a
    // shorter term raises the installment enough for DBR to bind first — which
    // is correct behaviour, and is covered by the precedence test below.
    const modest = { requestedAmountEGP: new Decimal('100000') };

    it('reports tenor_max and shortens the term', () => {
      const quote = expectQuoted(
        quoteProgram({
          profile: profileFixture({ ...modest, preferredTenorMonths: 120 }),
          program: programFixture({ tenor: { minMonths: 6, maxMonths: 36 } }),
        }),
      );
      expect(quote.bindingConstraint).toBe('tenor_max');
      expect(quote.effectiveTenorMonths).toBe(36);
    });

    // Regression: the questionnaire lets any applicant ask for 6 months while
    // every personal program floors at 12, and a below-floor term used to drop
    // the program entirely (reported as AGE_AT_MATURITY). A whole shortlist —
    // "personal + Doctor Loans, 6 months" — came back empty.
    it('reports tenor_min and stretches a below-floor term up to the program minimum', () => {
      const quote = expectQuoted(
        quoteProgram({
          profile: profileFixture({ ...modest, preferredTenorMonths: 6 }),
          program: programFixture({ tenor: { minMonths: 12, maxMonths: 84 } }),
        }),
      );
      expect(quote.bindingConstraint).toBe('tenor_min');
      expect(quote.effectiveTenorMonths).toBe(12);
    });

    it('reports age_at_maturity — the loan must end before the age ceiling', () => {
      const quote = expectQuoted(
        quoteProgram({
          profile: profileFixture({ ...modest, age: 58, preferredTenorMonths: 60 }),
          program: programFixture({ eligibility: eligibilityFixture({ maxAge: 60 }) }),
        }),
      );
      expect(quote.bindingConstraint).toBe('age_at_maturity');
      expect(quote.effectiveTenorMonths).toBe(24);
    });

    it('reports dbr_affordability when a shortened term pushes the installment over the cap', () => {
      // Same 300 000 ask that fits at 60 months does not fit at 36: the term
      // shortened AND the amount had to come down, so the amount wins.
      const quote = expectQuoted(
        quoteProgram({
          profile: profileFixture({ preferredTenorMonths: 120 }),
          program: programFixture({ tenor: { minMonths: 6, maxMonths: 36 } }),
        }),
      );
      expect(quote.bindingConstraint).toBe('dbr_affordability');
      expect(quote.effectiveTenorMonths).toBe(36);
      expect(quote.dbrPercent.lessThanOrEqualTo(quote.dbrCapPercent)).toBe(true);
    });

    it('reports the amount reduction when an amount and a tenor cap both apply', () => {
      // Amount reductions outrank tenor reductions: a cut amount is the bigger
      // surprise, so that is what the customer is told about.
      const quote = expectQuoted(
        quoteProgram({
          profile: profileFixture({ preferredTenorMonths: 120 }),
          program: programFixture({
            tenor: { minMonths: 6, maxMonths: 36 },
            loanLimits: { minAmountEGP: '10000', maxAmountEGP: '100000' },
          }),
        }),
      );
      expect(quote.bindingConstraint).toBe('program_max');
      expect(quote.effectiveTenorMonths).toBe(36);
    });
  });

  describe('DBR affordability (FR-022b)', () => {
    const squeezed = profileFixture({
      obligations: {
        existingMonthlyObligationsEGP: new Decimal('5000'),
        hasCurrentLoan: true,
        hasPreviousRejection: false,
      },
    });

    it('reduces the amount and reports dbr_affordability', () => {
      const quote = expectQuoted(quoteProgram({ profile: squeezed, program: programFixture() }));
      expect(quote.bindingConstraint).toBe('dbr_affordability');
      expect(quote.cashToCustomerEGP.lessThan(300000)).toBe(true);
    });

    it('never presents a quote that breaks its own cap, even with steep fees', () => {
      // The whole reason the reduction iterates: `calculateMaxLoanFromDbr`
      // inverts the annuity on the principal, but the installment is computed
      // on principal + financed fees, so a single pass lands back over the cap.
      for (const adminFeePercent of ['0', '1.0000', '5.0000', '10.0000']) {
        const quote = expectQuoted(
          quoteProgram({
            profile: squeezed,
            program: programFixture({ fees: { adminFeePercent } }),
          }),
        );
        expect(
          quote.dbrPercent.lessThanOrEqualTo(quote.dbrCapPercent),
          `admin fee ${adminFeePercent}%: DBR ${quote.dbrPercent} exceeds cap ${quote.dbrCapPercent}`,
        ).toBe(true);
      }
    });

    it('reports the DBR of the installment actually offered', () => {
      const quote = expectQuoted(
        quoteProgram({
          profile: squeezed,
          program: programFixture({ fees: { adminFeePercent: '5.0000' } }),
        }),
      );
      const recomputed = quote.monthlyInstallmentEGP
        .plus(squeezed.obligations.existingMonthlyObligationsEGP)
        .mul(100)
        .div(quote.recognisedIncomeEGP)
        .toDecimalPlaces(2, Decimal.ROUND_HALF_EVEN);
      expect(quote.dbrPercent.toFixed(2)).toBe(recomputed.toFixed(2));
    });

    it('leaves the amount alone when the program skips the DBR check', () => {
      const quote = expectQuoted(
        quoteProgram({
          profile: squeezed,
          program: programFixture({ eligibility: eligibilityFixture({ skipDbrCheck: true }) }),
        }),
      );
      expect(quote.bindingConstraint).toBe('requested_amount');
      expect(quote.cashToCustomerEGP.toFixed(2)).toBe('300000.00');
    });

    it('leaves the amount alone on the apply path (skipDbrCheck input)', () => {
      const quote = expectQuoted(
        quoteProgram({ profile: squeezed, program: programFixture(), skipDbrCheck: true }),
      );
      expect(quote.cashToCustomerEGP.toFixed(2)).toBe('300000.00');
      // The ratio is still reported — it is just not used to reject or reduce.
      expect(quote.dbrPercent.greaterThan(quote.dbrCapPercent)).toBe(true);
    });
  });

  describe('banded DBR (FR-016 … FR-018)', () => {
    const BANDS: DbrBand[] = [
      { upToIncomeEGP: '10000', capPercent: '35.0000' },
      { upToIncomeEGP: '20000', capPercent: '40.0000' },
      { upToIncomeEGP: null, capPercent: '50.0000' },
    ];

    it('resolves the band from recognised income and records it on the quote', () => {
      const quote = expectQuoted(
        quoteProgram({
          profile: profileFixture(),
          program: programFixture({ eligibility: eligibilityFixture({ dbrBands: BANDS }) }),
        }),
      );
      expect(quote.recognisedIncomeEGP.toFixed(2)).toBe('20000.00');
      expect(quote.dbrCapPercent.toFixed(4)).toBe('40.0000');
      expect(quote.dbrBandIndex).toBe(1);
    });

    it('bands against the DECLARED salary, ignoring the income assumption', () => {
      // Declared 20 400 sits in the ≤30 000 band (45%). The program's 85%
      // assumption would pull it to 17 340 and the ≤20 000 band (40%) — the
      // customer-facing figures deliberately do not apply that haircut, so two
      // screens quoting the same salary can never disagree.
      const quote = expectQuoted(
        quoteProgram({
          profile: profileFixture({
            employment: {
              employmentType: 'salaried',
              monthlyNetSalaryEGP: new Decimal('20400'),
              monthsInJob: 48,
              salaryTransferType: 'payroll_cat_a',
              companyName: 'Acme',
              companyType: 'private',
              bankCategory: 'commercial',
            },
          }),
          program: programFixture({
            eligibility: eligibilityFixture({
              dbrBands: [
                { upToIncomeEGP: '10000', capPercent: '35.0000' },
                { upToIncomeEGP: '20000', capPercent: '40.0000' },
                { upToIncomeEGP: '30000', capPercent: '45.0000' },
                { upToIncomeEGP: null, capPercent: '50.0000' },
              ],
              commercialBankIncomePercent: '85',
            }),
          }),
        }),
      );
      expect(quote.recognisedIncomeEGP.toFixed(2)).toBe('20400.00');
      expect(quote.dbrCapPercent.toFixed(4)).toBe('45.0000');
      expect(quote.dbrBandIndex).toBe(2);
    });

    it('falls back to the income assumption when no salary was declared', () => {
      // `income_surrogate` programs: the applicant declares no salary, so the
      // figure comes from the surrogate instead of failing NO_RECOGNISED_INCOME.
      const quote = expectQuoted(
        quoteProgram({
          profile: profileFixture({
            employment: {
              employmentType: 'self_employed',
              monthlyNetSalaryEGP: new Decimal('0'),
              monthsInJob: 48,
              salaryTransferType: 'payroll_cat_a',
              companyName: 'Acme',
              companyType: 'private',
            },
            assets: { creditCardLimitEGP: new Decimal('200000') },
          }),
          program: programFixture({
            incomeAssumption: { strategy: 'byCreditCardLimit', creditCardLimitMultiplier: '0.1' },
          }),
        }),
      );
      expect(quote.recognisedIncomeEGP.toFixed(2)).toBe('20000.00');
    });

    it('reports the scalar cap with a null band index when no table is set', () => {
      const quote = expectQuoted(
        quoteProgram({ profile: profileFixture(), program: programFixture() }),
      );
      expect(quote.dbrCapPercent.toFixed(4)).toBe('50.0000');
      expect(quote.dbrBandIndex).toBeNull();
    });
  });

  describe('figures unavailable (FR-024 — the program is still listed)', () => {
    it('NO_RECOGNISED_INCOME — never a zero installment', () => {
      expect(
        expectUnavailable(
          quoteProgram({
            profile: profileFixture({
              employment: {
                employmentType: 'salaried',
                monthlyNetSalaryEGP: new Decimal('0'),
                monthsInJob: 48,
                salaryTransferType: 'payroll_cat_a',
                companyName: 'Acme',
                companyType: 'private',
              },
            }),
            program: programFixture(),
          }),
        ),
      ).toBe('NO_RECOGNISED_INCOME');
    });

    it('PROGRAM_MISCONFIGURED names the offending path', () => {
      const outcome = quoteProgram({
        profile: profileFixture(),
        program: programFixture({
          loanLimits: { minAmountEGP: '10000', maxAmountEGP: '0' },
        }),
      });
      expect(outcome.ok).toBe(false);
      if (outcome.ok) return;
      expect(outcome.unavailable.reason).toBe('PROGRAM_MISCONFIGURED');
      expect(outcome.unavailable.missing).toContain('loanLimits.maxAmountEGP');
    });

    it('AGE_AT_MATURITY when the term cannot reach the program minimum', () => {
      expect(
        expectUnavailable(
          quoteProgram({
            profile: profileFixture({ age: 58 }),
            program: programFixture({
              tenor: { minMonths: 36, maxMonths: 84 },
              eligibility: eligibilityFixture({ maxAge: 60 }),
            }),
          }),
        ),
      ).toBe('AGE_AT_MATURITY');
    });

    it('OBLIGATIONS_EXCEED_ALLOWANCE when there is no room under the cap', () => {
      expect(
        expectUnavailable(
          quoteProgram({
            profile: profileFixture({
              obligations: {
                existingMonthlyObligationsEGP: new Decimal('15000'),
                hasCurrentLoan: true,
                hasPreviousRejection: false,
              },
            }),
            program: programFixture(),
          }),
        ),
      ).toBe('OBLIGATIONS_EXCEED_ALLOWANCE');
    });

    it('BELOW_PROGRAM_MIN_AMOUNT when affordability lands under the floor', () => {
      expect(
        expectUnavailable(
          quoteProgram({
            profile: profileFixture({
              obligations: {
                existingMonthlyObligationsEGP: new Decimal('9700'),
                hasCurrentLoan: true,
                hasPreviousRejection: false,
              },
            }),
            program: programFixture({
              loanLimits: { minAmountEGP: '200000', maxAmountEGP: '1000000' },
            }),
          }),
        ),
      ).toBe('BELOW_PROGRAM_MIN_AMOUNT');
    });
  });
});
