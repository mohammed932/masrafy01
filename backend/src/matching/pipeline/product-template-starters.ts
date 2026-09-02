/**
 * The "start from…" list — the shapes an operator picks from when creating a product.
 *
 * Pure module (Constitution Principle V), and deliberately CONTENTLESS: a starter is a
 * shape and a key, nothing else.
 *
 *   NO WORDS. The admin names them from its own dictionary, in both locales. An English
 *   label here would be English on the wire (Principle III / A2) and untranslatable.
 *
 *   NO FIGURES. A bank's real numbers may appear beside an empty field as an example the
 *   operator reads, and that belongs to the screen; saved here they would become defaults
 *   that quietly become someone's live table.
 *
 *   NO BANK NAMES, and no product names either. One product is sold by many banks off the
 *   same mechanism with different numbers — ABK, CAE, EG Bank and FABMISR all sell the
 *   compound guarantee — so a bank baked into a starter key would be a hardcoded bank
 *   (Principle II / A1). Every key below names HOW the figure is worked out.
 *
 * Not a seed, either. A starter is picked at create time and compiled into that product's
 * own rule; nothing writes these to the database. The previous library WAS a seed, and
 * `seed-program-catalog.ts` wrote `incomeRule` back over live rows because of it.
 *
 * ─── Why a CEILING may be keyed by a plain choice (`ceiling_by_choice`) ───────
 *
 * The design spec lists seven shapes and none of them is "a ceiling from what the customer
 * picked" — the only choice-keyed shape it lists produces an income. Its §10.2 explains
 * why: on nine of the source sheets the choice-keyed ceiling (property type, school type,
 * branch, company coding) is printed under the heading *Loan Amount — Maximum*, which makes
 * it the BANK PROGRAM's cap and not part of guessing the income. That reading stands, and
 * `loanLimits.maxLoanByFact` is where it is configured — three of those sheets have no
 * surrogate rule to hang a second path on at all.
 *
 * This starter is the other case, and it is a real one: the product whose WHOLE calculation
 * is a ceiling read off what the customer owns — EGBank's compound guarantee keys its
 * ceiling by the compound, and a bank keying the same product by the kind of unit is the
 * same mechanism with a different list. Both sides are a ceiling in EGP, so they are the
 * same unit, which is the one condition §10.2 keeps `minOf` for. Nothing here weakens that
 * boundary: a ceiling that caps a real income still belongs on the program.
 */

import type { ProductTemplate, TemplateMechanism } from './product-template';
import { TEMPLATE_VERSION } from './product-template';

/**
 * The starter keys. Closed, and stable: the admin's labels and its worked examples are
 * keyed by these, so a rename is a rename in two places (A25).
 */
export const TEMPLATE_STARTERS = [
  'income_by_rank',
  'income_by_years',
  'income_share_of_figure',
  'income_multiple_of_figure',
  'ceiling_by_class',
  'ceiling_by_bracket',
  'ceiling_share_of_paid',
  'ceiling_by_choice',
] as const;

export type TemplateStarterKey = (typeof TEMPLATE_STARTERS)[number];

export interface TemplateStarter {
  key: TemplateStarterKey;
  outputKind: ProductTemplate['outputKind'];
  /**
   * The mechanism, minus its fact — which the operator picks on the next screen from the
   * questions this product actually asks. A fact named here would be a hardcoded question.
   */
  mechanism: TemplateMechanism['kind'];
}

const STARTERS: readonly TemplateStarter[] = Object.freeze([
  { key: 'income_by_rank', outputKind: 'monthlyIncome', mechanism: 'choiceTable' },
  { key: 'income_by_years', outputKind: 'monthlyIncome', mechanism: 'numberBand' },
  { key: 'income_share_of_figure', outputKind: 'monthlyIncome', mechanism: 'shareOf' },
  { key: 'income_multiple_of_figure', outputKind: 'monthlyIncome', mechanism: 'multipleOf' },
  { key: 'ceiling_by_class', outputKind: 'maxAmount', mechanism: 'classTable' },
  { key: 'ceiling_by_bracket', outputKind: 'maxAmount', mechanism: 'numberBand' },
  { key: 'ceiling_share_of_paid', outputKind: 'maxAmount', mechanism: 'shareOf' },
  { key: 'ceiling_by_choice', outputKind: 'maxAmount', mechanism: 'choiceTable' },
]);

export function templateStarters(): readonly TemplateStarter[] {
  return STARTERS;
}

export function templateStarter(key: string): TemplateStarter | undefined {
  return STARTERS.find((starter) => starter.key === key);
}

/**
 * A starter as an empty form, ready for the fact the operator is about to pick.
 *
 * `fact: ''` rather than a placeholder that looks like a real key: the form is INCOMPLETE
 * until the operator names the question, `validateTemplate` says so
 * (`mechanism_needs_fact`), and a plausible-looking default is how a product gets saved
 * reading a question nobody meant.
 */
export function blankTemplate(starter: TemplateStarter): ProductTemplate {
  return {
    version: TEMPLATE_VERSION,
    outputKind: starter.outputKind,
    primary:
      starter.mechanism === 'flatAmount'
        ? { kind: 'flatAmount' }
        : { kind: starter.mechanism, fact: '' },
    conditions: [],
  };
}
