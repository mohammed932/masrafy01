/**
 * The predefined product library.
 *
 * Three claims are pinned, and each of them is a way the library could ship broken while
 * every screen still looked finished:
 *
 *   1. Every blueprint compiles to a rule the EXISTING save-time validation accepts. A
 *      blueprint that needed the validator relaxed would be authoring calculations the rest
 *      of the platform does not trust.
 *   2. Every fact a blueprint's calculation READS is a fact the same blueprint creates or
 *      reuses. A template naming a fact nothing sets up is a product that saves clean and
 *      quotes nothing — the failure this whole layer exists to prevent.
 *   3. The slot ids are GOLDEN. A bank's typed figures are filed under them, and they are
 *      positional (`primary`, `alt`, `alt__<fact>`), so inserting a way into a shipped
 *      blueprint renames the ways after it and orphans every figure filed under them. The
 *      list below is the guard: a diff here means the blueprint's ways were reordered, and
 *      the only safe edit is to APPEND.
 */
import { describe, expect, it } from 'vitest';
import {
  productBlueprint,
  productBlueprints,
  sharedBlueprintFactKeys,
} from '@/bank-programs/blueprints/product-blueprints';
import type { ProductBlueprint } from '@/bank-programs/blueprints/product-blueprint.types';
import { compileTemplate, validateTemplate } from '@/matching/pipeline/product-template';
import { factsReadBy, paramKeysOf } from '@/matching/pipeline/product-rule';
import { validateIncomeRule } from '@/bank-programs/validation/income-rule.validator';
import type { IncomeRuleValidationContext } from '@/bank-programs/validation/income-rule.validator';
import { validateMaxLoanByFact } from '@/bank-programs/validation/max-loan-by-fact.validator';
import { DERIVED_FACT_KEYS } from '@/matching/pipeline/surrogate-fact-registry';
import type { IncomeAssumptionConfig } from '@/matching/types';

const ALL = productBlueprints();

/** Every fact the library declares, as the registry would hold it once a product is created. */
const REGISTRY = [
  ...ALL.flatMap((blueprint) =>
    blueprint.asks
      .filter((ask) => ask.kind !== 'derivedFact')
      .map((ask) => ({
        key: ask.factKey,
        questionCode: ask.kind === 'platformFact' ? ask.factKey : ask.questionCode,
        type: (ask.kind === 'number' ? 'NUMERIC' : 'SINGLE_SELECT') as 'NUMERIC' | 'SINGLE_SELECT',
      })),
  ),
  // The bureau score is PLATFORM-owned — asked of everyone, declared by no blueprint, seeded by
  // `seed-questionnaire.ts` — and every income product's rule now reads it (`iScore: true`).
  { key: 'i_score', questionCode: 'i_score', type: 'NUMERIC' as const },
];

/** Every option code the library's own lists offer, keyed by the question that mirrors them. */
const OPTIONS: Record<string, string[]> = {};
for (const blueprint of ALL) {
  for (const ask of blueprint.asks) {
    if (ask.kind === 'choice') {
      OPTIONS[ask.questionCode] = ask.list.values.map((value) => value.key);
    }
    if (ask.kind === 'platformFact' && ask.addValues) {
      OPTIONS[ask.factKey] = [
        ...(OPTIONS[ask.factKey] ?? []),
        ...ask.addValues.values.map((value) => value.key),
      ];
    }
  }
}
// The three ranks the seed already holds, which two sheets key rows against. The library
// adds four and reuses these; a test registry without them would not be the real list.
OPTIONS['academic_rank'] = [
  ...(OPTIONS['academic_rank'] ?? []),
  'lecturer',
  'assistant_professor',
  'professor',
];
// A NUMERIC fact has no options, and the platform lists behind these two are seeded
// elsewhere — the point of these cases is the SHAPE, and a missing key is a different test.
OPTIONS['unit_months_owned'] = [];
OPTIONS['compound_name'] = ['compound_other'];

const ctx: IncomeRuleValidationContext = {
  isActiveMember: async () => true,
  activeMembers: async () => [],
  surrogateFacts: async () => REGISTRY,
  questionOptionCodes: async (questionCode) => OPTIONS[questionCode] ?? [],
};

const asConfig = (rule: unknown): IncomeAssumptionConfig => rule as IncomeAssumptionConfig;

const withProduct = (blueprint: ProductBlueprint) => blueprint.template !== null;

