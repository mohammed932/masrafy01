/**
 * WHAT A TICK AND AN UNTICK DECIDE, before anything is written.
 *
 * The cases here are the ones that fail SILENTLY and look right. A tick that mints a second
 * fact over a question one already reads leaves two keys for one answer — two bank tables
 * that can disagree, with nothing on screen saying which a rule should read. An untick that
 * deletes a fact another product still reads breaks that product's calculation, and the
 * operator who did it was looking at a different screen.
 */
import { describe, expect, it } from 'vitest';
import {
  derivedFactKey,
  planAttach,
  planDetach,
  type AskFactInput,
  type AskQuestionInput,
} from '@/bank-programs/asks/product-ask-plan';

const choice = (over: Partial<AskQuestionInput> = {}): AskQuestionInput => ({
  id: 'q1',
  code: 'owned_unit_type',
  labelAr: 'نوع الوحدة',
  labelEn: 'What kind of unit do you own?',
  type: 'SINGLE_SELECT',
  isRequired: false,
  categories: ['personal'],
  ...over,
});

const fact = (over: Partial<AskFactInput> = {}): AskFactInput => ({
  id: 'f1',
  key: 'owned_unit_type',
  active: true,
  systemOnly: false,
  surrogateProductKey: 'compound_owner',
  boundQuestionCode: 'owned_unit_type',
  ...over,
});

const attach = (over: Partial<Parameters<typeof planAttach>[0]> = {}) =>
  planAttach({
    productKey: 'compound_owner',
    question: choice(),
    facts: [],
    askedFactKeys: [],
    askIn: [],
    blueprintsAsking: [],
    ...over,
  });

describe('planAttach — the fact key', () => {
  it("is the question's own code, verbatim", () => {
    // Not a re-slug of the wording: the code is already an immutable slug of it, so
    // re-slugging would mint a DIFFERENT key the day somebody rewords the question — and a
    // fact key must not move, because stored rules name it and bank figures are filed on it.
    expect(derivedFactKey({ code: 'unit_months_owned' })).toBe('unit_months_owned');
  });

  it('mints a fact and files it under the product that made it', () => {
    const plan = attach();
    expect(plan).toMatchObject({ kind: 'proceed', factKey: 'owned_unit_type' });
    if (plan.kind !== 'proceed') return;
    expect(plan.steps).toEqual([
      {
        op: 'createFact',
        factKey: 'owned_unit_type',
        questionCode: 'owned_unit_type',
        labelAr: 'نوع الوحدة',
        labelEn: 'What kind of unit do you own?',
        fileUnderProduct: true,
      },
      { op: 'bindFact', factKey: 'owned_unit_type', questionCode: 'owned_unit_type' },
      { op: 'addAsk', factKey: 'owned_unit_type' },
    ]);
  });

  it('JOINS a fact that already reads the question, and mints nothing', () => {
    // The rule the whole design turns on. Ticking a fact another product authored, or one
    // the platform owns, must join it — a rival key would be a permanent second name for
    // one answer.
    const plan = attach({ facts: [fact({ surrogateProductKey: 'school_type_cap' })] });
    expect(plan).toMatchObject({ kind: 'proceed', factKey: 'owned_unit_type' });
    if (plan.kind !== 'proceed') return;
    expect(plan.steps.map((s) => s.op)).toEqual(['addAsk']);
  });

  it('never re-files a joined fact under the ticking product', () => {
    const plan = attach({ facts: [fact({ surrogateProductKey: null })] });
    if (plan.kind !== 'proceed') throw new Error('expected proceed');
    // No `createFact`, so `fileUnderProduct` never arises: an unfiled fact stays unfiled,
    // which is what keeps a shared fact out of one product's on/off switch.
    expect(plan.steps.some((s) => s.op === 'createFact')).toBe(false);
  });

  it('finishes a half-done create by binding an unbound row of the same key', () => {
    const plan = attach({ facts: [fact({ boundQuestionCode: null })] });
    if (plan.kind !== 'proceed') throw new Error('expected proceed');
    expect(plan.steps.map((s) => s.op)).toEqual(['bindFact', 'addAsk']);
  });

  it('refuses a key held by a fact bound to a DIFFERENT question', () => {
    // Never resolved by minting `<key>_2`. A suffixed twin is permanent, and every bank
    // figure filed under it points at a key nobody meant.
    expect(attach({ facts: [fact({ boundQuestionCode: 'something_else' })] })).toEqual({
      kind: 'refuse',
      refusal: {
        code: 'keyTaken',
        questionCode: 'owned_unit_type',
        factKey: 'owned_unit_type',
        boundQuestionCode: 'something_else',
      },
    });
  });

  it('refuses when TWO facts read the question', () => {
    const plan = attach({
      facts: [fact({ id: 'f1', key: 'a_key' }), fact({ id: 'f2', key: 'b_key' })],
    });
    expect(plan).toEqual({
      kind: 'refuse',
      refusal: {
        code: 'ambiguousFact',
        questionCode: 'owned_unit_type',
        factKeys: ['a_key', 'b_key'],
      },
    });
  });

  it('refuses a key the platform computes for itself', () => {
    const plan = attach({ question: choice({ code: 'i_score', id: 'qi' }) });
    expect(plan).toMatchObject({ kind: 'refuse', refusal: { code: 'keyReserved' } });
  });

  it('refuses a key a blueprint declares for a different question', () => {
    // The seed reads an existing bound key as REUSE, so without this the blueprint's own
    // product would start reading the operator's question on the next deploy — no plan
    // step, no log line, no refusal.
    const plan = attach({
      blueprintsAsking: [{ blueprintKey: 'school_type_cap', questionCode: 'another_question' }],
    });
    expect(plan).toMatchObject({
      kind: 'refuse',
      refusal: { code: 'blueprintOwnsKey', blueprintKeys: ['school_type_cap'] },
    });
  });

  it('allows a key a blueprint declares for the SAME question', () => {
    const plan = attach({
      blueprintsAsking: [{ blueprintKey: 'school_type_cap', questionCode: 'owned_unit_type' }],
    });
    expect(plan.kind).toBe('proceed');
  });

  it('allows a key a blueprint declares with no question of its own', () => {
    // A `choice` ask MINTS its question, so the blueprint states no code — there is nothing
    // to conflict with, and refusing would refuse a legitimate tick.
    const plan = attach({ blueprintsAsking: [{ blueprintKey: 'compound_owner' }] });
    expect(plan.kind).toBe('proceed');
  });
});

