/**
 * WHAT A TICK OR AN UNTICK WOULD DO — decided in full before the first write.
 *
 * The posture `blueprint-plan.ts` takes, for the reason it states: a refusal that lands
 * after two of four writes leaves a state nobody chose, so the whole plan — including every
 * reason to refuse — is computed from rows already read, and the executor only writes.
 * It also means the interesting half is a pure function with a spec, rather than something
 * exercisable only through a Prisma transaction against a seeded database.
 *
 * THE CENTRAL RULE IS REUSE-FIRST. If any surrogate fact already reads the ticked question,
 * THAT ROW IS THE FACT: the product joins it and nothing is minted. This is what makes
 * ticking a platform fact (`military_grade`) or one a blueprint already asks for
 * (`school_type`) join the existing key instead of minting a rival — two keys over one
 * answer would put two bank tables under two names for one figure, with nothing on any
 * screen saying which a rule should read.
 */
import type { LoanCategory, QuestionType } from '@prisma/client';
import {
  BINDABLE_QUESTION_TYPES,
  isBindableQuestionType,
} from '@/matching/pipeline/surrogate-fact-registry';
import {
  RESERVED_FACT_KEYS,
  isReservedFactKey,
} from '@/matching/pipeline/fact-question-eligibility';

/** One pool question, as the plan needs it. */
export interface AskQuestionInput {
  id: string;
  code: string;
  labelAr: string;
  labelEn: string;
  type: QuestionType;
  isRequired: boolean;
  /** The loan categories that ASK it today. */
  categories: readonly LoanCategory[];
}

/** One `surrogate_fact` row, as the plan needs it. Includes inactive rows on purpose. */
export interface AskFactInput {
  id: string;
  key: string;
  active: boolean;
  systemOnly: boolean;
  surrogateProductKey: string | null;
  /** `null` when the fact exists but reads nothing yet. */
  boundQuestionCode: string | null;
}

export interface AttachPlanInput {
  productKey: string;
  /** `undefined` when the code is in no ACTIVE question — a typo, retired, or parked. */
  question: AskQuestionInput | undefined;
  facts: readonly AskFactInput[];
  /** Fact keys this product already asks. */
  askedFactKeys: readonly string[];
  /** Loan types the tick should start asking the question in. May be empty. */
  askIn: readonly LoanCategory[];
  /**
   * Blueprints that declare the derived key, and the question each names for it.
   * A blueprint that declares the key for a DIFFERENT question must refuse: the seed treats
   * an existing bound key as reuse, so it would silently start reading the operator's
   * question on the next deploy, with no plan step and no log line.
   */
  blueprintsAsking: readonly { blueprintKey: string; questionCode?: string }[];
}

export type AskRefusal =
  | { code: 'questionInactive'; questionCode: string }
  | { code: 'questionTypeInvalid'; questionCode: string; type: string; allowed: string[] }
  | { code: 'widenRequired'; questionCode: string; categories: LoanCategory[] }
  | { code: 'ambiguousFact'; questionCode: string; factKeys: string[] }
  | { code: 'keyTaken'; questionCode: string; factKey: string; boundQuestionCode: string | null }
  | { code: 'keyReserved'; questionCode: string; factKey: string; reservedKeys: string[] }
  | { code: 'blueprintOwnsKey'; questionCode: string; factKey: string; blueprintKeys: string[] }
  | { code: 'readByOwnRule'; productKey: string; factKey: string; stepIds: string[] }
  | { code: 'factInUse'; factKey: string; readBy: readonly { source: string; ref: string }[] };

/** What the executor does, in the only order the foreign keys and the engine allow. */
export type AttachStep =
  | {
      op: 'createFact';
      factKey: string;
      questionCode: string;
      labelAr: string;
      labelEn: string;
      /**
       * Whether to stamp `surrogateProductKey`. TRUE only on a genuine mint: that column
       * means AUTHORSHIP, and re-filing a fact another product made — or one deliberately
       * filed under nobody because several blueprints share it — would re-point that
       * product's on/off switch at a row it does not own.
       */
      fileUnderProduct: boolean;
    }
  | { op: 'bindFact'; factKey: string; questionCode: string }
  | { op: 'addAsk'; factKey: string }
  | { op: 'addCategories'; questionId: string; questionCode: string; categories: LoanCategory[] };

export type AttachPlan =
  | { kind: 'refuse'; refusal: AskRefusal }
  | {
      kind: 'proceed';
      factKey: string;
      questionCode: string;
      /** Empty when the product already asks it and the loan types already ask the question. */
      steps: AttachStep[];
    };