describe('every blueprint is a shape the platform already trusts', () => {
  it('offers products in all three groups', () => {
    const groups = new Set(ALL.map((blueprint) => blueprint.group));
    expect([...groups].sort()).toEqual(['cap', 'ceiling', 'income']);
  });

  it.each(ALL.map((blueprint) => [blueprint.key, blueprint] as const))(
    '%s has a unique key, both labels, and at least one ask',
    (key, blueprint) => {
      expect(ALL.filter((other) => other.key === key)).toHaveLength(1);
      expect(blueprint.labelEn.length).toBeGreaterThan(0);
      expect(blueprint.labelAr.length).toBeGreaterThan(0);
      expect(blueprint.asks.length).toBeGreaterThan(0);
      expect(productBlueprint(key)).toBe(blueprint);
    },
  );

  it.each(ALL.filter(withProduct).map((b) => [b.key, b] as const))(
    '%s passes the template validator',
    (_key, blueprint) => {
      expect(validateTemplate(blueprint.template!)).toBeUndefined();
    },
  );

  it.each(ALL.filter(withProduct).map((b) => [b.key, b] as const))(
    '%s compiles to a rule validateIncomeRule accepts, unchanged',
    async (_key, blueprint) => {
      const compiled = compileTemplate(blueprint.template!);
      const violation = await validateIncomeRule(asConfig(compiled), ctx, {
        figuresRequired: false,
      });
      expect(violation).toBeUndefined();
    },
  );

  it.each(ALL.filter((b) => b.cap !== undefined).map((b) => [b.key, b] as const))(
    "%s's cap table shape passes its own validator",
    async (_key, blueprint) => {
      const cap = blueprint.cap!;
      const violation = await validateMaxLoanByFact(
        {
          factKey: cap.factKey,
          ...(cap.columnFactKey ? { columnFactKey: cap.columnFactKey } : {}),
          ...(cap.rowVia ? { rowVia: cap.rowVia } : {}),
          ...(cap.columnVia ? { columnVia: cap.columnVia } : {}),
          onNoMatch: cap.onNoMatch,
          // One placeholder cell, because the SHAPE is what the blueprint states — the
          // figures are the bank's, and there are none here by design.
          rows: [
            cap.bands
              ? { ...cap.bands[0]!, maxAmountEGP: '1' }
              : { rowKey: cap.rowKeys![0]!, maxAmountEGP: '1' },
          ],
        },
        ctx,
      );
      expect(violation).toBeUndefined();
    },
  );

  it('never states a figure a bank should be typing', () => {
    // A blueprint may carry band EDGES — which brackets exist is the shape of the table —
    // and never an amount. `maxAmountEGP`, `incomeEGP`, `scalar` and `valueEGP` are the four
    // places a figure lives, and none of them may appear anywhere in the library.
    const serialised = JSON.stringify(ALL);
    for (const field of ['maxAmountEGP', 'incomeEGP', 'valueEGP', 'scalar']) {
      expect(serialised).not.toContain(field);
    }
  });

  it('names no bank, anywhere', () => {
    // One product, many banks (Principle II / A1). The worked examples an operator reads are
    // screen copy in the admin bundle; a bank named here would be a hardcoded bank.
    const serialised = JSON.stringify(ALL).toLowerCase();
    for (const bank of [
      'abk',
      'fabmisr',
      'egbank',
      'eg bank',
      'cae',
      'crédit',
      'credit agricole',
      'al ahly',
    ]) {
      expect(serialised).not.toContain(bank);
    }
  });
});