describe('planAttach — which questions may be ticked', () => {
  it('allows EVERY question type, including a multi-pick and free text', () => {
    // A key table is read by one option code or by several (the bank's row order decides,
    // `fact-value.ts`), a band table by a number, and a text answer by its presence. None
    // of the four is refused on shape any more.
    for (const type of ['SINGLE_SELECT', 'MULTI_SELECT', 'NUMERIC', 'TEXT'] as const) {
      expect(attach({ question: choice({ type }) }).kind).toBe('proceed');
    }
  });

  it('refuses only a type the platform has no reader for', () => {
    // Not reachable from today's schema — every `QuestionType` is bindable — so this pins
    // the guard that keeps a type ADDED later from being tickable before it can be read.
    expect(attach({ question: choice({ type: 'SIGNATURE' as never }) })).toMatchObject({
      kind: 'refuse',
      refusal: { code: 'questionTypeInvalid' },
    });
  });

  it('allows the declared payslip and the loan being asked for', () => {
    // These four were refused until the ask board opened every pool question. Kept as a
    // test rather than deleted: it is the regression guard for that decision, and the one
    // that matters is `monthly_income` — a no-payslip rule may now read the declared
    // salary, which is a choice the operator makes per product and no longer a refusal.
    for (const code of [
      'monthly_income',
      'amount_requested',
      'repayment_period_months',
      'current_installments',
    ]) {
      expect(attach({ question: choice({ code, type: 'NUMERIC' }) }).kind).toBe('proceed');
    }
  });

  it('allows one itemised debt, as well as the credit-card limit', () => {
    for (const code of ['obligation_mortgage', 'credit_card_total_limit']) {
      expect(attach({ question: choice({ code, type: 'NUMERIC' }) }).kind).toBe('proceed');
    }
  });

  it('refuses a question with no code at all', () => {
    expect(attach({ question: undefined })).toMatchObject({
      kind: 'refuse',
      refusal: { code: 'questionInactive' },
    });
  });
});

