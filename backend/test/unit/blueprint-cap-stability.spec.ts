/**
 * Every blueprint cap keys its rows by something an applicant can actually answer.
 *
 * A cap row is matched against the OPTION CODE of the answer the applicant picked
 * (`factAnswerHasKey`), or against the CLASS that answer is filed under when the axis says
 * `parentClass`. A row keyed by anything else matches nobody: the applicant lands on
 * `onNoMatch`, the program reads as configured on every screen, and the only symptom is a
 * loan amount that is either uncapped or refused for a reason nobody chose.
 *
 * The trap this exists to catch is written up at `demo-figures/sheet-figures.ts:25-30` — the
 * unit type's option code is `twin_or_town_house` while its registry key is `twin_house`, so
 * one of the two spellings prices nothing and both look right in a file. It was found by a
 * save being refused, i.e. by a human trying it, which is exactly the kind of finding that
 * belongs in a test.
 *
 * ─── What this file can and cannot prove ─────────────────────────────────────
 *
 * There is no database here, so the authority for "what are this fact's option codes?" has
 * to be the blueprint itself. It is one for a `choice` ask and only a `choice` ask: that ask
 * CREATES the list and creates the question over it with `optionsFromEnumerationType`, which
 * is what makes `question_option.code` === `platform_enumeration.key` — so the keys it
 * declares are the codes.
 *
 * A `platformFact` ask only ADDS to a list that already exists (three of the professors'
 * seven ranks were already there), and a `bindQuestion` ask points at somebody else's
 * question entirely. Neither can be checked against a file, so those axes get the structural
 * checks instead — the fact is asked at all, and where the product's own template keys the
 * same axis, the two agree.
 */

import { describe, expect, it } from 'vitest';
import { productBlueprints } from '../../src/bank-programs/blueprints/product-blueprints';
import type {
  BlueprintAsk,
  BlueprintCap,
  ProductBlueprint,
} from '../../src/bank-programs/blueprints/product-blueprint.types';
import { derivedFactOptionCodes } from '../../src/matching/pipeline/surrogate-fact-registry';

/**
 * Keys a blueprint states that this file CANNOT vouch for, and why.
 *
 * Every entry is a divergence somebody has to decide about, not a permission. The staleness
 * check below fails when one stops being needed, so a fix deletes its entry rather than
 * leaving a waiver nobody remembers the reason for.
 */
const KNOWN_DIVERGENCES: ReadonlyArray<{
  blueprintKey: string;
  axis: 'rowKeys' | 'columnKeys';
  key: string;
}> = [
  {
    // `owned_unit_type` reads the question `what_kind_of_unit_do_you_own`, which EXISTS on
    // the live database with the option codes `apartment` / `twin_or_town_house` / `villa` —
    // slugged from its own labels, because it was created (2026-08-30) before this ask
    // declared a list, and `property_type` carries no `mirrorQuestionId` to this day. The
    // cap, `sheet-figures.ts` and `sheet-programs.ts` all key `twin_or_town_house` and are
    // correct against that database; the validator refuses `twin_house` there, which is how
    // the trap was found in the first place.
    //
    // What the file says is the OTHER answer: the ask now declares
    // `list: { typeKey: 'property_type', values: [apartment, twin_house, villa] }`, and on a
    // database where that question does not yet exist the blueprint creates it mirrored to
    // that list — option codes `apartment` / `twin_house` / `villa`, and every
    // `twin_or_town_house` row then prices nobody.
    //
    // So the two are right on different databases, and neither is safe to "fix" here:
    // re-keying the cap breaks the live programs, and re-keying the list mints a second
    // registry name for one answer. It is reported rather than resolved.
    blueprintKey: 'compound_owner',
    axis: 'rowKeys',
    key: 'twin_or_town_house',
  },
];

type KeySource =
  /** The blueprint creates this list, so what it declares IS the option-code set. */
  | { kind: 'declared'; keys: readonly string[] }
  /** It only adds to a list that already exists — a superset lives in the registry. */
  | { kind: 'additive' }
  /** Somebody else's question. Nothing in this file can say what it offers. */
  | { kind: 'unverifiable' };

const askFor = (blueprint: ProductBlueprint, factKey: string): BlueprintAsk | undefined =>
  blueprint.asks.find((ask) => ask.factKey === factKey);

function keySourceFor(
  blueprint: ProductBlueprint,
  factKey: string,
  via: 'answer' | 'parentClass' | undefined,
): KeySource {
  // A derived fact has no registry row and no question: its branch codes are a closed list
  // the engine owns, which makes it the one axis this file can check exhaustively.
  const derived = derivedFactOptionCodes(factKey);
  if (derived !== null) return { kind: 'declared', keys: derived };

  const ask = askFor(blueprint, factKey);
  if (ask === undefined) return { kind: 'unverifiable' };
  if (ask.kind !== 'choice') {
    return ask.kind === 'platformFact' && ask.addValues !== undefined
      ? { kind: 'additive' }
      : { kind: 'unverifiable' };
  }
  if (via === 'parentClass') {
    const parent = ask.list.parent;
    return parent === undefined
      ? { kind: 'unverifiable' }
      : { kind: 'declared', keys: parent.values.map((value) => value.key) };
  }
  return { kind: 'declared', keys: ask.list.values.map((value) => value.key) };
}

