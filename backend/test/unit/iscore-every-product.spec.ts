/**
 * I-Score is NOT part of a product's calculation, and taking it out moved nothing.
 *
 * This file used to pin the opposite. `20260907090100_iscore_every_surrogate_product` appended
 * four I-Score steps to every stored product rule in SQL — because `seed:blueprints` never
 * touches a product that already holds a calculation — and that SQL was only correct if it did
 * EXACTLY what `compileTemplate` did when the template declared `iScore: true`. So the append
 * was pinned here against the compiler, for every blueprint.
 *
 * `20260921090100_iscore_out_of_the_rule` is the inverse, and needs the inverse guarantee. It
 * deletes those four steps and re-points `output.from` at the step the multiplier was reading,
 * on nine stored products, in SQL — and that is only correct if the result is EXACTLY what the
 * compiler now emits. Same reason the old direction was pinned: a fresh compile and a migrated
 * row must be the same list in the same order, or the next template save reads as a structural
 * change on a product nobody touched (§5.4).
 *
 * The check is stronger than the old one because the new contract is stronger: the multiplier
 * is not emitted AT ALL, so `compileTemplate` with the retired flag set and with it unset must
 * produce byte-identical rules. That is also what makes leaving `ProductTemplate.iScore`
 * accepted-but-inert safe — a stored `templateSpec` written before v30.3.0 still parses, and
 * parsing it changes nothing.
 *
 * Where the multiplier went, and what pins it there: `pipeline/iscore.ts` (one reader),
 * `quoteProgram` step 2a (one application point) and `iscore-before-dbr.spec.ts` (its
 * position relative to the debt-burden band).
 */
import { describe, expect, it } from 'vitest';

import { productBlueprints } from '@/bank-programs/blueprints/product-blueprints';
import type { ProductRule } from '@/matching/pipeline/product-rule';
import { compileTemplate, SLOT } from '@/matching/pipeline/product-template';

const withTemplate = productBlueprints().filter((b) => b.template !== null);

/** The four ids the compiler used to emit. Spelled out, because `SLOT` no longer carries them. */
const RETIRED_ISCORE_SLOTS = ['iscore_src', 'iscore_band', 'iscore_factor', 'iscore_applied'];

describe('I-Score is no longer a step in any product rule', () => {
  it('is declared by no blueprint', () => {
    // Ten rule-bearing blueprints, unchanged by this refactor — the count is asserted so a
    // blueprint added or lost shows up here rather than as a silently smaller sweep below.
    // Ten since 2026-09-09: the two Suez Canal auto products merged into one with two ways.
    expect(withTemplate).toHaveLength(10);
    for (const blueprint of withTemplate) expect(blueprint.template!.iScore).toBeUndefined();
    // The three cap-only BLUEPRINTS have no template, so there was never anything to
    // multiply. `compound_owner` is deliberately not in this list: it declares a template
    // here even though its stored row holds no `incomeRule` on this database — a
    // pre-existing gap between the blueprint and the seeded row, unrelated to I-Score and
    // not this change's to close.
    expect(
      productBlueprints()
        .filter((b) => b.template === null)
        .map((b) => b.key)
        .sort(),
    ).toEqual(['club_branch_cap', 'company_coding_cap', 'school_type_cap']);
  });

  it('is not an id the compiler can emit', () => {
    // `SLOT` is the closed list of ids a bank's FIGURES are keyed by. Four that nothing emits
    // would make the admin's figure editors offer boxes no rule reads, which is the whole
    // reason they were deleted rather than retired-but-retained like the template flag.
    for (const retired of RETIRED_ISCORE_SLOTS) {
      expect(Object.values(SLOT)).not.toContain(retired);
    }
  });

  it.each(withTemplate.map((b) => [b.key, b] as const))(
    '%s: the retired flag compiles to nothing at all',
    (_key, blueprint) => {
      // The migration's claim, pinned against the compiler: with the four steps gone and the
      // output pointing at the step the multiplier read, a migrated rule IS a freshly compiled
      // one. If the flag still emitted anything, these two would differ.
      const inert = compileTemplate({ ...blueprint.template!, iScore: true }) as ProductRule;
      const plain = compileTemplate({ ...blueprint.template!, iScore: false }) as ProductRule;
      expect(inert).toEqual(plain);
    },
  );

  it.each(withTemplate.map((b) => [b.key, b] as const))(
    '%s: emits no iscore step and no iscore output',
    (_key, blueprint) => {
      const rule = compileTemplate(blueprint.template!) as ProductRule;
      const ids = rule.steps.map((step) => step.id);
      for (const retired of RETIRED_ISCORE_SLOTS) expect(ids).not.toContain(retired);
      expect(RETIRED_ISCORE_SLOTS).not.toContain(rule.output.from);

      // The output names a step that EXISTS — the post-condition the migration asserts in SQL,
      // checked here against the compiler so the two cannot disagree about what a valid rule
      // is. A rule whose output dangles resolves to `rule_unconfigured` on a live quote.
      expect(ids).toContain(rule.output.from);

      // And nothing anywhere in the rule still names one of the four. The migration proved
      // this for the nine STORED products; this proves it for every compile.
      expect(JSON.stringify(rule)).not.toContain('iscore');
    },
  );
});