/**
 * The fact key a tick would use.
 *
 * The question's own `code`, verbatim, and never a re-slug of its wording: the code is
 * already an immutable slug of that wording, minted once, so re-slugging would mint a
 * DIFFERENT key the day somebody rewords the question — and a fact key must not move,
 * because stored rules name it as `fact:<key>` and every bank's figures are filed under it.
 * It is also why the same tick produces the same key on staging and in production.
 *
 * Never `uniqueSlug`. A `_2` suffix is a permanent second name for one answer; a taken key
 * is a refusal, not something to work around.
 */
export function derivedFactKey(question: { code: string }): string {
  return question.code;
}

export function planAttach(input: AttachPlanInput): AttachPlan {
  const { question } = input;
  if (question === undefined) {
    return { kind: 'refuse', refusal: { code: 'questionInactive', questionCode: '' } };
  }

  // 1. The shape of the answer. All four question types are bindable — a key table over
  //    option codes (one pick or several), a band table over a number, or the presence of a
  //    text answer — so this refuses only a type the platform does not know how to read at
  //    all, which is a type added to the schema without a reader.
  if (!isBindableQuestionType(question.type)) {
    return {
      kind: 'refuse',
      refusal: {
        code: 'questionTypeInvalid',
        questionCode: question.code,
        type: question.type,
        allowed: [...BINDABLE_QUESTION_TYPES],
      },
    };
  }

  // 2. Which loan types this tick would START asking. Computed before the fact decision
  //    because the required-question refusal turns on it and nothing should be minted for
  //    a tick that is about to be refused.
  const asked = new Set(question.categories);
  const widen = [...new Set(input.askIn)].filter((category) => !asked.has(category));
  if (widen.length > 0 && question.isRequired) {
    return {
      kind: 'refuse',
      refusal: { code: 'widenRequired', questionCode: question.code, categories: widen },
    };
  }

  // 3. REUSE FIRST. Any fact already bound to this question IS the fact.
  const bound = input.facts.filter((fact) => fact.boundQuestionCode === question.code);
  if (bound.length > 1) {
    return {
      kind: 'refuse',
      refusal: {
        code: 'ambiguousFact',
        questionCode: question.code,
        factKeys: bound.map((fact) => fact.key).sort(),
      },
    };
  }

  const steps: AttachStep[] = [];
  const existing = bound[0];
  let factKey: string;

  if (existing !== undefined) {
    factKey = existing.key;
  } else {
    factKey = derivedFactKey(question);

    // 4a. Keys the platform computes for itself. A row under one is created, bound,
    //     audited and rendered — and never carries an answer, because the mapper that
    //     fills the applicant profile skips it by contract.
    if (isReservedFactKey(factKey)) {
      return {
        kind: 'refuse',
        refusal: {
          code: 'keyReserved',
          questionCode: question.code,
          factKey,
          reservedKeys: [...RESERVED_FACT_KEYS],
        },
      };
    }

    // 5b. A blueprint declaring this key for a DIFFERENT question. Refused rather than
    //     bound: the seed reads an existing bound key as reuse, so the blueprint's own
    //     product would start reading the operator's question on the next deploy.
    const conflicting = input.blueprintsAsking.filter(
      (entry) => entry.questionCode !== undefined && entry.questionCode !== question.code,
    );
    if (conflicting.length > 0) {
      return {
        kind: 'refuse',
        refusal: {
          code: 'blueprintOwnsKey',
          questionCode: question.code,
          factKey,
          blueprintKeys: conflicting.map((entry) => entry.blueprintKey),
        },
      };
    }

    const holder = input.facts.find((fact) => fact.key === factKey);
    if (holder !== undefined && holder.boundQuestionCode !== null) {
      // Bound to something else — and `bound` above proved it is not this question.
      return {
        kind: 'refuse',
        refusal: {
          code: 'keyTaken',
          questionCode: question.code,
          factKey,
          boundQuestionCode: holder.boundQuestionCode,
        },
      };
    }

    if (holder === undefined) {
      steps.push({
        op: 'createFact',
        factKey,
        questionCode: question.code,
        labelAr: question.labelAr,
        labelEn: question.labelEn,
        // A genuine mint: this product made the row, so it may say so.
        fileUnderProduct: true,
      });
    }
    // Exists and reads nothing yet — finish the job rather than refusing forever. The
    // `bindFact` branch the blueprint planner already takes for an unbound key.
    steps.push({ op: 'bindFact', factKey, questionCode: question.code });
  }

  if (!input.askedFactKeys.includes(factKey)) {
    steps.push({ op: 'addAsk', factKey });
  }

  if (widen.length > 0) {
    steps.push({
      op: 'addCategories',
      questionId: question.id,
      questionCode: question.code,
      categories: widen,
    });
  }

  return { kind: 'proceed', factKey, questionCode: question.code, steps };
}

