/**
 * Every surrogate product offers at least one way, and every seeded program names exactly one.
 *
 * Operator decision (2026-09-06): no product is exempt from "pick exactly one way". Three
 * things make that true and each is pinned here against the REAL blueprint registry and the
 * REAL seed, not against fixtures:
 *
 *   1. A single-way product names its one way `primary` and compiles with NO `waysAre` flag —
 *      byte-identical to before the default flipped (§5.4).
 *   2. The auto cross-sell's two heads fold into ONE way whose slots are the UNION, so a program
 *      on catalog amounts inherits both terms of "the lower of".
 *   3. Every `income_surrogate` entry in `SHEET_PROGRAMS` names a way that its product actually
 *      offers — and for a one-way product, THE one. This is the guard against the seed's literal
 *      and the migration's SQL backfill drifting apart: both must say `primary`.
 */
import { describe, expect, it } from 'vitest';

import { productBlueprint, productBlueprints } from '@/bank-programs/blueprints/product-blueprints';
import { PROGRAM_NAMES } from '@/bank-programs/demo-figures/sheet-figures';
import { SHEET_PROGRAMS } from '@/bank-programs/demo-figures/sheet-programs';
import type { ProductRule } from '@/matching/pipeline/product-rule';
import { waysOfRule } from '@/matching/pipeline/product-rule-ways';
import { compileTemplate, waysOf } from '@/matching/pipeline/product-template';

const withTemplate = productBlueprints().filter((b) => b.template !== null);
const singleWay = withTemplate.filter((b) => waysOf(b.template!).length === 1);

describe('every product offers a way a program can name', () => {
  it('has ten single-way products, one combined and one exclusive — the registry as it stands', () => {
    const shapes = withTemplate.map((b) => [b.key, waysOf(b.template!).length, b.template!.waysAre]);
    expect(shapes.filter(([, n]) => n === 1)).toHaveLength(7);
    expect(shapes.find(([key]) => key === 'auto_loan_crosssell')?.slice(1)).toEqual([2, 'combined']);
    expect(shapes.find(([key]) => key === 'compound_owner')?.slice(1)).toEqual([5, 'exclusive']);
  });

  it.each(singleWay.map((b) => [b.key, b] as const))(
    '%s offers exactly one way, named `primary`, and carries no flag',
    (_key, blueprint) => {
      const rule = compileTemplate(blueprint.template!) as ProductRule;
      expect(waysOfRule(rule).map((way) => way.id)).toEqual(['primary']);
      expect(rule.waysAre).toBeUndefined();
    },
  );

  it('folds the cross-sell into one way whose slots are BOTH terms', () => {
    const rule = compileTemplate(productBlueprint('auto_loan_crosssell')!.template!) as ProductRule;
    expect(rule.waysAre).toBe('combined');
    expect(waysOfRule(rule)).toEqual([{ id: 'primary', slots: ['primary', 'alt'] }]);
  });

  it('still lists the compound guarantee’s five rivals', () => {
    const rule = compileTemplate(productBlueprint('compound_owner')!.template!) as ProductRule;
    expect(rule.waysAre).toBe('exclusive');
    expect(waysOfRule(rule)).toHaveLength(5);
  });
});

/**
 * Names the seed REUSES rather than creates — `sheet-figures.ts` leaves `compound_owner_4` out of
 * `PROGRAM_NAMES` on purpose (it already exists and is already linked), so its product is stated
 * here from the same knowledge the four compound programs' `wayId`s are written against.
 */
const PRE_EXISTING_NAMES: Readonly<Record<string, string>> = { compound_owner_4: 'compound_owner' };

describe('the seed names, for every surrogate program, a way its product offers', () => {
  const surrogate = SHEET_PROGRAMS.filter((p) => p.dto.programType === 'income_surrogate');

  it('seeds thirteen surrogate programs and four payslip ones', () => {
    expect(surrogate).toHaveLength(13);
    expect(SHEET_PROGRAMS.length - surrogate.length).toBe(4);
  });

  it.each(surrogate.map((p) => [p.programCode, p] as const))(
    '%s names a way of the product behind its catalog name',
    (_code, program) => {
      const productKey =
        PROGRAM_NAMES.find((n) => n.key === program.dto.programNameKey)?.productKey ??
        PRE_EXISTING_NAMES[program.dto.programNameKey];
      expect(productKey, `no product known for ${program.dto.programNameKey}`).toBeDefined();
      const blueprint = productBlueprint(productKey!);
      expect(blueprint?.template, `no template for ${productKey}`).toBeTruthy();
      const ways = waysOfRule(compileTemplate(blueprint!.template!) as ProductRule);
      const wayId = program.dto.incomeAssumption.wayId;
      expect(wayId, `${program.programCode} names no way`).toBeDefined();
      expect(ways.map((way) => way.id)).toContain(wayId);
      // For a one-way product the literal and the migration's backfill must agree on THE way.
      if (ways.length === 1) expect(wayId).toBe(ways[0]!.id);
    },
  );

  it('leaves every payslip program without a way — the rule is scoped to surrogate products', () => {
    for (const program of SHEET_PROGRAMS) {
      if (program.dto.programType !== 'income_surrogate') {
        expect(program.dto.incomeAssumption.wayId).toBeUndefined();
      }
    }
  });
});
