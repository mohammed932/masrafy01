/**
 * Switching a no-payslip PRODUCT off stops every program that quotes from it — and does so
 * as a stated reason, not as a missing rule.
 *
 * THE REGRESSION THIS FILE EXISTS FOR is the first test below. The obvious way to build
 * this feature is a `where: { active: true }` filter on the products half of
 * `programNameIncomeRules()`, so a switched-off product simply resolves to no rule. That is
 * silently wrong for a SINGLE-FACT product (`byGrade`, `byProfessorRank` — the shape every
 * pre-template product has): with no surrogate figure the resolver falls through to
 * "a declared salary still carries the quote", and `monthly_income` is a bound REQUIRED
 * question, so essentially every applicant has one. The program would keep quoting, off a
 * payslip the bank never agreed to lend against, and the figure would be frozen onto an
 * immutable offer (Principle I / A6).
 *
 * So the withholding is a FLAG on the snapshot that `quoteProgram` refuses on before it
 * prices anything, and the program stays LISTED with its reason (A33) rather than being
 * filtered out of the shortlist.
 */
import { describe, expect, it } from 'vitest';
import { Decimal } from '@prisma/client/runtime/library';
import { quoteProgram } from '@/matching/pipeline/quote';
import { reasonToCheckCode } from '@/matching/engine.service';
import { profileFixture, programFixture } from '../helpers/matching';

/** A pre-template product: one fact, one key table. The shape that fails open. */
const SINGLE_FACT = {
  strategy: 'byProfessorRank',
  keyTable: { professor: { incomeEGP: '50000' } },
} as never;

describe('a switched-off product withholds the figures', () => {
  it('refuses even when the applicant HAS a declared salary', () => {
    const outcome = quoteProgram({
      // 20,000 EGP declared, from the fixture — the payslip this program must not use.
      profile: profileFixture(),
      program: programFixture({
        programType: 'income_surrogate',
        incomeAssumption: SINGLE_FACT,
        incomeRuleWithheld: 'surrogate_product_retired',
      }),
    });
    expect(outcome.ok).toBe(false);
    expect(outcome.ok === false && outcome.unavailable.reason).toBe('SURROGATE_PRODUCT_RETIRED');
  });

  it('quotes normally on the same program once the product is back on', () => {
    // The control. Same program, same applicant, flag absent — so the refusal above is the
    // flag's doing and not a broken fixture.
    const outcome = quoteProgram({
      profile: profileFixture(),
      program: programFixture({ programType: 'income_surrogate', incomeAssumption: SINGLE_FACT }),
    });
    expect(outcome.ok).toBe(true);
  });

  it('refuses a product-rule product too, and carries no figures', () => {
    const outcome = quoteProgram({
      profile: profileFixture(),
      program: programFixture({
        programType: 'income_surrogate',
        incomeAssumption: {
          strategy: 'steps',
          steps: [{ id: 'primary', op: 'constant', value: '30000' }],
          output: { from: 'primary' },
        } as never,
        incomeRuleWithheld: 'surrogate_product_retired',
      }),
    });
    expect(outcome.ok === false && outcome.unavailable.reason).toBe('SURROGATE_PRODUCT_RETIRED');
    // No affordability figures: this is not "you can borrow 0", it is "the platform is not
    // quoting this program at all". The calculator reads exactly this distinction.
    expect(outcome.ok === false && outcome.unavailable.maxAffordableAmountEGP).toBeUndefined();
  });

  it('refuses BEFORE the misconfiguration cascade, so it is not reported as a bad rate', () => {
    // The flag is checked first. A program that is ALSO missing its rate must still report
    // the withholding: the operator's fix is the product switch, and `PROGRAM_MISCONFIGURED`
    // would send them into the bank's pricing tab instead.
    const outcome = quoteProgram({
      profile: profileFixture(),
      program: programFixture({
        programType: 'income_surrogate',
        pricing: { isVariableRate: false } as never,
        incomeRuleWithheld: 'surrogate_product_retired',
      }),
    });
    expect(outcome.ok === false && outcome.unavailable.reason).toBe('SURROGATE_PRODUCT_RETIRED');
  });

  it('refuses even when the caller pre-supplied an income resolution', () => {
    // `input.incomeResolution` is an optimisation the engine uses to avoid resolving twice.
    // A check placed after the resolution would be skipped for exactly those callers — the
    // apply path among them.
    const outcome = quoteProgram({
      profile: profileFixture(),
      program: programFixture({
        programType: 'income_surrogate',
        incomeAssumption: SINGLE_FACT,
        incomeRuleWithheld: 'surrogate_product_retired',
      }),
      incomeResolution: {
        recognisedIncomeEGP: new Decimal('50000'),
        origin: 'surrogate',
      } as never,
    });
    expect(outcome.ok === false && outcome.unavailable.reason).toBe('SURROGATE_PRODUCT_RETIRED');
  });
});

describe('the check code it maps onto', () => {
  it('is program_misconfigured, not monthly_income', () => {
    // Nothing about this applicant's earnings is in question. Mapped to income, the
    // suggestion engine would propose a guarantor or a smaller amount for a state only an
    // operator can undo.
    expect(reasonToCheckCode('SURROGATE_PRODUCT_RETIRED')).toBe('program_misconfigured');
  });
});
