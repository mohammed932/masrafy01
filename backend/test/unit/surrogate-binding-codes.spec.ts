/**
 * T073 / FR-016, FR-017, U1 — the bindings actually resolve.
 *
 * The failure mode this guards is SILENT. `slug.util.ts` derives a question's
 * immutable `code` from its English label and A33 forbids hand-typing codes, so a
 * label of "Your military grade" slugs to `your_military_grade`, the binding constant
 * never matches, and NOTHING breaks loudly: the rule simply resolves to
 * `SURROGATE_FACT_MISSING` for every applicant forever, and only a publish warning
 * would ever say so.
 *
 * So this asserts the equality rather than trusting it — and asserts it against the
 * SEED, not against a copy of the labels retyped here, which would pass while the seed
 * drifted.
 *
 * Reads the seed module's own question objects rather than a live database: the claim
 * is about the code the seed WILL write, and it must hold before anything is seeded.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  SURROGATE_BOUND_QUESTION_CODES,
  SURROGATE_FACT_KEYS,
  SURROGATE_FACT_SPECS,
} from '@/matching/pipeline/surrogate-fact-bindings';
import { slugify } from '@/questionnaire/slug.util';
import { CREDIT_CARD_LIMIT_QUESTION_CODE } from '@/matching/pipeline/money-field-bindings';

const SEED_PATH = resolve(__dirname, '../../prisma/seed-questionnaire.ts');
const seedSource = readFileSync(SEED_PATH, 'utf8');

/**
 * The seed declares each fact question as a `SeedQuestion` literal. Parsing the
 * source for the (code, questionEn, type, isRequired, enabledWhen, optionsFromEnum)
 * of one block is enough to assert every claim below, and keeps the test independent
 * of a database.
 */
function seedBlockFor(code: string): string {
  const marker = `code: '${code}',`;
  const start = seedSource.indexOf(marker);
  expect(start, `seed block for '${code}' not found`).toBeGreaterThan(-1);
  // A `SeedQuestion` literal ends at the closing `};` of its const declaration.
  const end = seedSource.indexOf('\n};', start);
  return seedSource.slice(start, end === -1 ? start + 2000 : end);
}

/**
 * The three questions THIS feature seeds. `credit_card_limit` is excluded on purpose:
 * it binds to the PRE-EXISTING `credit_card_total_limit`, which feature 010 emits from
 * a generator rather than a literal, so its label→slug relationship is that feature's
 * invariant. What matters here is that both features name the SAME question — asserted
 * separately below against `MONEY_FIELD_BINDINGS`.
 */
const SEEDED_FACTS = ['military_grade', 'academic_rank', 'years_in_practice'] as const;

describe('every bound question code is the SLUG OF ITS OWN ENGLISH LABEL', () => {
  it.each([...SEEDED_FACTS])('%s', (fact) => {
    const spec = SURROGATE_FACT_SPECS[fact];
    const block = seedBlockFor(spec.questionCode);
    const label = /questionEn: '([^']+)'/.exec(block)?.[1];
    expect(label, `no questionEn for ${spec.questionCode}`).toBeTruthy();
    // The load-bearing assertion. If someone rewords the label for clarity, this
    // fails here instead of silently unbinding the fact in production.
    expect(slugify(label!)).toBe(spec.questionCode);
  });

  it('binds the card limit to the same question the MONEY bindings do', () => {
    // One fact, two uses, asked once. If either side is renamed, the surrogate rule
    // and the 5% obligation discount would read different questions — and the rule
    // would resolve to nothing while the discount kept working, which is the hardest
    // version of this bug to notice.
    expect(SURROGATE_FACT_SPECS.credit_card_limit.questionCode).toBe(
      CREDIT_CARD_LIMIT_QUESTION_CODE,
    );
  });
});

describe('each fact question carries the type its rule reads', () => {
  it('military_grade and academic_rank are SINGLE_SELECT', () => {
    for (const fact of ['military_grade', 'academic_rank'] as const) {
      const spec = SURROGATE_FACT_SPECS[fact];
      expect(spec.type).toBe('SINGLE_SELECT');
      const block = seedBlockFor(spec.questionCode);
      // SINGLE_SELECT is the seed's default, so the absence of an explicit `type:`
      // is what makes it one. Asserting "not NUMERIC / MULTI_SELECT / TEXT" is the
      // honest form of that.
      expect(block).not.toMatch(/type: 'NUMERIC'/);
      expect(block).not.toMatch(/type: 'MULTI_SELECT'/);
      expect(block).not.toMatch(/type: 'TEXT'/);
    }
  });

  it('years_in_practice is NUMERIC with 0–60 whole-year bounds', () => {
    const block = seedBlockFor(SURROGATE_FACT_SPECS.years_in_practice.questionCode);
    expect(block).toMatch(/type: 'NUMERIC'/);
    expect(block).toMatch(/minValue: '0'/);
    expect(block).toMatch(/maxValue: '60'/);
    expect(block).toMatch(/step: '1'/);
    expect(block).toMatch(/unitEn: 'years'/);
  });
});

describe("FR-017 — a choice fact's options come FROM the registry, never hand-typed", () => {
  it.each([
    ['military_grade', 'military_grade'],
    ['academic_rank', 'professor_rank'],
  ] as const)('%s draws its options from the %s registry', (fact, registry) => {
    const spec = SURROGATE_FACT_SPECS[fact];
    expect(spec.registry).toBe(registry);
    const block = seedBlockFor(spec.questionCode);
    // `optionsFromEnum` expands to the ACTIVE members at seed time, so the customer's
    // option codes ARE the keys the admin's table is keyed by — one list by
    // construction. A hand-written `options: [...]` here would be two lists that
    // agree today and drift on the first rename (research R3).
    expect(block).toMatch(new RegExp(`optionsFromEnum: '${registry}'`));
    expect(block).toMatch(/options: \[\],/);
  });
});