describe('planAttach — the loan types', () => {
  it('adds only the loan types that do not ask it yet, and never removes one', () => {
    const plan = attach({ askIn: ['personal', 'car'] });
    if (plan.kind !== 'proceed') throw new Error('expected proceed');
    expect(plan.steps.at(-1)).toEqual({
      op: 'addCategories',
      questionId: 'q1',
      questionCode: 'owned_unit_type',
      categories: ['car'],
    });
  });

  it('adds no step when every loan type already asks it', () => {
    const plan = attach({ askIn: ['personal'] });
    if (plan.kind !== 'proceed') throw new Error('expected proceed');
    // No `addCategories` means no publish: a byte-identical questionnaire version is noise
    // in the one history an operator reads to see what they did.
    expect(plan.steps.some((s) => s.op === 'addCategories')).toBe(false);
  });

  it('refuses to start asking a REQUIRED question of a new loan type', () => {
    // Apply reads LIVE assignments while the customer is served a frozen snapshot, so
    // between the write and the publish — and permanently if the publish fails — every
    // application in that loan type is refused for not answering a question its
    // questionnaire never contained.
    expect(attach({ question: choice({ isRequired: true }), askIn: ['car'] })).toEqual({
      kind: 'refuse',
      refusal: {
        code: 'widenRequired',
        questionCode: 'owned_unit_type',
        categories: ['car'],
      },
    });
  });

  it('allows a REQUIRED question the loan type already asks', () => {
    expect(attach({ question: choice({ isRequired: true }), askIn: ['personal'] }).kind).toBe(
      'proceed',
    );
  });

  it('adds no ask row when the product already reads the fact, but still widens', () => {
    const plan = attach({
      facts: [fact()],
      askedFactKeys: ['owned_unit_type'],
      askIn: ['car'],
    });
    if (plan.kind !== 'proceed') throw new Error('expected proceed');
    expect(plan.steps.map((s) => s.op)).toEqual(['addCategories']);
  });

  it('is a complete no-op on a re-tick', () => {
    const plan = attach({
      facts: [fact()],
      askedFactKeys: ['owned_unit_type'],
      askIn: ['personal'],
    });
    expect(plan).toEqual({
      kind: 'proceed',
      factKey: 'owned_unit_type',
      questionCode: 'owned_unit_type',
      steps: [],
    });
  });
});

const detach = (over: Partial<Parameters<typeof planDetach>[0]> = {}) =>
  planDetach({
    productKey: 'compound_owner',
    factKey: 'owned_unit_type',
    ask: { source: 'operator' },
    fact: fact(),
    productsAsking: ['compound_owner'],
    ownRuleStepIds: [],
    readBy: [],
    ...over,
  });

