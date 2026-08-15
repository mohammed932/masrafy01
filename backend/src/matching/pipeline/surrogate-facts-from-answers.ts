/**
 * Questionnaire answers → the surrogate income FACTS, in ONE place.
 *
 * Pure function, no Nest, no Prisma (Principle V). Read by BOTH
 * `applications.service.ts#buildProfile` and
 * `matching-preview.service.ts#buildProfile`, because preview and apply deriving the
 * same engine input differently is a review block (A33) — the v13.0.0
 * `isQuestionVisible` lesson, where the two computed the asked set separately and
 * scored the same answers differently before and after apply.
 *
 * Two rules the shape enforces rather than documents:
 *
 *   1. **A numeric answer passes through EXACTLY.** No bucket-to-midpoint
 *      approximation — the same rule feature 010 applied to the four money answers,
 *      where a customer asking for 500 000 was quoted on 300 000 (FR-018).
 *   2. **An unanswered fact stays `undefined`, never defaulted.** The resolver reads
 *      `undefined` as `fact_not_answered` and the quote reports
 *      `SURROGATE_FACT_MISSING` — a stated reason. A zero would price the applicant as
 *      earning nothing, and a "sensible default" would price them on a number nobody
 *      told us (FR-020).
 */

import { Decimal } from '@prisma/client/runtime/library';
import type { SurrogateFactValue } from '../types';
import type { SurrogateFactBinding } from './surrogate-fact-registry';
import {
  SURROGATE_FACT_KEYS,
  SURROGATE_FACT_SPECS,
  type SurrogateFact,
} from './surrogate-fact-bindings';

/** The employment-side facts a rule can read. Every field optional by design. */
export interface SurrogateEmploymentFacts {
  militaryGrade?: string;
  professorRank?: string;
  yearsInPractice?: number;
}

/** The asset-side facts a rule can read. */
export interface SurrogateAssetFacts {
  creditCardLimitEGP?: Decimal;
}

export interface SurrogateFacts {
  employment: SurrogateEmploymentFacts;
  assets: SurrogateAssetFacts;
  /**
   * Every REGISTRY fact the applicant answered, by fact key — including the four
   * above, which are registry rows too since the code constant became data.
   *
   * The typed fields are NOT redundant with this map. They have readers that predate
   * the registry and are not about surrogate income at all: the card limit feeds the
   * 5% obligation discount, and the four legacy `strategy` tokens frozen onto live
   * offers still read the typed fields by name (Principle I — an immutable offer's
   * meaning cannot be rewritten by a refactor).
   */
  byKey: Record<string, SurrogateFactValue>;
}

export interface SurrogateFactAnswers {
  /**
   * Every SINGLE_SELECT answer by question code — the option code picked. The
   * option codes ARE the registry keys the admin's table is keyed by (FR-017), so no
   * translation happens here; a translation layer would be a third list to keep in
   * step, which is the drift FR-017 exists to prevent.
   */
  readonly optionByCode: ReadonlyMap<string, string>;
  /** Every NUMERIC answer by question code, as the validated decimal string. */
  readonly numericByCode: ReadonlyMap<string, string>;
}

/**
 * The ONE rule for "this answer contributes an option-coded fact", used by preview
 * and by apply.
 *
 * A single pick on a SINGLE_SELECT question, and nothing else. Multi-selects are
 * excluded on purpose: no surrogate fact is a multi-pick, and taking the first of
 * several would invent an answer.
 *
 * Shared rather than restated because the two paths had already drifted — preview
 * tested the question TYPE while apply accepted any non-null `selectedOptionCode`,
 * so a multi-select answer that carried one would price the loan after apply and
 * report `SURROGATE_FACT_MISSING` before it: the same answers, two outcomes, which
 * is precisely what A33 and the v13.0.0 `isQuestionVisible` lesson forbid.
 */
export function surrogateOptionPick(answer: {
  readonly type: string | null | undefined;
  readonly selectedOptionCodes?: readonly string[] | null;
}): string | undefined {
  if (answer.type !== 'SINGLE_SELECT') return undefined;
  const codes = answer.selectedOptionCodes;
  if (!codes || codes.length !== 1) return undefined;
  return codes[0];
}

/**
 * Build the facts from validated answers.
 *
 * Two passes over the same answers, deliberately not collapsed:
 *
 *   1. The four LEGACY facts land in their typed profile fields, driven off
 *      `SURROGATE_FACT_SPECS`. Their bindings stay code constants because live offers
 *      carry `byMilitaryGrade`-style tokens that read those fields by name, and an
 *      immutable offer's meaning may not be rewritten by a refactor (Principle I).
 *   2. Every REGISTRY fact lands in `byKey`, driven off the rows an operator manages.
 *      This is the pass that makes a fifth fact an admin action.
 *
 * The four appear in both, and that is not drift: they are the same answer reaching two
 * readers with different lifetimes, from ONE parse. What would be drift is a second
 * place deciding WHICH answer a fact is — hence one `registry` argument, loaded once by
 * the caller and shared by preview and apply.
 */