describe('none of the fact questions is REQUIRED', () => {
  it.each([...SEEDED_FACTS])('%s is optional', (fact) => {
    const spec = SURROGATE_FACT_SPECS[fact];
    const block = seedBlockFor(spec.questionCode);
    // A required fact question would block apply for every applicant the fact does
    // not describe — the opposite of what these are for. Skipping is a stated reason
    // (FR-020), not an error.
    expect(block).toMatch(/isRequired: false/);
  });
});

describe('branching matches what `enabledWhen` can actually express', () => {
  it('gates both SINGLE_SELECTs on the SAME single option code', () => {
    // The accepted limit (research R11): `enabledWhen` holds ONE `optionCode`, and
    // `EMPLOYMENT_OPTIONS` has no option separating a soldier from an academic. So a
    // government employee is asked both and skips the one that does not apply — which
    // FR-020 already defines as a stated reason, never a zero.
    for (const fact of ['military_grade', 'academic_rank'] as const) {
      const block = seedBlockFor(SURROGATE_FACT_SPECS[fact].questionCode);
      expect(block).toMatch(/questionCode: 'employment_status'/);
      expect(block).toMatch(/operator: 'equals'/);
      expect(block).toMatch(/optionCode: 'government_employee'/);
      // Not a list: `enabledWhen` takes one code, and writing an array would be
      // silently ignored.
      expect(block).not.toMatch(/optionCodes:/);
    }
  });

  it('leaves years_in_practice UNGATED', () => {
    // Its population spans `freelancer` and `business_owner_company_owner`, which one
    // branch rule cannot express — so it is shown to everyone and left optional.
    const block = seedBlockFor(SURROGATE_FACT_SPECS.years_in_practice.questionCode);
    // The FIELD, not the word: the seed's own comment explains why there is no gate,
    // and matching the bare identifier would flag that explanation as a gate.
    expect(block).not.toMatch(/enabledWhen:/);
  });
});

describe('assignment and pool membership', () => {
  it('seeds the three fact questions under every SURROGATE-CAPABLE category, nowhere else', () => {
    // Referencing them in a CategoryConfig is what assigns them in
    // `question_loan_category` (A33 — assignment lives only there). A MORTGAGE or
    // BUSINESS applicant must never be asked their army rank: those two categories are
    // payslip-only, and a weighted question they can never answer would eat the
    // asked-weight denominator (Principle V).
    //
    // TWO references, `personal` and `car` — the seeded DEFAULT for where a no-payslip
    // program can be sold, not a fixed rule: v16.0.0 derives capability from these very
    // assignments, so an operator adds `mortgage` on the questionnaire screen without
    // touching this seed. `personal` in particular must keep them because live bank
    // programs (`ABK-MILITARY`, `ABK-PROFESSORS` and the two `ABK-PER-DOCTORS_*` sheets) are
    // `personal` + `income_surrogate` and read them — dropping that assignment would make
    // every one of those resolve to `SURROGATE_FACT_MISSING` on the next seed run.
    //
    // The count is asserted to catch an ACCIDENTAL extra reference (a copy-paste into
    // MORTGAGE), not to forbid a deliberate one: widening the product is a seed edit plus
    // this number.
    const blockFor = (name: string, next: string): string => {
      // `const NAME:` with the colon, not a bare prefix. `const BUSINESS` also matches
      // `const BUSINESS_YEARS_Q`, a question declared earlier in the file — which made this
      // slice run backwards and fail on a seed edit that had nothing to do with it.
      const start = seedSource.indexOf(`const ${name}:`);
      const end = seedSource.indexOf(`const ${next}:`);
      expect(start, `${name} config not found`).toBeGreaterThan(-1);
      expect(end, `${next} config not found`).toBeGreaterThan(start);
      return seedSource.slice(start, end);
    };
    const personalBlock = blockFor('PERSONAL', 'MORTGAGE');
    const carBlock = blockFor('CAR', 'BUSINESS');

    for (const constName of ['MILITARY_GRADE_Q', 'ACADEMIC_RANK_Q', 'YEARS_IN_PRACTICE_Q']) {
      expect(personalBlock).toContain(`${constName},`);
      expect(carBlock).toContain(`${constName},`);
      const references = seedSource.split(`${constName},`).length - 1;
      expect(references, `${constName} referenced ${references} times`).toBe(2);
    }
  });

  it('carries no per-fact category — the assignments are the single authority', () => {
    // Four copies of the same category array on the specs is the shape that drifts. There
    // is no expected set to copy any more either: v16.0.0 deleted the capable-category
    // list, and `question_loan_category` alone says who is asked what.
    for (const fact of SURROGATE_FACT_KEYS) {
      expect(SURROGATE_FACT_SPECS[fact]).not.toHaveProperty('category');
    }
  });

  it('does NOT re-seed credit_card_total_limit as a new question', () => {
    // It already exists, feeding the 5% card-limit obligation. A second copy would ask
    // the applicant the same thing twice (research R2).
    const declarations = seedSource.split("code: 'credit_card_total_limit'").length - 1;
    expect(declarations).toBeLessThanOrEqual(1);
  });

  it('exposes every bound code exactly once', () => {
    const unique = new Set(SURROGATE_BOUND_QUESTION_CODES);
    expect(unique.size).toBe(SURROGATE_BOUND_QUESTION_CODES.length);
  });
});