describe('planDetach', () => {
  it('is a no-op when the product does not ask it', () => {
    // Idempotent by design: a double-click, or two tabs, must not produce a 404.
    expect(detach({ ask: undefined })).toEqual({ kind: 'noop' });
  });

  it("TOMBSTONES the library's own ask rather than deleting the row", () => {
    // The row has to survive: `npm run seed:blueprints` re-asserts every blueprint ask with
    // an insert that is idempotent by primary key, so a row that is still there — detached —
    // is a row it writes nothing over. Deleting it would hand the seed a clean slate and the
    // untick would come back on the next release with nothing saying why.
    expect(detach({ ask: { source: 'blueprint' } })).toEqual({
      kind: 'proceed',
      steps: [{ op: 'tombstoneAsk', factKey: 'owned_unit_type' }],
    });
  });

  it("never proposes deleting the fact row behind the library's own ask", () => {
    // Even with every delete test satisfied — nobody else asks it, nothing else reads it,
    // this product authored it. The blueprint re-declares that fact on the next run whatever
    // this screen does, so there is no delete decision to make.
    expect(
      detach({
        ask: { source: 'blueprint' },
        productsAsking: ['compound_owner'],
        readBy: [],
      }),
    ).toEqual({
      kind: 'proceed',
      steps: [{ op: 'tombstoneAsk', factKey: 'owned_unit_type' }],
    });
  });

  it("still refuses the library's own ask while the product's OWN calculation reads it", () => {
    // The order matters: the incoherence guard is checked BEFORE the source, so a blueprint
    // ask its own rule reads is refused rather than quietly tombstoned.
    expect(detach({ ask: { source: 'blueprint' }, ownRuleStepIds: ['primary'] })).toEqual({
      kind: 'refuse',
      refusal: {
        code: 'readByOwnRule',
        productKey: 'compound_owner',
        factKey: 'owned_unit_type',
        stepIds: ['primary'],
      },
    });
  });

  it("refuses while the product's OWN calculation reads it", () => {
    expect(detach({ ownRuleStepIds: ['primary'] })).toEqual({
      kind: 'refuse',
      refusal: {
        code: 'readByOwnRule',
        productKey: 'compound_owner',
        factKey: 'owned_unit_type',
        stepIds: ['primary'],
      },
    });
  });

  it('deletes the fact row only when nothing at all is left of it', () => {
    const plan = detach();
    expect(plan).toEqual({
      kind: 'proceed',
      steps: [
        { op: 'removeAsk', factKey: 'owned_unit_type' },
        { op: 'deleteFact', factKey: 'owned_unit_type' },
      ],
    });
  });

  it('keeps the row when ANOTHER product asks it, and refuses nothing', () => {
    // The guarantee that one product's untick cannot break another's calculation: no delete
    // is proposed, so there is nothing for a reader to block.
    const plan = detach({ productsAsking: ['compound_owner', 'school_type_cap'], readBy: [] });
    expect(plan).toEqual({
      kind: 'proceed',
      steps: [{ op: 'removeAsk', factKey: 'owned_unit_type' }],
    });
  });

  it('keeps the row when the platform owns it', () => {
    const plan = detach({ fact: fact({ systemOnly: true }) });
    if (plan.kind !== 'proceed') throw new Error('expected proceed');
    expect(plan.steps.map((s) => s.op)).toEqual(['removeAsk']);
  });

  it('keeps the row when another product authored it', () => {
    const plan = detach({ fact: fact({ surrogateProductKey: 'school_type_cap' }) });
    if (plan.kind !== 'proceed') throw new Error('expected proceed');
    expect(plan.steps.map((s) => s.op)).toEqual(['removeAsk']);
  });

  it('refuses when the delete WAS the point and something still reads it', () => {
    expect(
      detach({ readBy: [{ source: 'bank_program_cap', ref: 'ABK-PER-PRIVATE_SECTOR' }] }),
    ).toEqual({
      kind: 'refuse',
      refusal: {
        code: 'factInUse',
        factKey: 'owned_unit_type',
        readBy: [{ source: 'bank_program_cap', ref: 'ABK-PER-PRIVATE_SECTOR' }],
      },
    });
  });

  it('does NOT refuse a NON-BANK reader when another product keeps the row alive anyway', () => {
    // Nothing is being deleted, so the reader keeps reading and the ask simply goes. An
    // "in use" refusal here would block an untick that costs nothing. Another product's
    // stored rule is that kind of reader: it is not a reason THIS product must keep asking.
    const plan = detach({
      productsAsking: ['compound_owner', 'school_stage_ceiling'],
      readBy: [{ source: 'surrogate_product', ref: 'school_stage_ceiling' }],
    });
    expect(plan.kind).toBe('proceed');
  });

  it('refuses a BANK PROGRAM reader even when another product keeps the row alive', () => {
    // The reason the delete decision is irrelevant here: since the program-name axis
    // narrows the questionnaire, an untick decides whether the applicants this program
    // quotes are ASKED the question at all. Take the answer away from a cap table and
    // `onNoMatch: 'useProgramMax'` swallows the miss — the program quotes its own maximum
    // instead of the bank's row, and nothing reports it. That is how
    // `do_you_own_more_than_one_unit` went dark and took ABK's multi-unit uplift with it.
    expect(
      detach({
        productsAsking: ['compound_owner', 'school_stage_ceiling'],
        readBy: [{ source: 'bank_program', ref: 'X' }],
      }),
    ).toEqual({
      kind: 'refuse',
      refusal: {
        code: 'factInUse',
        factKey: 'owned_unit_type',
        readBy: [{ source: 'bank_program', ref: 'X' }],
      },
    });
  });

  it('refuses a BANK PROGRAM reader on a BLUEPRINT ask, before the tombstone branch', () => {
    // The tombstone branch exists because the library re-declares its own facts, which says
    // nothing about whether a bank is quoting off one right now. Ordering regression test.
    expect(
      detach({
        ask: { source: 'blueprint' },
        readBy: [{ source: 'bank_program_cap', ref: 'ABK-PER-COMPOUND_OWNER' }],
      }),
    ).toEqual({
      kind: 'refuse',
      refusal: {
        code: 'factInUse',
        factKey: 'owned_unit_type',
        readBy: [{ source: 'bank_program_cap', ref: 'ABK-PER-COMPOUND_OWNER' }],
      },
    });
  });

  it('never writes a category and never publishes', () => {
    const plan = detach();
    if (plan.kind !== 'proceed') throw new Error('expected proceed');
    // Asserted as an ABSENCE, which is the only way to pin the detach-only guarantee: the
    // step union has no category op at all, so this fails the moment one is added.
    expect(plan.steps.every((s) => s.op === 'removeAsk' || s.op === 'deleteFact')).toBe(true);
  });
});
