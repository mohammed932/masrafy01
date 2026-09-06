import type { AdditionalIncomeOption } from '@shared/ui/additional-income-editor.component';
import type { RegistryFact } from './bank-programs.types';

/**
 * The yes/no every source of additional income is asked behind.
 *
 * One question code, not a list of the four sources — and that is the point. The seed
 * (`backend/prisma/seed-questionnaire.ts`, `ADDITIONAL_INCOME_SOURCES`) gates rent,
 * certificate returns, fixed allowances and variable allowances on this answer and gates
 * nothing else on it. A fifth source seeded tomorrow needs no edit here; a hand-typed list
 * of four keys would.
 *
 * Lives beside its only consumer rather than in `core/surrogate-facts.ts`, which cannot be
 * imported from a unit test: that module builds localized labels at module scope, so
 * pulling it in drags `$localize` into a pure-function spec.
 */
export const ADDITIONAL_INCOME_GATE = 'additional_income';

/**
 * The sources of money the applicant ALSO receives, out of the whole fact registry.
 *
 * ─── Why this is not "every numeric fact" ─────────────────────────────────────
 *
 * It was, and on a real database that is seventeen rows. Four of them are money somebody
 * receives every month — rent, certificate returns, fixed allowances, variable allowances.
 * The other thirteen are a unit's contract price, its down payment, how many months ago a
 * certificate was issued, a bureau score, a requested tenor. The screen asked the operator
 * what percentage of "How many months ago was it issued?" this bank counts as income, and
 * asked it thirteen more times than it should have.
 *
 * ─── Why the questionnaire's own gate, and not a list of keys ─────────────────
 *
 * Because a list of keys is a second statement of something already stated. The seed
 * (`ADDITIONAL_INCOME_SOURCES` in `seed-questionnaire.ts`) asks all four behind
 * `additional_income = yes`, and asks nothing else behind it. So "is this money the
 * applicant also receives?" is a question the questionnaire can already answer, and a fifth
 * source seeded next month is picked up here with no edit at all.
 *
 * Not a suffix match on `_monthly` either: that is a naming convention, and a convention is
 * not a promise.
 *
 * ─── Why a source the questionnaire dropped is still listed ───────────────────
 *
 * Because the WEIGHT is stored on the program and still in effect. Dropping the row would
 * leave a figure counting toward every applicant's income with no control on any screen
 * able to see it, let alone clear it. It is listed and tagged instead, so the operator can
 * decide.
 */
export function additionalIncomeSources(
  facts: readonly RegistryFact[],
  weighedFactKeys: readonly string[] = [],
): AdditionalIncomeOption[] {
  const weighed = new Set(weighedFactKeys);
  return facts
    .filter((fact) => fact.question?.type === 'NUMERIC')
    .filter((fact) => isAdditionalIncomeFact(fact) || weighed.has(fact.key))
    .map((fact) => ({
      key: fact.key,
      label: fact.label,
      ...(isAdditionalIncomeFact(fact) ? {} : { retired: true }),
    }));
}

function isAdditionalIncomeFact(fact: RegistryFact): boolean {
  return fact.question?.enabledWhen?.questionCode === ADDITIONAL_INCOME_GATE;
}
