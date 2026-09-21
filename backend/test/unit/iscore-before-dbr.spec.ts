/**
 * I-Score is applied BEFORE the DBR cap is chosen.
 *
 * Why it matters: the cap can itself depend on income (`dbrBands`). A multiplier applied
 * after `resolveDbrCap` had already picked a band from the un-multiplied figure would hand an
 * applicant sitting near a band edge the wrong cap — and the cap sets what they can borrow.
 *
 * WHAT CHANGED AT v30.3.0, and why this file is now the only thing holding the property.
 * Until then the multiplier was four compiled steps INSIDE the product's rule, so the
 * resolver's own `resolveDbrCap` already saw the multiplied figure and the ordering held
 * STRUCTURALLY — there was nothing to get wrong. The multiplier is program-level policy now
 * (`quoteProgram` step 2a), applied after the resolver has run, so the ordering is a property
 * somebody has to maintain: step 5 re-resolves the cap when the multiplier moved the figure.
 * That re-resolve is what these cases pin.
 *
 * The case is the band edge itself, because that is the only place the two orders differ.
 * It is exercised through `quoteProgram` and not through `resolveAssumedIncome`, because the
 * resolver is no longer where the multiplier lands — asserting on it would pin the absence of
 * the feature rather than its position.
 *
 * NO PROGRAM ON THIS DATABASE states both a tier table and income bands (measured: 0 of 71),
 * so none of this shows up in the before/after figure diffs. That is precisely why it is
 * tested: the regression net cannot see it.
 */
import { describe, expect, it } from 'vitest';
import { Decimal } from '@prisma/client/runtime/library';
import { I_SCORE_FACT_KEY } from '@/matching/pipeline/product-template';
import { quoteProgram } from '@/matching/pipeline/quote';
import { applyIScoreFactor, resolveIScoreFactor } from '@/matching/pipeline/iscore';
import type { ApplicantProfile, BankProgramSnapshot, EligibilityConfig } from '@/matching/types';

/** A tier table as the engine reads it — rows carry a PERCENTAGE in `incomeEGP`. */
interface Tiers {
  bands: Array<{ fromInclusive: string; toExclusive: string | null; incomeEGP: string }>;
}

/** Table figure 46 000, multiplier 110% → 50 600, which is over the 50 000 edge. */
const TIERS: Tiers = {
  bands: [
    { fromInclusive: '0', toExclusive: '700', incomeEGP: '100' },
    { fromInclusive: '700', toExclusive: null, incomeEGP: '110' },
  ],
};

/** The cap changes at 50 000 — the whole point of the case. */
const eligibility = (over: Partial<EligibilityConfig> = {}): EligibilityConfig =>
  ({
    acceptedEmploymentTypes: ['private_sector_employee', 'business_owner_company_owner'],
    minAge: 21,
    maxAge: 65,
    minMonthlyIncomeEGP: '0',
    minMonthsInJob: 0,
    dbrCapPercent: '50.0000',
    dbrBands: [
      { upToIncomeEGP: '50000', capPercent: '40.0000' },
      { upToIncomeEGP: null, capPercent: '60.0000' },
    ],
    skipDbrCheck: false,
    acceptedSalaryTransferTypes: ['transfer_to_bank'],
    ...over,
  }) as unknown as EligibilityConfig;

/**
 * A PAYSLIP program, deliberately. It is the case the refactor exists to enable — until
 * v30.3.0 an `income_proof` program could not state a tier table at all — and it is the
 * simplest way to put a known income in front of the multiplier: the declared salary is the
 * recognised figure, with no rule in the way.
 */
const program = (
  tiers: Tiers | undefined,
  over: Partial<EligibilityConfig> = {},
): BankProgramSnapshot =>
  ({
    id: 'p1',
    programCode: 'TEST-PER-ISCORE',
    bankName: 'Test Bank',
    bankIsFeatured: false,
    friendlyName: 'I-Score test',
    programType: 'income_proof',
    productCategory: 'personal',
    active: true,
    isShariaCompliant: false,
    version: 1,
    requiredDocuments: [],
    createdAt: new Date('2026-01-01'),
    tenor: { minMonths: 6, maxMonths: 60 },
    loanLimits: { minAmountEGP: '10000', maxAmountEGP: '5000000' },
    pricing: { baseRatePercent: '20.0000' },
    eligibility: eligibility(over),
    incomeAssumption: { strategy: 'declared' },
    fees: {},
    ...(tiers === undefined ? {} : { iScoreTiers: { tiers, source: 'program' as const } }),
  }) as unknown as BankProgramSnapshot;