/** The branch list the product's own template keys this axis by, when it keys one. */
function templateBranchesFor(
  blueprint: ProductBlueprint,
  factKey: string,
  via: 'answer' | 'parentClass' | undefined,
): readonly string[] | undefined {
  const column = blueprint.template?.secondColumn;
  if (column === undefined || column.fact !== factKey) return undefined;
  return (column.branchOn ?? 'answer') === (via ?? 'answer') ? column.branches : undefined;
}

const capBlueprints = productBlueprints().filter(
  (blueprint): blueprint is ProductBlueprint & { cap: BlueprintCap } => blueprint.cap !== undefined,
);

describe('the caps the product blueprints declare', () => {
  it('there are some — a vacuous sweep would pass forever', () => {
    expect(capBlueprints.length).toBeGreaterThan(0);
  });

  it.each(capBlueprints.map((blueprint) => [blueprint.key, blueprint] as const))(
    '%s keys its cap by answers the product asks for',
    (_key, blueprint) => {
      const cap = blueprint.cap;
      const axes = [
        { axis: 'rowKeys' as const, factKey: cap.factKey, via: cap.rowVia, keys: cap.rowKeys },
        ...(cap.columnFactKey === undefined
          ? []
          : [
              {
                axis: 'columnKeys' as const,
                factKey: cap.columnFactKey,
                via: cap.columnVia,
                keys: cap.columnKeys,
              },
            ]),
      ];

      for (const { axis, factKey, via, keys } of axes) {
        // A cap keyed by a fact the product never asks for is a table nobody can reach: the
        // answer is not in `factsForProgram`, so every applicant is `fact_not_answered`.
        const derived = derivedFactOptionCodes(factKey) !== null;
        expect(
          derived || askFor(blueprint, factKey) !== undefined,
          `${blueprint.key}: the cap's ${axis} read ${factKey}, which this product never asks for`,
        ).toBe(true);

        const source = keySourceFor(blueprint, factKey, via);
        if (source.kind === 'declared') {
          const waived = new Set(
            KNOWN_DIVERGENCES.filter(
              (d) => d.blueprintKey === blueprint.key && d.axis === axis,
            ).map((d) => d.key),
          );
          for (const key of keys ?? []) {
            if (waived.has(key)) continue;
            expect(
              source.keys,
              `${blueprint.key}: the cap's ${axis} names ${key}, which ${factKey}'s own list does not`,
            ).toContain(key);
          }
        }

        // Where the product's own template keys the SAME axis the SAME way, the two must
        // agree — the income table and the cap are then reading one answer, and a bank
        // filling one grid and being priced off the other is not a state anybody could see.
        const branches = templateBranchesFor(blueprint, factKey, via);
        if (branches !== undefined) {
          for (const key of keys ?? []) {
            expect(
              branches,
              `${blueprint.key}: the cap's ${axis} names ${key}, which its own template does not branch on`,
            ).toContain(key);
          }
        }
      }
    },
  );

  it.each(capBlueprints.map((blueprint) => [blueprint.key, blueprint] as const))(
    '%s declares a grid that can be filled in',
    (_key, blueprint) => {
      const cap = blueprint.cap;
      // Exactly one row axis. Both would be two ways to name one cell, and neither leaves
      // the operator a grid to type into at all.
      expect(
        (cap.rowKeys !== undefined) !== (cap.bands !== undefined),
        `${blueprint.key}: a cap states EITHER row keys OR bands`,
      ).toBe(true);
      expect((cap.rowKeys ?? cap.bands ?? []).length).toBeGreaterThan(0);
      // A column axis is a fact AND its keys. Keys with no fact resolve against nothing; a
      // fact with no keys leaves a column the screen cannot draw.
      expect(
        (cap.columnFactKey !== undefined) === (cap.columnKeys !== undefined),
        `${blueprint.key}: a column axis needs both a fact and its keys`,
      ).toBe(true);
      expect(new Set(cap.rowKeys ?? []).size).toBe((cap.rowKeys ?? []).length);
      expect(new Set(cap.columnKeys ?? []).size).toBe((cap.columnKeys ?? []).length);
    },
  );

  it('every waiver above is still needed', () => {
    // A divergence that has been fixed must take its entry with it, or the next one hides
    // behind a comment describing something that is no longer true.
    for (const divergence of KNOWN_DIVERGENCES) {
      const blueprint = capBlueprints.find((b) => b.key === divergence.blueprintKey);
      expect(
        blueprint,
        `waiver for ${divergence.blueprintKey}, which declares no cap`,
      ).toBeDefined();
      if (blueprint === undefined) continue;
      const cap = blueprint.cap;
      const stated = (divergence.axis === 'rowKeys' ? cap.rowKeys : cap.columnKeys) ?? [];
      expect(stated, `waiver names ${divergence.key}, which the cap no longer states`).toContain(
        divergence.key,
      );
      const source = keySourceFor(
        blueprint,
        divergence.axis === 'rowKeys' ? cap.factKey : (cap.columnFactKey as string),
        divergence.axis === 'rowKeys' ? cap.rowVia : cap.columnVia,
      );
      expect(
        source.kind === 'declared' && !source.keys.includes(divergence.key),
        `waiver for ${divergence.blueprintKey}.${divergence.key} is stale — the list now declares it`,
      ).toBe(true);
    }
  });
});
