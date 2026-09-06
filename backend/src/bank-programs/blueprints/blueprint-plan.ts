/**
 * What creating a predefined product will WRITE — worked out before anything is written.
 *
 * Pure on purpose. The dangerous half of this feature is not the arithmetic, it is the
 * order and the idempotence of eight writes across three tables: a value of a filed kind is
 * born filed, so its class list must exist first; a question mirroring a list cannot be
 * created before the list; a fact filed under a product needs the product row; and the
 * calculation is written last because the validator checks every fact it names. Get any of
 * that wrong and the failure is a half-built product that saves clean and quotes nothing.
 *
 * ─── Idempotence, by KEY, always ──────────────────────────────────────────────
 *
 * Every object is looked up by its key and REUSED. Never `uniqueSlug`: a second "Compound"
 * list mints `compound_2`, keys are immutable, and that key then appears in every bank's
 * stored configuration forever (§10.9). So picking a product twice is not two products'
 * worth of lists — the second run plans nothing, and the screen can say so before the
 * operator commits.
 *
 * A value list is only ADDED to. A key that exists keeps its label, because that key is what
 * a bank's table row is filed under and what an applicant's stored answer holds; rewriting
 * the label of a row somebody is pricing against is a different decision, made on the
 * lookups screen, one row at a time.
 */

import type { LoanCategory } from '@prisma/client';
import { bankAxisByFactKey } from '../../matching/pipeline/bank-relationship';
import { sharedBlueprintFactKeys } from './product-blueprints';
import { slugify } from '../../questionnaire/slug.util';
import type { BlueprintAsk, BlueprintValue, ProductBlueprint } from './product-blueprint.types';

/** What the database already holds, read once before planning. */
export interface BlueprintExistingState {
  /** `enumeration_type_def` keys — active AND inactive: a key is taken either way. */
  typeKeys: ReadonlySet<string>;
  /** Value keys per list, active and inactive, for the same reason. */
  valueKeysByType: ReadonlyMap<string, ReadonlySet<string>>;
  /** Every question code in the pool — live AND soft-deleted, because the code is taken either way. */
  questionCodes: ReadonlySet<string>;
  /**
   * Of those, the ones switched off.
   *
   * A purge soft-deletes rather than deletes, because `application_answer` has a RESTRICT
   * foreign key onto the question — so a product that once existed leaves its questions
   * behind, switched off, with their options and every stored answer intact. A blueprint
   * that needs one of them again brings it BACK: creating a second question with the same
   * wording would mint `..._2` and put two identical questions in the pool, one of them dead.
   */
  inactiveQuestionCodes: ReadonlySet<string>;
  /** Which loan categories each question is asked in today. */
  categoriesByQuestion: ReadonlyMap<string, ReadonlySet<LoanCategory>>;
  /**
   * Every `surrogate_fact` KEY that exists — bound or not.
   *
   * Read from the registry ROWS, deliberately, and not from the usable registry: that one
   * filters to facts with a live bound question, so an unbound fact reads as absent, the plan
   * creates it, and the create fails on a duplicate key with no way forward. An unbound fact
   * is also exactly what a run that failed between the two writes leaves behind.
   */
  factKeys: ReadonlySet<string>;
  /** Of those, the ones bound to nothing — a fact the engine cannot read yet. */
  unboundFactKeys: ReadonlySet<string>;
  /** Lists whose values already mirror into a question. */
  mirroredTypeKeys: ReadonlySet<string>;
  /** `surrogate_product` keys. */
  productKeys: ReadonlySet<string>;
  /**
   * The question each existing fact is bound to (`platform_enumeration.boundQuestionId`).
   *
   * Handed in rather than looked up while planning, because that join lives only in the
   * database and the planner is pure — and because without it the widening step below cannot
   * fire for a fact the blueprint reuses. That was not a cosmetic gap: the governorate
   * question is seeded for mortgages only, so the doctors' product's column would have read
   * nothing on a personal loan and the card would have quoted the standard column for every
   * applicant, silently.
   */
  questionCodeByFact: ReadonlyMap<string, string>;
}

