/**
 * What the blueprint seed decides BEFORE it writes anything: for each predefined product,
 * whether to build it, resume a half-built one, mint the row for a cap-only one, or leave
 * an existing calculation alone.
 *
 * Pure — no Nest, no Prisma, no clock. Split out from the command for one reason: the
 * command cannot be unit-tested (it boots a Nest context and talks to a database) and this
 * decision is the part that can be wrong in a way nobody notices. `skip` in particular is
 * a promise to the operator — the seed never overwrites a calculation somebody edited — and
 * a promise that only a person can check is a promise that breaks.
 */
import type { ProductBlueprint } from './product-blueprint.types';

/** What the seed found in the database for one blueprint. `null` = no product row. */
export interface ExistingProduct {
  readonly key: string;
  /** `true` when the row already holds a calculation — somebody's work. */
  readonly hasRule: boolean;
}

export type BlueprintSeedAction =
  /** No row yet: run the blueprint, which writes its lists, questions, facts and rule. */
  | { readonly kind: 'create'; readonly productKey: string }
  /**
   * A row exists but holds no calculation — a previous run stopped part-way. Running the
   * blueprint again writes exactly what is missing: every object is looked up by key first,
   * and `createFromBlueprint` accepts a taken key only in this state.
   */
  | { readonly kind: 'resume'; readonly productKey: string }
  /**
   * Already built. LEFT ALONE, and this is the guarantee, not an optimisation: an operator
   * may still edit a product's figures, so a seed that re-wrote the calculation would undo
   * their work on the next deploy. `createFromBlueprint` refuses this state anyway
   * (`ENUMERATION_KEY_DUPLICATE`); classifying it here means the seed reports it as normal
   * rather than as an error.
   */
  | { readonly kind: 'skip'; readonly productKey: string }
  /**
   * A cap-only blueprint: it guesses no income, so it builds its question, its list and its
   * fact, and the seed then mints the product ROW itself. The row exists so the operator
   * gets one card and one switch per product; it holds no calculation and never will.
   */
  | { readonly kind: 'cap'; readonly productKey: string; readonly rowExists: boolean };

/**
 * The key the seed writes, which is the BLUEPRINT's key and never a slug of the name.
 *
 * `createFromBlueprint` slugs `labelEn` when no key is given, so omitting it would create
 * `income_by_armed_forces_grade` where every other surface — the cap-only predicate, a
 * bank program's stored link, this file's own idempotence — expects `armed_forces_grades`.
 * Stated explicitly, once, here.
 */
export function seedProductKey(blueprint: ProductBlueprint): string {
  return blueprint.key;
}

export function planSeedAction(
  blueprint: ProductBlueprint,
  existing: ExistingProduct | null,
): BlueprintSeedAction {
  const productKey = seedProductKey(blueprint);
  if (blueprint.group === 'cap') {
    return { kind: 'cap', productKey, rowExists: existing !== null };
  }
  if (existing === null) return { kind: 'create', productKey };
  return existing.hasRule ? { kind: 'skip', productKey } : { kind: 'resume', productKey };
}
