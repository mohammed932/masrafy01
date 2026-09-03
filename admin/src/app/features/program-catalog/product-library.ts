/**
 * The predefined-product library, as the screen reads it.
 *
 * Pure, and separate from the page for the reason every rule module in this bundle is: the
 * decisions below are the ones worth a test — which shelf a product sits on, whether an ask
 * is already set up, what a create is about to write — and none of them is testable inside a
 * component under bare jsdom, where `$localize` does not exist. So this file returns CODES and
 * COUNTS; the page turns them into sentences.
 */
import type { LoanCategory } from '@core/loan-category';
import type {
  BlueprintGroup,
  ProductBlueprint,
  ProductBlueprintAsk,
} from '@features/bank-programs/bank-programs.types';

/**
 * The shelves, in the order they are shown.
 *
 * Ordered by how much of the answer the product works out: a monthly income is the whole
 * guess, a ceiling is the whole guess in the other unit, and a cap is not a guess at all —
 * it sits on top of a real payslip. An operator scanning for "the doctors' product" reads
 * downwards and stops early; one scanning for "the company-coding table" reads to the end.
 */
export const LIBRARY_GROUPS: readonly BlueprintGroup[] = ['income', 'ceiling', 'cap'];

/** Whether an ask needs anything written at all. */
export type AskState = 'ready' | 'creates' | 'widens';

/**
 * What has to happen to an ask before the product can read it.
 *
 * Three answers, and the middle one is the one no other screen can show: a question that
 * EXISTS but is asked in none of this product's loan categories is set up as far as every
 * list is concerned, and asked of nobody. A product whose column reads it then quotes its
 * standard column for every applicant, and nothing says why.
 */
export function askState(ask: ProductBlueprintAsk): AskState {
  if (!ask.factExists || !ask.questionExists || !ask.listExists) return 'creates';
  if (ask.missingCategories.length > 0) return 'widens';
  return 'ready';
}

/** Whether a product can be created at all, and if not, why. */
export type LibraryBlock = 'no_pick' | 'no_name_en' | 'no_name_ar' | null;

/**
 * The one refusal this screen owns.
 *
 * A cap-only product takes NO name — it creates no product to name — so demanding one would
 * be the screen inventing a name for a thing that never gets one. Everything else the server
 * refuses (a key already taken, a form that cannot compile) is reported where it happens.
 */
export function libraryBlock(args: {
  picked: ProductBlueprint | null;
  labelEn: string;
  labelAr: string;
}): LibraryBlock {
  const { picked, labelEn, labelAr } = args;
  if (picked === null) return 'no_pick';
  if (picked.group === 'cap') return null;
  if (labelEn.trim() === '') return 'no_name_en';
  if (labelAr.trim() === '') return 'no_name_ar';
  return null;
}

/** One line of the "what this writes" summary. Counts, so the page can word them. */
export interface CreateLine {
  kind: 'lists' | 'values' | 'questions' | 'facts' | 'widens';
  count: number;
}

/**
 * What creating this product would write — the whole of it, before the operator commits.
 *
 * Empty means it writes nothing but the product row itself, which is the honest answer for a
 * product every one of whose asks the platform already has. Saying "nothing to set up" is
 * worth a line; saying it as five zeroes is not.
 */
export function createLines(blueprint: ProductBlueprint): CreateLine[] {
  const { creates } = blueprint;
  return (
    [
      { kind: 'lists', count: creates.lists },
      { kind: 'values', count: creates.values },
      { kind: 'questions', count: creates.questions },
      { kind: 'facts', count: creates.facts },
      { kind: 'widens', count: creates.widens },
    ] as const
  )
    .filter((line) => line.count > 0)
    .map((line) => ({ ...line }));
}

/** Products on one shelf, in library order. */
export function groupOf(
  blueprints: readonly ProductBlueprint[],
  group: BlueprintGroup,
): ProductBlueprint[] {
  return blueprints.filter((blueprint) => blueprint.group === group);
}

/**
 * The library narrowed by what the operator typed.
 *
 * Matched against the product's own name in BOTH locales and against the keys of what it
 * asks — an operator hunting for "the one that reads years in practice" is searching for the
 * fact, not for the product's name, and the fact key is the only word they have seen.
 * Matched against the KEY too, because that is what a colleague pastes into a message.
 */
export function searchLibrary(
  blueprints: readonly ProductBlueprint[],
  query: string,
): ProductBlueprint[] {
  const needle = query.trim().toLowerCase();
  if (needle === '') return [...blueprints];
  return blueprints.filter((blueprint) =>
    [
      blueprint.key,
      blueprint.labelEn,
      blueprint.labelAr,
      ...blueprint.asks.map((ask) => ask.factKey),
      ...blueprint.asks.map((ask) => ask.questionCode ?? ''),
    ]
      .join(' ')
      .toLowerCase()
      .includes(needle),
  );
}

/** Every loan category any ask of this product still has to be widened to. */
export function widenedCategories(blueprint: ProductBlueprint): LoanCategory[] {
  const seen = new Set<LoanCategory>();
  for (const ask of blueprint.asks) {
    for (const category of ask.missingCategories) seen.add(category);
  }
  return [...seen];
}

/**
 * How many of a product's asks are already set up.
 *
 * Shown on the card as "2 of 3 already set up" rather than as a colour, because the number is
 * the thing an operator is deciding on: three of three is a product they can finish in one
 * sitting, none of three is one that will put six new questions in front of every applicant.
 */
export function readyCount(blueprint: ProductBlueprint): number {
  return blueprint.asks.filter((ask) => askState(ask) === 'ready').length;
}
