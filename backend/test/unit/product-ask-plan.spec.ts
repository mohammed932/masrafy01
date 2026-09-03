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
    expect(
      attach({ facts: [fact({ boundQuestionCode: 'something_else' })] }),
    ).toEqual({
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
  it('refuses a shape no table can be keyed by', () => {
    for (const type of ['TEXT', 'MULTI_SELECT'] as const) {
      expect(attach({ question: choice({ type }) })).toMatchObject({
        kind: 'refuse',
        refusal: { code: 'questionTypeInvalid', type },
      });
    }
  });

  it('refuses the declared payslip and the loan being asked for', () => {
    for (const code of [
      'monthly_income',
      'amount_requested',
      'repayment_period_months',
      'current_installments',
    ]) {
      expect(attach({ question: choice({ code, type: 'NUMERIC' }) })).toMatchObject({
        kind: 'refuse',
        refusal: { code: 'questionNotEligible', reason: 'money_binding' },
      });
    }
  });

  it('refuses one itemised debt but ALLOWS the credit-card limit', () => {
    expect(attach({ question: choice({ code: 'obligation_mortgage', type: 'NUMERIC' }) })).toMatchObject(
      { kind: 'refuse', refusal: { reason: 'obligation_item' } },
    );
    // The deliberate exception: it already IS the platform fact `credit_card_limit`, so
    // excluding the whole block would refuse a fact the platform ships.
    expect(
      attach({ question: choice({ code: 'credit_card_total_limit', type: 'NUMERIC' }) }).kind,
    ).toBe('proceed');
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

  it("refuses to remove the library's own ask", () => {
    // Not a permission. The seed re-asserts its own asks, so an untick would come back on
    // the next release with nothing saying why.
    expect(detach({ ask: { source: 'blueprint' } })).toEqual({
      kind: 'refuse',
      refusal: {
        code: 'blueprintOwnsAsk',
        productKey: 'compound_owner',
        factKey: 'owned_unit_type',
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

  it('does NOT refuse a reader when another product keeps the row alive anyway', () => {
    // Nothing is being deleted, so the reader keeps reading and the ask simply goes. An
    // "in use" refusal here would block an untick that costs nothing.
    const plan = detach({
      productsAsking: ['compound_owner', 'school_stage_ceiling'],
      readBy: [{ source: 'bank_program', ref: 'X' }],
    });
    expect(plan.kind).toBe('proceed');
  });

  it('never writes a category and never publishes', () => {
    const plan = detach();
    if (plan.kind !== 'proceed') throw new Error('expected proceed');
    // Asserted as an ABSENCE, which is the only way to pin the detach-only guarantee: the
    // step union has no category op at all, so this fails the moment one is added.
    expect(plan.steps.every((s) => s.op === 'removeAsk' || s.op === 'deleteFact')).toBe(true);
  });
});