export type BlueprintPlanStep =
  /** The product row, first, so a fact created for it can say which product it belongs to. */
  | { op: 'createProductRow'; key: string; labelEn: string; labelAr: string }
  | {
      op: 'createType';
      typeKey: string;
      labelEn: string;
      labelAr: string;
      parentTypeKey?: string;
      fallbackParentKey?: string;
    }
  | { op: 'createValues'; typeKey: string; values: BlueprintValue[] }
  | {
      op: 'createQuestion';
      questionCode: string;
      questionEn: string;
      questionAr: string;
      helperEn?: string;
      helperAr?: string;
      type: 'SINGLE_SELECT' | 'NUMERIC';
      categories: LoanCategory[];
      optionsFromEnumerationType?: string;
      numeric?: { min: number; max: number };
      enabledWhen?: { questionCode: string; optionCode: string };
      /** Absent means not required — see `BlueprintAsk`. */
      required?: boolean;
    }
  /**
   * Point a list at the question whose options ARE that list.
   *
   * Needed for the two seeded lists this feature extends: the seed COPIED their values into
   * options once and set no link, so a value added later reached the registry and never the
   * question — the grade would be pickable by no applicant and readable by no bank. The link
   * makes the list the single authority, and it is safe to adopt because those options were
   * created with `code` equal to the value key.
   */
  | { op: 'linkMirror'; typeKey: string; questionCode: string }
  /** Switch a soft-deleted question back on, so the product that reads it can be asked. */
  | { op: 'reactivateQuestion'; questionCode: string }
  | {
      op: 'createFact';
      factKey: string;
      questionCode: string;
      /** Absent → the executor labels it from the question's own wording. */
      labelEn?: string;
      labelAr?: string;
      /** Provenance: which product authored it. Absent for a platform-wide fact. */
      surrogateProductKey?: string;
    }
  /** A fact row that exists and is bound to nothing — the other half of a half-done create. */
  | { op: 'bindFact'; factKey: string; questionCode: string }
  | { op: 'widenCategories'; questionCode: string; categories: LoanCategory[] }
  | { op: 'setProductTemplate'; key: string };

/** Everything the plan will reuse rather than create — what the screen shows before writing. */
export interface BlueprintReuse {
  typeKeys: string[];
  questionCodes: string[];
  factKeys: string[];
  /** A value key that is already in its list, so its label is left exactly as it is. */
  valueKeys: string[];
}

export interface BlueprintPlan {
  steps: BlueprintPlanStep[];
  reuse: BlueprintReuse;
  /** Lists that gained values, so the executor re-syncs and publishes ONCE at the end. */
  touchedMirroredTypes: string[];
  /** True when nothing at all would be written — a second run of the same blueprint. */
  noop: boolean;
}

/** The fact keys an ask contributes, whether it creates them or reuses them. */
export function askFactKey(ask: BlueprintAsk): string {
  return ask.factKey;
}

/**
 * A blueprint against what exists → the ordered writes.
 *
 * `productKey` is the key the product row will take. It is passed in rather than derived
 * because the operator names the product, and the name they type is what every screen shows
 * afterwards — the blueprint's own label is only the default in that box.
 */
