/**
 * The compound guarantee gained a fifth way — a share of the DOWN PAYMENT — and the bracket
 * way was repointed onto the same figure, because App. B FABMISR prints its brackets against
 * the down payment while App. A §2 (ABK) and App. B CAE take their share of everything paid.
 *
 * The dangerous half of that edit is not the arithmetic: it is whether a figure some bank has
 * already typed still lives where it was typed (spec §5.4). This pins it as an assertion
 * rather than a reading, by compiling the shape the product had BEFORE the change and the one
 * it has now, and comparing the slot ids the two file figures under.
 *
 * `test/unit/product-blueprints.spec.ts` holds the golden list; this holds the reason the
 * golden list could be extended at all.
 */
import { describe, expect, it } from 'vitest';

import { productBlueprint } from '@/bank-programs/blueprints/product-blueprints';
import {
  compileTemplate,
  templateParamKeys,
  type ProductTemplate,
} from '@/matching/pipeline/product-template';

/**
 * `compound_owner`'s ways as they stood before the down payment was asked for: the brackets
 * read everything paid, and there was no fifth way.
 *
 * Derived from the live template by undoing exactly those two edits, rather than transcribed
 * — a transcribed copy would go stale the next time the product gains an adjustment, and it
 * would then be asserting on somebody else's change instead of on this one.
 */
function beforeTheDownPayment(template: ProductTemplate): ProductTemplate {
  const ways = template.alternatives!;
  return {
    ...template,
    alternatives: [
      // The bracket way is repointed at the fact it used to read, and everything ELSE about
      // it is carried across — its own `column` included. That is scope, not convenience:
      // the per-way column arrived with the 2026-09-09 move of the second column off the
      // PRODUCT and onto the three ways whose sheets print one, which is a different change,
      // pinned by the golden slot list in `product-blueprints.spec.ts`, by the migration's
      // own end-state assertions and by the orphan check. Dropping it here would make every
      // assertion below report on THAT change instead of on the fifth way, which is the one
      // thing this file exists to hold still.
      { ...ways[0]!, fact: 'unit_paid_to_date' },
      ...ways.slice(1, ways.length - 1),
    ],
  };
}

const NOW = productBlueprint('compound_owner')!.template!;
const BEFORE = beforeTheDownPayment(NOW);

describe('the down payment became its own figure without moving anybody else’s', () => {
  it('orphans no slot the old shape could hold a figure in', () => {
    // Which is what makes rebuilding a live product from this blueprint legal: the orphan
    // refusal (`PRODUCT_TEMPLATE_ORPHANS_FIGURES`) compares exactly these two sets.
    const before = new Set(templateParamKeys(BEFORE));
    const after = new Set(templateParamKeys(NOW));
    expect([...before].filter((slot) => !after.has(slot))).toEqual([]);
  });

  it('adds only the fifth way’s own slots', () => {
    const before = new Set(templateParamKeys(BEFORE));
    const after = templateParamKeys(NOW);
    // Two slots, not four: the fifth way carries no second column of its own. It used to
    // get one from the PRODUCT-level column that reached every way, and that column is now
    // declared per way — on the three whose sheets actually print one, which this way's does
    // not. The way holds no figure anywhere either (`sheet-figures.ts` leaves it blank on
    // purpose, since no sheet states a percentage for a share of the down payment alone).
    expect(after.filter((slot) => !before.has(slot)).sort()).toEqual([
      'alt__unit_down_payment',
      'src__unit_down_payment',
    ]);
  });

  it('keeps the bracket way on the bare `alt` slot it has always had', () => {
    // The repoint changes which fact the brackets READ and not where the brackets LIVE:
    // `waySlot` names index 1 positionally, so FABMISR's four figures stay put and start
    // being read against the down payment the sheet prints them against.
    const way = NOW.alternatives![0]!;
    expect(way.kind).toBe('numberBand');
    expect(way.fact).toBe('unit_down_payment');
    const steps = compileTemplate(NOW).steps ?? [];
    const bracket = steps.find((step) => step.id === 'alt');
    expect(bracket?.op).toBe('bandTable');
    expect(bracket?.of).toEqual({ step: 'src__unit_down_payment' });
  });

  it('still reads everything paid to date, for the two banks that share that', () => {
    // The share way and the paid-share condition both read the total, so removing the fact
    // from the brackets must not remove it from the rule.
    const steps = compileTemplate(NOW).steps ?? [];
    const share = steps.find((step) => step.id === 'alt__unit_paid_to_date');
    expect(share?.op).toBe('percentOf');
    expect(share?.of).toEqual({ step: 'src__unit_paid_to_date' });
  });

  it('asks for the down payment as a figure of its own', () => {
    const ask = productBlueprint('compound_owner')!.asks.find(
      (candidate) => candidate.factKey === 'unit_down_payment',
    );
    expect(ask?.kind).toBe('number');
  });
});
