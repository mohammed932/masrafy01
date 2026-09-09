/**
 * Every income-bearing product adjusts by I-Score, and adding it moves nothing that was there.
 *
 * `20260907090100_iscore_every_surrogate_product` appends the four I-Score steps to every stored
 * product rule in SQL, because `seed:blueprints` never touches a product that already holds a
 * calculation. That SQL is only correct if it does EXACTLY what `compileTemplate` does when the
 * template declares `iScore: true` — so the contract is pinned here against the compiler, for
 * every blueprint: the four steps are SPLICED IN immediately before the first `cond__*` step
 * (a condition's comparison figure is a step emitted AFTER the multiplier) or at the end when
 * there is none, every other step keeps its id and its place (§5.4), the multiplier reads the
 * old output step, and the output moves to `iscore_applied`.
 */
import { describe, expect, it } from 'vitest';

import { productBlueprints } from '@/bank-programs/blueprints/product-blueprints';
import type { ProductRule } from '@/matching/pipeline/product-rule';
import { compileTemplate, I_SCORE_FACT_KEY, SLOT } from '@/matching/pipeline/product-template';

const withTemplate = productBlueprints().filter((b) => b.template !== null);

describe('I-Score on every income-bearing product', () => {
  it('is declared on all ten rule-bearing blueprints, and only there', () => {
    // Nine, plus the two savings products the Suez Canal auto sheets added.
    // Ten since 2026-09-09: the two Suez Canal auto products merged into one with two ways.
    expect(withTemplate).toHaveLength(10);
    for (const blueprint of withTemplate) expect(blueprint.template!.iScore).toBe(true);
    // The three cap-only products have no template, so there is nothing to multiply.
    expect(productBlueprints().filter((b) => b.template === null).map((b) => b.key).sort()).toEqual([
      'club_branch_cap',
      'company_coding_cap',
      'school_type_cap',
    ]);
  });

  it.each(withTemplate.map((b) => [b.key, b] as const))(
    '%s: the migration’s append is exactly what the compiler emits',
    (_key, blueprint) => {
      const without = compileTemplate({ ...blueprint.template!, iScore: false }) as ProductRule;
      const withScore = compileTemplate(blueprint.template!) as ProductRule;

      // Spliced before the first condition step, or at the end; nothing else moves.
      const firstCondition = without.steps.findIndex((step) => step.id.startsWith('cond__'));
      const cutAt = firstCondition === -1 ? without.steps.length : firstCondition;
      expect(withScore.steps).toEqual([
        ...without.steps.slice(0, cutAt),
        { id: SLOT.iScoreSrc, op: 'factNumber', fact: I_SCORE_FACT_KEY, optional: true },
        { id: SLOT.iScoreBand, op: 'bandTable', of: { step: SLOT.iScoreSrc } },
        { id: SLOT.iScoreFactor, op: 'coalesce', of: [{ step: SLOT.iScoreBand }, { const: '100' }] },
        {
          id: SLOT.iScoreApplied,
          op: 'percentOf',
          of: [{ step: without.output.from }, { step: SLOT.iScoreFactor }],
        },
        ...without.steps.slice(cutAt),
      ]);
      expect(withScore.output).toEqual({ ...without.output, from: SLOT.iScoreApplied });
      expect(withScore.gates).toEqual(without.gates);
      expect(withScore.waysAre).toEqual(without.waysAre);
    },
  );
});
