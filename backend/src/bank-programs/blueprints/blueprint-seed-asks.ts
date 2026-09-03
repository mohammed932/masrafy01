/**
 * THE BLUEPRINT HALF OF THE ASK SET — the half SQL could not backfill.
 *
 * `surrogate_product_ask` says which facts a product reads. Its migration backfilled the
 * rows `platform_enumeration.surrogateProductKey` happens to hold, which is only some of
 * them: the planner withholds that column for a fact several blueprints share (a cascade
 * would kill one product's axis when another product went away) and for every cap-only
 * blueprint, which mints no product row for a fact to be filed under. On a real database
 * that was 15 of 27 facts filed under nothing — and `club_branch_cap`, a product whose
 * entire content is one ask, read "asks the applicant nothing yet".
 *
 * Knowing the rest needs `BLUEPRINTS`, which is TypeScript, so it lands here.
 *
 * A SEPARATE PASS, not a plan step, and the reason is the cap products: their product ROW is
 * minted by the command AFTER `createFromBlueprint` returns, so an ask step inside the plan
 * would have no row to point at on a first run. Running afterwards also lets it cover the
 * `skip` action — a product that already holds a calculation still needs its list rendered —
 * which a create-path step by definition cannot reach.
 *
 * INSERT-ONLY, and that is what keeps `seed:blueprints` safe to run on a database an
 * operator has been working in: an ask row is the library's own statement about its product,
 * an insert can never remove an operator's pick, and `addAsk` is idempotent by primary key,
 * so a second run writes nothing.
 *
 * That idempotency is also what carries an operator's UNTICK across a deploy. Removing a
 * blueprint ask on the product's screen tombstones the row (`detachedAt`) rather than
 * deleting it, so the insert below collides with a row that is still there and writes
 * nothing — `revive: false` is the half that says so out loud.
 */
import { ASK_SOURCE, type ProductAsksRepository } from '../asks/product-asks.repository';
import type { ProductBlueprint } from './product-blueprint.types';

/** Just enough of the registry to resolve two keys to two ids. */
export interface AskSeedEnums {
  findByTypeAndKey(type: string, key: string): Promise<{ id: string; key: string } | null>;
}

export interface AskSeedResult {
  /** Fact keys whose ask row this run created. */
  added: string[];
  /**
   * Fact keys the blueprint asks for that have no `surrogate_fact` row at all.
   *
   * Reported rather than skipped in silence: a blueprint that names a fact nothing created
   * is drift the command already prints for the other three halves (question, list, fact),
   * and an ask row cannot be written for a row that is not there.
   */
  missingFacts: string[];
}

/**
 * Record every fact one blueprint's product reads.
 *
 * Every ask kind counts, including `platformFact` and `derivedFact` — which produce no
 * write at all in the plan. That is the point: `military_grade` is a platform fact and
 * `armed_forces_grades` is the product that reads it, so without this the product that
 * exists to ask about a grade would list nothing.
 *
 * A DERIVED fact has no registry row by construction (the platform computes it per bank
 * from the program's own bank), so it is not an ask row either — there is nothing to point
 * at, and it is not something an operator can curate. It is excluded rather than reported
 * as missing.
 */
export async function ensureBlueprintAsks(args: {
  blueprint: ProductBlueprint;
  productKey: string;
  asks: ProductAsksRepository;
  actorStaffId: string;
}): Promise<AskSeedResult> {
  const { blueprint, productKey, asks } = args;

  const factKeys = [
    ...new Set(
      blueprint.asks.filter((ask) => ask.kind !== 'derivedFact').map((ask) => ask.factKey),
    ),
  ].sort();

  const added: string[] = [];
  const missingFacts: string[] = [];
  for (const factKey of factKeys) {
    const outcome = await asks.addAskByKeys({
      productKey,
      factKey,
      source: ASK_SOURCE.blueprint,
      createdBy: args.actorStaffId,
      // NEVER revive. An operator may untick a blueprint ask on the product's screen, which
      // tombstones the row rather than deleting it — precisely so this insert collides with
      // something and the removal stands. Reviving here would undo their decision on the
      // next deploy, silently, which is the failure the untick refusal used to prevent.
      revive: false,
    });
    // `missing` covers both halves: a fact nothing created, and a cap product whose row is
    // minted by the command after this runs on its very first pass. Both are reported and
    // both are closed by the next run.
    if (outcome === 'missing') missingFacts.push(factKey);
    if (outcome === 'added') added.push(factKey);
  }
  return { added, missingFacts };
}
