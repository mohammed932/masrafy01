/**
 * The question codes the FOUR BUILT-IN methods read.
 *
 * No longer the whole list. Which questions are facts is the registry's answer now
 * (`surrogate_fact` members and their bound question), read from the API by the screens
 * that need it — this constant survives only because four income methods
 * (`byMilitaryGrade` &c.) are frozen onto live offers and read these questions by name.
 *
 * Anything that prices a rule must read the registry, not this: a fact beyond the four is
 * absent here and always will be. The backend asserts each of the four resolves to a live
 * question (`test/unit/surrogate-binding-codes.spec.ts`).
 *
 * NOTE — these are QUESTION codes, and the near-identical `BUILTIN_FACT_KEYS` in
 * `bank-programs.types.ts` holds FACT keys. They differ by one entry and it is not a typo:
 * the fact is `credit_card_limit`, the question it is bound to is `credit_card_total_limit`.
 * Two namespaces, joined by `platform_enumeration.boundQuestionId`. Neither list is the
 * other's copy, and "fixing" one to match the other breaks the join.
 */
export const BUILTIN_FACT_QUESTION_CODES: readonly string[] = [
  'military_grade',
  'academic_rank',
  'years_in_practice',
  'credit_card_total_limit',
];

/**
 * The DERIVED facts — computed by the engine per quote rather than registered by an operator.
 *
 * THREE of them, one per per-bank axis: whether the applicant is KNOWN to the bank being
 * quoted, whether this loan is a TOP-UP of one they already have there, and whether they HOLD
 * ANOTHER PRODUCT there. The sheets label all three "NTB / something", and they are not the
 * same question — a customer with a card but no loan is existing, not a top-up, and a
 * cross-sell, all at once (spec §10.3).
 *
 * None has a registry row or a bound question (each question is bank-agnostic and multi-pick),
 * so every screen that lists "the facts this rule reads" has to know the two things a registry
 * row would otherwise have told it — the label, and the answers it can take. That is what
 * `DERIVED_FACTS` below carries, in ONE place, so a screen cannot offer an axis whose columns
 * another screen spells differently.
 */
export const BANK_RELATIONSHIP_FACT_KEY = 'bank_relationship';
export const LOAN_TOPUP_FACT_KEY = 'loan_is_topup';
export const OTHER_PRODUCT_FACT_KEY = 'holds_other_product';

export interface DerivedFactOption {
  code: string;
  label: string;
}

export interface DerivedFact {
  key: string;
  label: string;
  /** The standard column first — it is what an unanswered question falls to. */
  options: readonly DerivedFactOption[];
}

export const DERIVED_FACTS: readonly DerivedFact[] = [
  {
    key: BANK_RELATIONSHIP_FACT_KEY,
    label: $localize`:@@derived_fact.bank_relationship:Already banks here`,
    options: [
      { code: 'ntb', label: $localize`:@@derived_fact.ntb:New to this bank` },
      { code: 'xsell', label: $localize`:@@derived_fact.xsell:Already banks here` },
    ],
  },
  {
    key: LOAN_TOPUP_FACT_KEY,
    label: $localize`:@@derived_fact.loan_is_topup:Topping up a loan from this bank`,
    options: [
      { code: 'new_loan', label: $localize`:@@derived_fact.new_loan:A new loan` },
      { code: 'top_up', label: $localize`:@@derived_fact.top_up:A top-up of a loan here` },
    ],
  },
  {
    key: OTHER_PRODUCT_FACT_KEY,
    label: $localize`:@@derived_fact.holds_other_product:Holds a card or deposit here`,
    options: [
      {
        code: 'other_product_none',
        label: $localize`:@@derived_fact.other_product_none:Holds nothing else here`,
      },
      {
        code: 'other_product_held',
        label: $localize`:@@derived_fact.other_product_held:Holds a card or deposit here`,
      },
    ],
  },
];

/** The old single-axis export, kept so nothing that reads it has to change shape. */
export const BANK_RELATIONSHIP_OPTION_CODES: readonly string[] = ['ntb', 'xsell'];

export function derivedFactByKey(key: string): DerivedFact | undefined {
  return DERIVED_FACTS.find((fact) => fact.key === key);
}

export function isDerivedFactKey(key: string): boolean {
  return DERIVED_FACTS.some((fact) => fact.key === key);
}