const profile = (
  score: string | undefined,
  employmentType = 'private_sector_employee',
): ApplicantProfile =>
  ({
    age: 35,
    loanPurpose: 'personal',
    requestedAmountEGP: new Decimal('5000000'),
    preferredTenorMonths: 60,
    priority: 'lowest_installment',
    employment: {
      employmentType,
      monthlyNetSalaryEGP: new Decimal('46000'),
      monthsInJob: 24,
      salaryTransferType: 'transfer_to_bank',
    },
    obligations: { existingMonthlyObligationsEGP: new Decimal('0') },
    assets: {},
    surrogateFacts:
      score === undefined
        ? {}
        : { [I_SCORE_FACT_KEY]: { kind: 'numeric' as const, value: new Decimal(score) } },
  }) as unknown as ApplicantProfile;

describe('I-Score lands before the DBR band is chosen', () => {
  it('picks the UPPER band, because 46 000 x 110% = 50 600 crosses the edge', () => {
    const out = quoteProgram({ profile: profile('720'), program: program(TIERS) });
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(out.quote.recognisedIncomeEGP.toString()).toBe('50600');
    // If this reads 40, the multiplier was applied after the cap was resolved — the whole
    // defect this file guards. Band 1, not a scalar fall-through.
    expect(out.quote.dbrCapPercent.toString()).toBe('60');
    expect(out.quote.dbrBandIndex).toBe(1);
  });

  it('picks the LOWER band for the same applicant without a score', () => {
    const out = quoteProgram({ profile: profile(undefined), program: program(TIERS) });
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    // The question is OPTIONAL, so a blank must cost nothing: the figure is the salary,
    // untouched, and it is under the edge.
    expect(out.quote.recognisedIncomeEGP.toString()).toBe('46000');
    expect(out.quote.dbrCapPercent.toString()).toBe('40');
    expect(out.quote.dbrBandIndex).toBe(0);
  });

  it('picks the LOWER band when the program states no tiers at all', () => {
    // 54 of 71 programs are in this state, and it must be arithmetically identical to the
    // un-scored case above: no table means a 100% multiplier, which is what the deleted
    // `coalesce [iscore_band, {const:'100'}]` answered.
    const out = quoteProgram({ profile: profile('720'), program: program(undefined) });
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(out.quote.recognisedIncomeEGP.toString()).toBe('46000');
    expect(out.quote.dbrCapPercent.toString()).toBe('40');
    expect(out.quote.dbrBandIndex).toBe(0);
    // And nothing is frozen onto the offer, because nothing was measured.
    expect(out.quote.iScoreFactorPercent).toBeUndefined();
    expect(out.quote.iScoreTiersSource).toBeUndefined();
  });

  it('re-resolves the band on a SURROGATE program, whose cap the resolver pre-picked', () => {
    // THE CASE THE FIX IS FOR, and the one the payslip cases above cannot reach.
    //
    // On a payslip program `quoteProgram` resolves the cap itself, at the end, against the
    // final figure — so the ordering was never in question there. On a SURROGATE program the
    // RESOLVER resolves it, against the figure as the rule produced it, and step 5 then reads
    // that answer straight off `incomeResolution` rather than re-deriving it (deliberately —
    // re-deriving is how two copies disagree about a number an offer is about to freeze).
    //
    // With the multiplier inside the rule the resolver already saw the multiplied figure.
    // With it at step 2a the resolver does not, so without `iScoreMovedIncome` this reads
    // 40% and band 0: the cap belonging to the applicant they were before their score was
    // read.
    const surrogate = {
      ...program(TIERS),
      programType: 'income_surrogate',
    } as unknown as BankProgramSnapshot;
    const out = quoteProgram({ profile: profile('720'), program: surrogate });
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(out.quote.recognisedIncomeEGP.toString()).toBe('50600');
    expect(out.quote.dbrCapPercent.toString()).toBe('60');
    expect(out.quote.dbrBandIndex).toBe(1);
  });

  it('leaves a surrogate program alone when the multiplier moved nothing', () => {
    // The control for the case above: a 100% tier must NOT trigger a re-resolve, or the
    // property "nothing moves unless a figure moved" stops being true and every surrogate
    // quote starts taking a different code path than it did before v30.3.0.
    const flat: Tiers = { bands: [{ fromInclusive: '0', toExclusive: null, incomeEGP: '100' }] };
    const surrogate = {
      ...program(flat),
      programType: 'income_surrogate',
    } as unknown as BankProgramSnapshot;
    const out = quoteProgram({ profile: profile('720'), program: surrogate });
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(out.quote.recognisedIncomeEGP.toString()).toBe('46000');
    expect(out.quote.dbrCapPercent.toString()).toBe('40');
    expect(out.quote.dbrBandIndex).toBe(0);
    // Measured at 100%, which is a real answer and is frozen as one.
    expect(out.quote.iScoreFactorPercent?.toString()).toBe('100');
  });

  it('freezes the multiplier and whose table it was', () => {
    const out = quoteProgram({ profile: profile('720'), program: program(TIERS) });
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(out.quote.iScoreFactorPercent?.toString()).toBe('110');
    expect(out.quote.iScoreTiersSource).toBe('program');
  });
});