export interface DetachPlanInput {
  productKey: string;
  factKey: string;
  /** `undefined` when this product does not ask it — a no-op, not a 404. */
  ask: { source: 'blueprint' | 'operator' } | undefined;
  fact: AskFactInput | undefined;
  /** Every product that asks this fact, including this one. */
  productsAsking: readonly string[];
  /** Step and gate ids in THIS product's own calculation that read the fact. */
  ownRuleStepIds: readonly string[];
  /** Everything else that reads the fact — bank programs, cap tables, other stored rules. */
  readBy: readonly { source: string; ref: string }[];
}

export type DetachStep =
  /** The ask row goes. An `operator` ask: nothing re-asserts it. */
  | { op: 'removeAsk'; factKey: string }
  /**
   * The ask row STAYS, marked detached. A `blueprint` ask: the seed re-asserts its own asks
   * on every deploy, and its insert is idempotent by primary key, so the surviving row is
   * what makes the removal durable. Deleting it would hand the seed a clean slate.
   */
  | { op: 'tombstoneAsk'; factKey: string }
  | { op: 'deleteFact'; factKey: string };

export type DetachPlan =
  | { kind: 'refuse'; refusal: AskRefusal }
  /** Nothing to do: the product does not ask it. Idempotent — a double-click is not a 404. */
  | { kind: 'noop' }
  | { kind: 'proceed'; steps: DetachStep[] };

export function planDetach(input: DetachPlanInput): DetachPlan {
  if (input.ask === undefined) return { kind: 'noop' };

  // 1. This product's own calculation still reads it. Refused whatever the delete decision
  //    would have been: step ① claiming the product does not ask what step ② reads is an
  //    incoherence, and the fix is one click away on the same screen.
  if (input.ownRuleStepIds.length > 0) {
    return {
      kind: 'refuse',
      refusal: {
        code: 'readByOwnRule',
        productKey: input.productKey,
        factKey: input.factKey,
        stepIds: [...input.ownRuleStepIds],
      },
    };
  }

  // 2. An ask the library owns comes off as a TOMBSTONE, and its fact row is never touched.
  //    The row survives so `npm run seed:blueprints` collides with it instead of re-inserting
  //    the ask; the fact is the library's own — it will be re-declared by the blueprint on
  //    the next run whatever this screen does, and every other blueprint that names it goes
  //    on reading it. So there is no delete decision to make and the four tests below are
  //    skipped rather than answered.
  if (input.ask.source === 'blueprint') {
    return { kind: 'proceed', steps: [{ op: 'tombstoneAsk', factKey: input.factKey }] };
  }

  const steps: DetachStep[] = [{ op: 'removeAsk', factKey: input.factKey }];

  // 3. Does the fact ROW go too? Only when every one of four things holds. Any of them
  //    failing leaves the row untouched and every other reader reading — which is what
  //    guarantees one product's untick cannot break another product's calculation.
  const othersAsking = input.productsAsking.filter((key) => key !== input.productKey);
  const fact = input.fact;
  const deletable =
    fact !== undefined &&
    othersAsking.length === 0 &&
    input.readBy.length === 0 &&
    !fact.systemOnly &&
    fact.surrogateProductKey === input.productKey;

  if (deletable) {
    steps.push({ op: 'deleteFact', factKey: input.factKey });
    return { kind: 'proceed', steps };
  }

  // The row survives. It is refused ONLY when the delete was the point — i.e. this product
  // is the last one asking and it authored the row — and something still reads it. When
  // another product asks it, or the platform owns it, no delete was ever proposed: the ask
  // simply goes and nothing is lost.
  const wouldHaveDeleted =
    fact !== undefined &&
    othersAsking.length === 0 &&
    !fact.systemOnly &&
    fact.surrogateProductKey === input.productKey;
  if (wouldHaveDeleted && input.readBy.length > 0) {
    return {
      kind: 'refuse',
      refusal: { code: 'factInUse', factKey: input.factKey, readBy: input.readBy },
    };
  }

  return { kind: 'proceed', steps };
}