export function planBlueprint(args: {
  blueprint: ProductBlueprint;
  productKey: string | null;
  productLabelEn: string;
  productLabelAr: string;
  existing: BlueprintExistingState;
}): BlueprintPlan {
  const { blueprint, productKey, productLabelEn, productLabelAr, existing } = args;
  const steps: BlueprintPlanStep[] = [];
  const reuse: BlueprintReuse = {
    typeKeys: [],
    questionCodes: [],
    factKeys: [],
    valueKeys: [],
  };
  const touchedMirroredTypes = new Set<string>();

  // Lists and questions are shared BETWEEN blueprints — the school type is both a ceiling
  // product's column and a cap of its own — and an ask can appear twice inside one. Planned
  // once: a second `createType` for the same key would be refused at execution, which would
  // fail a create that is entirely legal.
  const planned = new Set<string>();
  const willExist = (kind: string, key: string): boolean => planned.has(`${kind}:${key}`);
  const mark = (kind: string, key: string): void => void planned.add(`${kind}:${key}`);

  // 1. The product row, before any fact that names it.
  const makesProduct = blueprint.template !== null && productKey !== null;
  if (makesProduct && productKey !== null) {
    if (existing.productKeys.has(productKey)) {
      reuse.typeKeys.push(productKey);
    } else {
      steps.push({
        op: 'createProductRow',
        key: productKey,
        labelEn: productLabelEn,
        labelAr: productLabelAr,
      });
    }
  }

  const valuesToAdd = (typeKey: string, values: readonly BlueprintValue[]): BlueprintValue[] => {
    const have = existing.valueKeysByType.get(typeKey) ?? new Set<string>();
    const missing: BlueprintValue[] = [];
    for (const value of values) {
      if (have.has(value.key)) {
        reuse.valueKeys.push(`${typeKey}/${value.key}`);
        continue;
      }
      if (willExist(`value:${typeKey}`, value.key)) continue;
      mark(`value:${typeKey}`, value.key);
      missing.push(value);
    }
    return missing;
  };

  const ensureType = (spec: {
    typeKey: string;
    labelEn: string;
    labelAr: string;
    parentTypeKey?: string;
    fallbackParentKey?: string;
  }): void => {
    if (existing.typeKeys.has(spec.typeKey)) {
      if (!reuse.typeKeys.includes(spec.typeKey)) reuse.typeKeys.push(spec.typeKey);
      return;
    }
    if (willExist('type', spec.typeKey)) return;
    mark('type', spec.typeKey);
    steps.push({ op: 'createType', ...spec });
  };

  for (const ask of blueprint.asks) {
    // 2. A derived axis has no registry row and no question of its own — the platform
    //    computes it from the bank the program belongs to. All it can need is that the
    //    question behind it is asked in this product's categories.
    if (ask.kind === 'derivedFact') {
      if (!reuse.factKeys.includes(ask.factKey)) reuse.factKeys.push(ask.factKey);
      continue;
    }

    // 3. A fact that already exists: reuse it, and add the values the sheets need.
    if (ask.kind === 'platformFact') {
      if (!reuse.factKeys.includes(ask.factKey)) reuse.factKeys.push(ask.factKey);
      if (ask.addValues) {
        const missing = valuesToAdd(ask.addValues.typeKey, ask.addValues.values);
        if (missing.length > 0) {
          // The link FIRST, so the single sync at the end reaches the new values. Without it
          // they land in the registry and never in the question, which is the silent half of
          // this bug: pickable by nobody, readable by no bank's table.
          if (!existing.mirroredTypeKeys.has(ask.addValues.typeKey)) {
            const questionCode = factQuestionCode(ask.factKey);
            if (questionCode !== null) {
              steps.push({ op: 'linkMirror', typeKey: ask.addValues.typeKey, questionCode });
            }
          }
          steps.push({ op: 'createValues', typeKey: ask.addValues.typeKey, values: missing });
          touchedMirroredTypes.add(ask.addValues.typeKey);
        }
      }
      continue;
    }

    // 4. A fact over a question that already exists.
    if (ask.kind === 'bindQuestion') {
      if (existing.factKeys.has(ask.factKey)) {
        if (!reuse.factKeys.includes(ask.factKey)) reuse.factKeys.push(ask.factKey);
        if (existing.unboundFactKeys.has(ask.factKey) && !willExist('fact', ask.factKey)) {
          mark('fact', ask.factKey);
          steps.push({ op: 'bindFact', factKey: ask.factKey, questionCode: ask.questionCode });
        }
      } else if (!willExist('fact', ask.factKey)) {
        mark('fact', ask.factKey);
        steps.push({
          op: 'createFact',
          factKey: ask.factKey,
          questionCode: ask.questionCode,
          // Carried when the blueprint states them. Absent, `factLabels` falls back to the
          // question CODE — there is no question TEXT in the state it reads — and the
          // registry row ends up named after a slug.
          ...(ask.labelEn !== undefined ? { labelEn: ask.labelEn } : {}),
          ...(ask.labelAr !== undefined ? { labelAr: ask.labelAr } : {}),
        });
      }
      if (!reuse.questionCodes.includes(ask.questionCode)) {
        reuse.questionCodes.push(ask.questionCode);
      }
      continue;
    }

    // 5. A new question, its list, and the fact that reads it.
    if (ask.kind === 'choice') {
      const parent = ask.list.parent;
      if (parent) {
        ensureType({
          typeKey: parent.typeKey,
          labelEn: parent.labelEn,
          labelAr: parent.labelAr,
        });
        const missingClasses = valuesToAdd(parent.typeKey, parent.values);
        if (missingClasses.length > 0) {
          steps.push({ op: 'createValues', typeKey: parent.typeKey, values: missingClasses });
        }
      }
      ensureType({
        typeKey: ask.list.typeKey,
        labelEn: ask.list.labelEn,
        labelAr: ask.list.labelAr,
        ...(parent
          ? {
              parentTypeKey: parent.typeKey,
              ...(parent.fallbackParentKey ? { fallbackParentKey: parent.fallbackParentKey } : {}),
            }
          : {}),
      });
      const missingValues = valuesToAdd(ask.list.typeKey, ask.list.values);
      if (missingValues.length > 0) {
        steps.push({ op: 'createValues', typeKey: ask.list.typeKey, values: missingValues });
        if (existing.mirroredTypeKeys.has(ask.list.typeKey)) {
          touchedMirroredTypes.add(ask.list.typeKey);
        }
      }
    }

    // The code the service will mint from this wording. Derived, never declared: a question's
    // code is generated and immutable (A33), and the same wording is the same question — which
    // is exactly what makes an ask two blueprints share resolve to one question rather than
    // two that ask the same thing.
    const questionCode = askQuestionCode(ask, existing);
    if (questionCode === null) continue;
    const isNew = !existing.questionCodes.has(questionCode);
    if (isNew && !willExist('question', questionCode)) {
      mark('question', questionCode);
      steps.push({
        op: 'createQuestion',
        questionCode,
        questionEn: ask.questionEn,
        questionAr: ask.questionAr,
        ...(ask.helperEn ? { helperEn: ask.helperEn } : {}),
        ...(ask.helperAr ? { helperAr: ask.helperAr } : {}),
        type: ask.kind === 'choice' ? 'SINGLE_SELECT' : 'NUMERIC',
        categories: [...ask.categories],
        ...(ask.kind === 'choice'
          ? { optionsFromEnumerationType: ask.list.typeKey }
          : { numeric: ask.numeric }),
        ...(ask.enabledWhen ? { enabledWhen: ask.enabledWhen } : {}),
        ...(ask.required === true ? { required: true } : {}),
      });
    } else if (!isNew) {
      if (!reuse.questionCodes.includes(questionCode)) {
        reuse.questionCodes.push(questionCode);
      }
      // Reused and switched OFF. Left alone, the fact bound to it serves nothing — the
      // registry filters to facts whose question is live — so the calculation naming that
      // fact is refused at save with a message about a fact, not about a question nobody can
      // see. That is the failure this step exists to prevent, and it was found by hitting it.
      if (existing.inactiveQuestionCodes.has(questionCode) && !willExist('revive', questionCode)) {
        mark('revive', questionCode);
        steps.push({ op: 'reactivateQuestion', questionCode });
      }
    }

    if (existing.factKeys.has(ask.factKey)) {
      if (!reuse.factKeys.includes(ask.factKey)) reuse.factKeys.push(ask.factKey);
      // The row is there and reads nothing. Binding it finishes the job rather than failing
      // on a duplicate key forever, which is the only other thing this could do.
      if (existing.unboundFactKeys.has(ask.factKey) && !willExist('fact', ask.factKey)) {
        mark('fact', ask.factKey);
        steps.push({ op: 'bindFact', factKey: ask.factKey, questionCode });
      }
    } else if (!willExist('fact', ask.factKey)) {
      mark('fact', ask.factKey);
      steps.push({
        op: 'createFact',
        factKey: ask.factKey,
        questionCode,
        labelEn: ask.questionEn,
        labelAr: ask.questionAr,
        // Provenance, never a constraint: any product's rule may read any fact.
        //
        // Withheld in two cases. A cap blueprint builds no product to file one under. And a
        // fact more than one blueprint asks for belongs to the PLATFORM: deleting a product
        // deletes the facts filed under it, so a shared one would die with whichever product
        // created it and leave the other refused at its next save.
        ...(makesProduct && productKey !== null && !sharedBlueprintFactKeys().has(ask.factKey)
          ? { surrogateProductKey: productKey }
          : {}),
      });
    }
  }

  // 6. Widen the questions this product needs, and only those.
  //
  //    A category assignment is what decides whether an applicant is ASKED — a product whose
  //    column reads a governorate is dead in a category where the question is never put. Only
  //    the missing categories are added: narrowing somebody else's assignment because this
  //    blueprint does not need it would silently change another product.
  for (const ask of blueprint.asks) {
    const wanted = askCategories(ask);
    if (wanted.length === 0) continue;
    const questionCode = askQuestionCode(ask, existing);
    if (questionCode === null) continue;
    const have = existing.categoriesByQuestion.get(questionCode) ?? new Set<LoanCategory>();
    // A question this plan is about to create already carries its categories.
    if (steps.some((step) => step.op === 'createQuestion' && step.questionCode === questionCode)) {
      continue;
    }
    const missing = wanted.filter((category) => !have.has(category));
    if (missing.length === 0) continue;
    steps.push({
      op: 'widenCategories',
      questionCode,
      categories: [...new Set([...have, ...missing])],
    });
  }

  // 7. The calculation last: the validator checks every fact it names, so the facts have to
  //    be there, and a rule written first would be refused for objects this plan is creating.
  if (makesProduct && productKey !== null) {
    steps.push({ op: 'setProductTemplate', key: productKey });
  }

  const writes = steps.filter((step) => step.op !== 'setProductTemplate');
  return {
    steps,
    reuse,
    touchedMirroredTypes: [...touchedMirroredTypes],
    noop: writes.length === 0,
  };
}

