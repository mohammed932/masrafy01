/**
 * Feature 011 — which questionnaire answer feeds which SURROGATE income fact.
 *
 * A CODE CONSTANT, deliberately not a column on `Question`. Anti-Pattern A33
 * forbids scoring / eligibility / profile-mapping fields on `Question` /
 * `QuestionOption`, and constitution v6.0.0 specifically deleted
 * `Question.profileField`. `money-field-bindings.ts` records this reasoning
 * verbatim for the four economic figures and has shipped; surrogate facts are the
 * same kind of binding and get the same treatment — including the same accepted
 * residual limit: renaming a bound question code is a CODE change, and publish
 * warns when a binding stops resolving rather than failing silently.
 *
 * Codes are the SLUG OF THE ENGLISH LABEL (`slug.util.ts` derives them, and A33
 * forbids hand-typing them), so the seeded labels are load-bearing: "Military
 * grade" slugs to `military_grade` and binds; "Your military grade" would slug to
 * `your_military_grade` and never bind, with nothing but a publish warning to say
 * so. `test/unit/surrogate-binding-codes.spec.ts` asserts the equality rather
 * than trusting it.
 *
 * Six further facts (certificate value, total deposits, car installment, car loan
 * amount, bank-statement balance) are configurable and CHECKABLE but not asked in
 * this increment — their `ApplicantProfile` fields already exist and adding five
 * questions is a separate change (FR-016, narrowed). An unasked fact is
 * `SURROGATE_FACT_MISSING`, never a zero (FR-020).
 */

/** Fact → the question code it is answered by. */
export const SURROGATE_FACT_BINDINGS = {
  military_grade: 'military_grade',
  academic_rank: 'academic_rank',
  years_in_practice: 'years_in_practice',
  /**
   * NOT a new question. `credit_card_total_limit` already exists
   * (`money-field-bindings.ts`) as the card-limit answer feeding the 5% obligation
   * discount. The same stated figure feeds `assets.creditCardLimitEGP` — one fact,
   * two uses, asked once. A second card-limit question would ask the applicant the
   * same thing twice, which the money bindings already call out as the wrong move.
   *
   * Accepted limit: that question is itself branched behind `current_loans`
   * including `credit_cards`, so a card holder who declared no card debt is never
   * asked and `byCreditCardLimit` resolves to `SURROGATE_FACT_MISSING` (research
   * R2 — the correct FR-020 outcome, but it caps how often that method fires).
   */
  credit_card_limit: 'credit_card_total_limit',
} as const;

export type SurrogateFact = keyof typeof SURROGATE_FACT_BINDINGS;
export type SurrogateBoundQuestionCode = (typeof SURROGATE_FACT_BINDINGS)[SurrogateFact];

export const SURROGATE_FACT_KEYS = Object.keys(SURROGATE_FACT_BINDINGS) as readonly SurrogateFact[];

export const SURROGATE_BOUND_QUESTION_CODES = Object.values(
  SURROGATE_FACT_BINDINGS,
) as readonly SurrogateBoundQuestionCode[];

/** The question type each fact must be asked with, for publish-time validation. */
export type SurrogateFactQuestionType = 'SINGLE_SELECT' | 'NUMERIC';

export interface SurrogateFactSpec {
  readonly questionCode: SurrogateBoundQuestionCode;
  readonly type: SurrogateFactQuestionType;
  /**
   * The platform enumeration whose ACTIVE members ARE this question's option
   * codes (FR-017). `null` for a numeric fact. Making the two sides ONE list by
   * construction is the only way a rename cannot silently break the match —
   * matching by label would break on the ar/en pair alone (research R3).
   */
  readonly registry: string | null;
  /** Where the answer lands on `ApplicantProfile`. */
  readonly path: string;
}

/**
 * No per-fact category field, and no expected set of categories anywhere. Assignment is
 * authoritative and lives ONLY in `question_loan_category` (A33, v12.0.0) — and since
 * v16.0.0 it is also the DEFINITION of which categories can sell a no-payslip program:
 * a category whose applicants are asked one of these facts can, one whose applicants are
 * not, cannot. Nothing to compare it against, so nothing here to drift.
 */

export const SURROGATE_FACT_SPECS: Readonly<Record<SurrogateFact, SurrogateFactSpec>> =
  Object.freeze({
    military_grade: {
      questionCode: SURROGATE_FACT_BINDINGS.military_grade,
      type: 'SINGLE_SELECT',
      registry: 'military_grade',
      path: 'employment.militaryGrade',
    },
    academic_rank: {
      questionCode: SURROGATE_FACT_BINDINGS.academic_rank,
      type: 'SINGLE_SELECT',
      // The enumeration is `professor_rank`; the QUESTION is "Academic rank",
      // because a lecturer is not a professor and would not answer a question
      // that says so. The two names differing is intentional, not a typo.
      registry: 'professor_rank',
      path: 'employment.professorRank',
    },
    years_in_practice: {
      questionCode: SURROGATE_FACT_BINDINGS.years_in_practice,
      type: 'NUMERIC',
      registry: null,
      path: 'employment.yearsInPractice',
    },
    credit_card_limit: {
      questionCode: SURROGATE_FACT_BINDINGS.credit_card_limit,
      type: 'NUMERIC',
      registry: null,
      path: 'assets.creditCardLimitEGP',
    },
  });

/**
 * Why a binding does not resolve. Warning payload only — publish is never blocked, and a
 * program is never refused.
 *
 * All four ride ONE error code (`SURROGATE_FACT_BINDING_MISSING`) and are told apart by
 * `meta.reason`, rather than minting a code per shade of the same fault.
 *
 * `not_asked_by_any_category` replaced `not_assigned_to_surrogate_categories` in v16.0.0:
 * with capability derived from these assignments, a fact missing from one category is a
 * product decision, and only a fact asked NOWHERE is broken.
 *
 * The per-CATEGORY question — "does this program's own category ask the fact its method
 * reads?" — is answered in the admin bank-program form, at the moment the method is
 * picked, from the question pool that screen already holds. It is not a publish warning:
 * publish knows nothing about which programs exist, and at quote time the applicant
 * already gets `SURROGATE_FACT_MISSING` with a stated reason rather than a zero.
 */
export type SurrogateBindingWarningReason =
  | 'missing_or_inactive'
  | 'wrong_type'
  | 'option_codes_drifted'
  | 'not_asked_by_any_category';

/** The fact a bound question code serves, if any. */
export function surrogateFactForQuestionCode(code: string): SurrogateFact | undefined {
  return SURROGATE_FACT_KEYS.find((fact) => SURROGATE_FACT_SPECS[fact].questionCode === code);
}

/** The facts a given income strategy reads. Empty for `declared`. */
export const SURROGATE_FACTS_BY_STRATEGY: Readonly<Record<string, readonly SurrogateFact[]>> =
  Object.freeze({
    byMilitaryGrade: ['military_grade'],
    byProfessorRank: ['academic_rank'],
    byYearsInPractice: ['years_in_practice'],
    byCreditCardLimit: ['credit_card_limit'],
    // The remaining methods read profile fields that no question fills yet
    // (FR-016, narrowed). Listed with an empty set rather than omitted so a reader
    // can tell "asks nothing" from "not a strategy".
    byYearsInJob: [],
    byCDValue: [],
    byTotalDeposits: [],
    byCarInstallment: [],
    byCarLoanAmount: [],
    byBankStatementPercent: [],
    declared: [],
  });