describe('a cap that depends on who the applicant is', () => {
  it('beats the income bands, whatever they earn', () => {
    // `dbrCapPercentByEmploymentType` sits between the rule override and the income bands,
    // and that order IS the meaning: a bank stating both means "40% for the self-employed,
    // whatever they earn". It must survive the re-resolve step 2a now triggers.
    const out = quoteProgram({
      profile: profile('720', 'business_owner_company_owner'),
      program: program(TIERS, { dbrCapPercentByEmploymentType: { self_employed: '40' } }),
    });
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(out.quote.recognisedIncomeEGP.toString()).toBe('50600');
    expect(out.quote.dbrCapPercent.toString()).toBe('40');
    // Not a band choice: the bucket answered before the table was consulted.
    expect(out.quote.dbrBandIndex).toBeNull();
  });

  it('leaves a salaried applicant on the income bands', () => {
    const out = quoteProgram({
      profile: profile('720'),
      program: program(TIERS, { dbrCapPercentByEmploymentType: { self_employed: '40' } }),
    });
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(out.quote.dbrCapPercent.toString()).toBe('60');
    expect(out.quote.dbrBandIndex).toBe(1);
  });
});

/**
 * The multiplier itself, as a unit.
 *
 * These five cases moved here from `product-template-compile.spec.ts`' `describe('I-Score')`
 * when the multiplier stopped being four compiled steps (v30.3.0). They are the same
 * behaviours, asserted against the one reader that now owns them.
 */
describe('the multiplier itself', () => {
  const TABLE: Tiers = {
    bands: [
      { fromInclusive: '0', toExclusive: '600', incomeEGP: '80' },
      { fromInclusive: '600', toExclusive: '700', incomeEGP: '100' },
      { fromInclusive: '700', toExclusive: null, incomeEGP: '110' },
    ],
  };
  const resolved = { tiers: TABLE, source: 'program' as const };

  it('applies the tier the score falls in', () => {
    const out = resolveIScoreFactor(resolved, new Decimal('720'));
    expect(out.factorPercent.toString()).toBe('110');
    expect(out.source).toBe('program');
    expect(out.tierIndex).toBe(2);
    expect(applyIScoreFactor(new Decimal('45000'), out.factorPercent).toString()).toBe('49500');
  });

  it('falls back to 100% when the applicant gave no score', () => {
    // The question is OPTIONAL by deliberate design, so a blank must cost nothing. This is
    // what `RuleStep.optional` used to buy: without it `factNumber` answered
    // `fact_not_answered` and one skipped question killed every quote for the product.
    const out = resolveIScoreFactor(resolved, undefined);
    expect(out.factorPercent.toString()).toBe('100');
    expect(out.source).toBeNull();
    expect(out.tierIndex).toBeNull();
  });

  it('falls back to 100% when no table is in force', () => {
    // 54 of 71 programs, as of v30.3.0. `source: null` is what keeps this distinguishable on
    // the offer from a table that resolved to 100%.
    const out = resolveIScoreFactor(undefined, new Decimal('720'));
    expect(out.factorPercent.toString()).toBe('100');
    expect(out.source).toBeNull();
  });

  it('falls back to 100% when the score falls outside every tier', () => {
    // THE ONE DELIBERATE BEHAVIOUR CHANGE of the refactor. Inside the rule this was
    // `no_matching_band`, which refused the quote outright — correct there, because a
    // `bandTable` step that cannot resolve has no figure to hand on.
    //
    // Here it must not refuse: `validateIScoreTiers` demands full 0…∞ coverage at write time
    // (`first_band_not_zero` / `last_band_not_open`), so a gap is unreachable through any
    // screen, and Principle V forbids failing a match on config that got there anyway. A
    // legacy or hand-edited table costs that score its multiplier and nothing else.
    const gapped = { tiers: { bands: [TABLE.bands[1]!] }, source: 'product' as const };
    const out = resolveIScoreFactor(gapped, new Decimal('900'));
    expect(out.factorPercent.toString()).toBe('100');
    expect(out.source).toBeNull();
  });

  it('refuses a non-positive tier figure back to 100%', () => {
    // A stored `0` would zero the applicant's whole affordability while reading on screen as
    // a configured tier — the same trap `resolveDbrCap` re-checks its own bounds for.
    const zeroed = {
      tiers: { bands: [{ fromInclusive: '0', toExclusive: null, incomeEGP: '0' }] },
      source: 'program' as const,
    };
    expect(resolveIScoreFactor(zeroed, new Decimal('720')).factorPercent.toString()).toBe('100');
  });

  it('returns the SAME Decimal at 100%, so an unscored quote allocates nothing', () => {
    const amount = new Decimal('45000');
    expect(applyIScoreFactor(amount, new Decimal('100'))).toBe(amount);
  });
});