/** Which loan categories an ask needs its question to be asked in. */
export function askCategories(ask: BlueprintAsk): LoanCategory[] {
  switch (ask.kind) {
    case 'choice':
    case 'number':
      return [...ask.categories];
    case 'bindQuestion':
    case 'platformFact':
    case 'derivedFact':
      return [...(ask.alsoAskIn ?? [])];
  }
}

/**
 * The question an ask reads.
 *
 * Three routes, because the join lives in a different place for each kind. A `choice`, a
 * `number` and a `bindQuestion` name their question outright. A `platformFact` is joined to
 * one through its registry row, which only the database knows — so it arrives in
 * `questionCodeByFact`. A `derivedFact` has no question of its own, but the axis it is
 * computed from is asked by one, and that pairing is the engine's own
 * (`bank-relationship.ts`) rather than anything an operator can point elsewhere.
 */
export function askQuestionCode(
  ask: BlueprintAsk,
  existing?: Pick<BlueprintExistingState, 'questionCodeByFact'>,
): string | null {
  switch (ask.kind) {
    case 'choice':
    case 'number':
      // What `uniqueSlug` will produce for wording nobody has used yet. When the slug IS
      // taken, that question already asks this in these words and is reused — so the two
      // cases the planner has to tell apart are exactly "the slug is free" and "it is not",
      // and `slugify` is the function that decides.
      return slugify(ask.questionEn);
    case 'bindQuestion':
      return ask.questionCode;
    case 'platformFact':
      return existing?.questionCodeByFact.get(ask.factKey) ?? null;
    case 'derivedFact':
      return bankAxisByFactKey(ask.factKey)?.questionCode ?? null;
  }
}

/**
 * The question code behind a platform fact whose list this feature extends.
 *
 * Two entries, and deliberately not a general lookup: it exists only because the two seeded
 * lists that need new values were COPIED into their questions rather than linked, and the
 * link has to be stamped before the values are added. Everything else resolves its question
 * from the registry row at execution time, where the join actually lives.
 */
function factQuestionCode(factKey: string): string | null {
  const CODES: Readonly<Record<string, string>> = {
    military_grade: 'military_grade',
    academic_rank: 'academic_rank',
  };
  return CODES[factKey] ?? null;
}