export function surrogateFactsFromAnswers(
  answers: SurrogateFactAnswers,
  registry: readonly SurrogateFactBinding[] = [],
): SurrogateFacts {
  const facts: SurrogateFacts = { employment: {}, assets: {}, byKey: {} };

  for (const fact of SURROGATE_FACT_KEYS) {
    const spec = SURROGATE_FACT_SPECS[fact];

    if (spec.type === 'SINGLE_SELECT') {
      const picked = answers.optionByCode.get(spec.questionCode);
      // A blank pick is not an answer. Writing `''` would make the resolver's key
      // lookup miss with `no_matching_row` ("your grade isn't in this bank's table")
      // when the truth is `fact_not_answered` ("we never asked / you skipped") — two
      // different reasons leading to two different admin fixes (research R9).
      if (picked === undefined || picked === '') continue;
      assignChoiceFact(facts, fact, picked);
      continue;
    }

    const raw = answers.numericByCode.get(spec.questionCode);
    if (raw === undefined || raw === '') continue;
    assignNumericFact(facts, fact, raw);
  }

  for (const binding of registry) {
    const value = registryFactValue(binding, answers);
    if (value) facts.byKey[binding.key] = value;
  }

  return facts;
}

/**
 * One registry fact's answer, or `undefined` when it was not answered.
 *
 * Reads the answer through the SHAPE the binding declares, never through whichever map
 * happens to hold the question code. A numeric fact must not pick up a stray option
 * pick, because the two configure different tables — the bank entered bands, and a key
 * lookup against them would miss every time while reading as "your answer isn't in our
 * table".
 */
function registryFactValue(
  binding: SurrogateFactBinding,
  answers: SurrogateFactAnswers,
): SurrogateFactValue | undefined {
  if (binding.type === 'SINGLE_SELECT') {
    const picked = answers.optionByCode.get(binding.questionCode);
    if (picked === undefined || picked === '') return undefined;
    return { kind: 'choice', optionCode: picked };
  }

  const raw = answers.numericByCode.get(binding.questionCode);
  if (raw === undefined || raw === '') return undefined;
  // EXACT, via Decimal (Principle I / A3). A fact can be money — a card limit, a
  // deposit — and `Number` would round it before any bank table ever saw it. Years are
  // safe under the same parse: `bandFor` compares Decimals, so `11.9` sits in the same
  // band an integer 11 does, without a floor step this function would have to guess at.
  let value: Decimal;
  try {
    value = new Decimal(raw);
  } catch {
    return undefined;
  }
  return value.isFinite() ? { kind: 'numeric', value } : undefined;
}

/** `employment.militaryGrade` / `employment.professorRank`. */
function assignChoiceFact(facts: SurrogateFacts, fact: SurrogateFact, picked: string): void {
  switch (fact) {
    case 'military_grade':
      facts.employment.militaryGrade = picked;
      return;
    case 'academic_rank':
      facts.employment.professorRank = picked;
      return;
    default:
      // A choice fact with no destination is a spec that was extended without
      // extending this switch. Silently dropping it would leave the rule resolving
      // `fact_not_answered` for an applicant who DID answer, which reads as a
      // questionnaire problem and sends whoever debugs it to the wrong place.
      throw new Error(`surrogate fact '${fact}' is SINGLE_SELECT with no profile destination`);
  }
}

/** `employment.yearsInPractice` / `assets.creditCardLimitEGP`. */
function assignNumericFact(facts: SurrogateFacts, fact: SurrogateFact, raw: string): void {
  switch (fact) {
    case 'years_in_practice': {
      // Years are a count, not money. `Math.floor` rather than `Number`: the band
      // lookup compares against integer edges, and `11.9` years in practice is 11
      // completed years, not 12.
      const years = Number(raw);
      if (!Number.isFinite(years)) return;
      facts.employment.yearsInPractice = Math.floor(years);
      return;
    }
    case 'credit_card_limit': {
      // EXACT, via Decimal — this is money (Principle I). The same stated figure also
      // feeds the 5% obligation discount through `money-field-bindings.ts`: one fact,
      // two uses, asked once.
      let value: Decimal;
      try {
        value = new Decimal(raw);
      } catch {
        return;
      }
      if (!value.isFinite()) return;
      facts.assets.creditCardLimitEGP = value;
      return;
    }
    default:
      throw new Error(`surrogate fact '${fact}' is NUMERIC with no profile destination`);
  }
}