describe('what a blueprint reads, it also sets up', () => {
  it.each(ALL.filter(withProduct).map((b) => [b.key, b] as const))(
    '%s declares an ask for every fact its calculation reads',
    (_key, blueprint) => {
      const compiled = compileTemplate(blueprint.template!);
      const declared = new Set(blueprint.asks.map((ask) => ask.factKey));
      const read = factsReadBy(compiled);
      const orphans = read.filter(
        (fact) =>
          !declared.has(fact) &&
          // The bureau score is platform-wide and seeded with the questionnaire; every
          // product may switch it on without asking for it.
          fact !== 'i_score' &&
          !DERIVED_FACT_KEYS.includes(fact),
      );
      expect(orphans).toEqual([]);
    },
  );

  it.each(ALL.filter((b) => b.cap !== undefined).map((b) => [b.key, b] as const))(
    '%s declares an ask for the fact its cap is keyed by',
    (_key, blueprint) => {
      const declared = new Set(blueprint.asks.map((ask) => ask.factKey));
      const cap = blueprint.cap!;
      expect(declared.has(cap.factKey) || DERIVED_FACT_KEYS.includes(cap.factKey)).toBe(true);
      if (cap.columnFactKey !== undefined) {
        expect(
          declared.has(cap.columnFactKey) || DERIVED_FACT_KEYS.includes(cap.columnFactKey),
        ).toBe(true);
      }
    },
  );

  it.each(ALL.filter((b) => b.suggestedBands !== undefined).map((b) => [b.key, b] as const))(
    "%s's suggested brackets belong to a way that actually bands",
    (_key, blueprint) => {
      const ways = [blueprint.template!.primary, ...(blueprint.template!.alternatives ?? [])];
      for (const suggestion of blueprint.suggestedBands!) {
        const way = ways[suggestion.wayIndex];
        expect(way?.kind).toBe('numberBand');
        // Half-open and gapless, so exactly the lower edge lands in the upper band.
        for (const [index, edge] of suggestion.edges.entries()) {
          const previous = suggestion.edges[index - 1];
          if (previous) expect(edge.fromInclusive).toBe(previous.toExclusive);
          if (index === suggestion.edges.length - 1) expect(edge.toExclusive).toBeNull();
          else expect(edge.toExclusive).not.toBeNull();
        }
      }
    },
  );

  it('asks a choice question only about a list that carries at least two answers', () => {
    for (const blueprint of ALL) {
      for (const ask of blueprint.asks) {
        if (ask.kind !== 'choice') continue;
        // `compound` is the exception and it is the whole two-list design: the list ships
        // with its catch-all and is filled by pasting hundreds of real compounds.
        const minimum = ask.list.typeKey === 'compound' ? 1 : 2;
        expect(ask.list.values.length, `${blueprint.key}/${ask.factKey}`).toBeGreaterThanOrEqual(
          minimum,
        );
        for (const value of ask.list.values) {
          expect(value.labelEn.length).toBeGreaterThan(0);
          expect(value.labelAr.length).toBeGreaterThan(0);
        }
      }
    }
  });

  it('files every value of a list that has a class axis', () => {
    // `resolveParentKey` refuses to create a filed-under value with no parent — a value of a
    // filed kind is born filed — so a blueprint that ships one would fail at execution.
    for (const blueprint of ALL) {
      for (const ask of blueprint.asks) {
        if (ask.kind !== 'choice' || !ask.list.parent) continue;
        const classKeys = new Set(ask.list.parent.values.map((value) => value.key));
        for (const value of ask.list.values) {
          expect(value.parentKey, `${blueprint.key}/${value.key}`).toBeDefined();
          expect(classKeys.has(value.parentKey as string)).toBe(true);
        }
        if (ask.list.parent.fallbackParentKey !== undefined) {
          expect(classKeys.has(ask.list.parent.fallbackParentKey)).toBe(true);
        }
      }
    }
  });

  it('asks bilingual wording of every question it creates', () => {
    for (const blueprint of ALL) {
      for (const ask of blueprint.asks) {
        if (ask.kind !== 'choice' && ask.kind !== 'number') continue;
        expect(ask.questionEn.length, `${blueprint.key}/${ask.questionCode}`).toBeGreaterThan(0);
        expect(ask.questionAr.length, `${blueprint.key}/${ask.questionCode}`).toBeGreaterThan(0);
      }
    }
  });
});

describe('the slot ids are golden', () => {
  /**
   * Regenerating this list to make a failure go away is the one edit that must never be
   * made: it is the assertion that a bank's typed figures still live where they were typed.
   * A blueprint's ways may be APPENDED to. Reordering or removing one renames the slots
   * after it, and `PRODUCT_TEMPLATE_ORPHANS_FIGURES` is what an operator would then hit.
   */
  const GOLDEN: Readonly<Record<string, string[]>> = {
    armed_forces_grades: ['primary'],
    academic_rank_table: ['primary', 'primary__uni_private', 'primary_pick'],
    // `years_in_practice_bands` split into these two. The clinic-owner half keeps the merged
    // product's slot ids byte-identical minus the two `cond__*` gates, so its bank figures
    // survive the split; the in-practice half is a fresh one-slot shape, because §8 prints one
    // table and the merged product had been giving that programme three identical columns.
    doctors_clinic_owner: [
      'primary',
      'primary__city_tier_other',
      'primary__city_tier_secondary',
      'primary_pick',
      'src__years_in_practice',
    ],
    doctors_in_practice: ['primary', 'src__years_in_practice'],
    card_limit_share: ['primary', 'src__credit_card_limit'],
    auto_loan_crosssell: [
      'alt',
      'basis',
      'basis_combine',
      'primary',
      'src__auto_loan_amount',
      'src__car_loan_installment',
    ],
    // No `src__pledged_months_since_issue`: a numeric condition's gate reads the fact
    // directly (`left: { fact }`), so only a way that BANDS or SCALES a number needs a
    // `factNumber` step of its own.
    pledged_collateral_share: ['cond__heldlongenough', 'primary', 'src__pledged_free_amount'],
    compound_owner: [
      'alt',
      'alt__owned_unit_type',
      'alt__owned_unit_type__top_up',
      'alt__owned_unit_type_pick',
      'alt__top_up',
      // The share of the down payment was APPENDED as the fifth way, so it takes a slot of
      // its own and renames none: the bracket way keeps the bare `alt` it has always had
      // even though the fact it reads moved onto the down payment, because that slot is
      // positional. Every id below this line is the one it was before.
      'alt__unit_down_payment',
      'alt__unit_down_payment__top_up',
      'alt__unit_down_payment_pick',
      'alt__unit_paid_to_date',
      'alt__unit_paid_to_date__top_up',
      'alt__unit_paid_to_date_pick',
      'alt_pick',
      'basis',
      'basis_combine',
      'cond__ownedlongenough',
      'cond__paidenough',
      'cond__paidenough__bound',
      'cond__unitworthenough',
      'primary',
      'primary__top_up',
      'primary_pick',
      // `share` survives and `share_on` is gone: the portion is the percentage the applicant
      // states, read through the shared source slot below, so there is no bank figure for a
      // slot to hold. Every bank that had filed one is reported before that figure is
      // dropped — see `blueprint-retemplate.command.ts`.
      'share',
      'src__unit_contract_price',
      'src__unit_down_payment',
      'src__unit_owned_share_pct',
      'src__unit_paid_to_date',
    ],
    school_stage_ceiling: ['primary', 'primary__school_international', 'primary_pick'],
  };

  /**
   * APPENDED to every product's golden list, not written into it: the I-Score multiplier is
   * declared on every income-bearing template (`iScore: true`), which adds these four slots
   * LAST and renames none — §5.4 holds, and `iscore-every-product.spec.ts` pins the append.
   * Kept out of the list above so the list keeps saying what each product's OWN shape is.
   */
  const I_SCORE_SLOTS = ['iscore_applied', 'iscore_band', 'iscore_factor', 'iscore_src'];

  it.each(ALL.filter(withProduct).map((b) => [b.key, b] as const))(
    '%s files its figures under exactly the ids it always has',
    (key, blueprint) => {
      const keys = paramKeysOf(compileTemplate(blueprint.template!)).slice().sort();
      expect(keys).toEqual([...GOLDEN[key]!, ...I_SCORE_SLOTS].sort());
    },
  );

  it('has a golden list for every product blueprint, so a new one cannot slip past', () => {
    expect(Object.keys(GOLDEN).sort()).toEqual(
      ALL.filter(withProduct)
        .map((b) => b.key)
        .sort(),
    );
  });
});

describe('a fact two products read belongs to neither', () => {
  it('names every shared fact key', () => {
    // Deleting a surrogate product deletes the facts filed under it. A fact two blueprints
    // read must therefore be filed under NO product, or the second one is refused at its
    // next save naming a fact nobody could see had been deleted.
    expect([...sharedBlueprintFactKeys()].sort()).toEqual([
      'loan_is_topup',
      'school_type',
      // Read by both doctor products since they were split apart — which is exactly the
      // case this rule exists for: switching one off must not take the other's only axis.
      'years_in_practice',
    ]);
  });

  it('is a fact both of those blueprints really declare', () => {
    for (const key of sharedBlueprintFactKeys()) {
      const owners = ALL.filter((blueprint) => blueprint.asks.some((ask) => ask.factKey === key));
      expect(owners.length).toBeGreaterThan(1);
    }
  });
});

describe('the doctors sheets are two products', () => {
  // They were one product until v25.0.0, on the reading that ABK's two sheets "use the same
  // bands with different figures … they are two programs" (§10.7). The bands are the same; the
  // rate, tenor, age floor, maximum, accepted employment type and the cap are not, and one
  // card could describe neither. `doctor-products-split.spec.ts` pins the split itself — what
  // is here is only that no third doctor blueprint appears and that the old key is gone.
  const READERS = ALL.filter((blueprint) =>
    blueprint.asks.some((ask) => ask.factKey === 'years_in_practice'),
  );

  it('is read by exactly the two of them, and by nothing else', () => {
    expect(READERS.map((blueprint) => blueprint.key).sort()).toEqual([
      'doctors_clinic_owner',
      'doctors_in_practice',
    ]);
  });

  it('has retired the merged product rather than renaming it', () => {
    // A rename would have been the cheap move and is the one thing that cannot be done: the
    // key is what a bank's figures, this product's asks and its facts are all addressed by.
    expect(productBlueprint('years_in_practice_bands')).toBeUndefined();
  });
});
