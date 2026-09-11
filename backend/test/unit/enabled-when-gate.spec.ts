import { describe, expect, it } from 'vitest';

import { enabledWhenGate, isQuestionVisible } from '@/questionnaire/validation/question-visibility';
import {
  NEVER_PRODUCT_SCOPED_QUESTION_CODES,
  narrowAskedQuestions,
  type NarrowingScope,
} from '@/questionnaire/validation/question-scope';
import {
  DEBT_TYPES_QUESTION_CODE,
  MONEY_FIELD_BINDING_SPECS,
  OBLIGATION_ITEM_QUESTION_BY_DEBT_TYPE,
} from '@/matching/pipeline/money-field-bindings';

/**
 * The gate reader carried onto `BoundQuestion`, so an operator screen can tell what KIND of
 * fact a question answers. The bar it has to clear is agreement with `isQuestionVisible`:
 * both read the same stored blob, and a caller asking "what is this gated on" must never get
 * a different answer from the one asking "is this shown".
 */
describe('enabledWhenGate', () => {
  it('reads a complete rule', () => {
    expect(
      enabledWhenGate({ enabledWhen: { questionCode: 'additional_income', optionCode: 'yes' } }),
    ).toEqual({
      questionCode: 'additional_income',
      optionCode: 'yes',
    });
  });

  it('answers null for a question asked of everyone', () => {
    expect(enabledWhenGate({ enabledWhen: null })).toBeNull();
    expect(enabledWhenGate({ enabledWhen: undefined })).toBeNull();
  });

  it('carries the operator, or rather ignores it — the GATE is the pair, not the comparison', () => {
    // `not_equals` still means "asked behind this question". What flips is which answer
    // shows it, and that is `isQuestionVisible`'s business, not this one's.
    expect(
      enabledWhenGate({
        enabledWhen: {
          questionCode: 'additional_income',
          operator: 'not_equals',
          optionCode: 'yes',
        },
      }),
    ).toEqual({ questionCode: 'additional_income', optionCode: 'yes' });
  });

  describe('a HALF rule reads as no gate, exactly as it reads as visible', () => {
    const halves = [
      { enabledWhen: { questionCode: 'additional_income' } },
      { enabledWhen: { optionCode: 'yes' } },
      { enabledWhen: {} },
    ];

    for (const [i, q] of halves.entries()) {
      it(`half ${i}: no gate, and still shown`, () => {
        expect(enabledWhenGate(q)).toBeNull();
        // The agreement that matters: a question this reports as ungated is one the
        // questionnaire puts in front of everybody.
        expect(isQuestionVisible(q, new Map(), new Map())).toBe(true);
      });
    }
  });

  it('is not fooled by a non-object blob', () => {
    expect(enabledWhenGate({ enabledWhen: 'additional_income' })).toBeNull();
    expect(enabledWhenGate({ enabledWhen: 42 })).toBeNull();
  });
});

/**
 * The program-name axis reads the same gates, and it is where getting them wrong is
 * expensive: `isQuestionVisible` SHOWS a question whose gate source is missing, so a
 * narrowing that dropped a source while keeping a question behind it would make that
 * question unconditionally visible — and a required one mandatory for every applicant.
 */
describe('narrowAskedQuestions — gates', () => {
  const scope = (over: Partial<NarrowingScope>): NarrowingScope => ({
    programNameKey: 'a_name',
    factBoundQuestionCodes: [],
    askScopedQuestionCodes: [],
    platformQuestionCodes: [],
    neededQuestionCodes: [],
    ...over,
  });
  const gate = (source: string) => ({ questionCode: source, operator: 'equals', optionCode: 'yes' });

  it('is OFF with no scope, and keeps every question', () => {
    const decision = narrowAskedQuestions([{ code: 'a', enabledWhen: null }], null);
    expect(decision.narrowed).toBe(false);
    expect(decision.disabledReason).toBe('no_name');
  });

  /**
   * Every scenario carries `monthly_income` as a core anchor. Without one the keep set can
   * empty out, which trips the module's own floor and turns narrowing OFF — and the
   * assertions would then pass for the wrong reason. Production always has an anchor: the
   * four money bindings can never be narrowed away.
   */
  const ANCHOR = { code: 'monthly_income', enabledWhen: null };

  it('drops a gate-only source once everything behind it has gone', () => {
    // `owns_compound_unit` in miniature: it binds no fact of its own and exists to gate.
    const decision = narrowAskedQuestions(
      [
        ANCHOR,
        { code: 'owns_a_unit', enabledWhen: null },
        { code: 'which_unit', enabledWhen: gate('owns_a_unit') },
      ],
      scope({
        factBoundQuestionCodes: ['which_unit'],
        askScopedQuestionCodes: ['which_unit'],
        neededQuestionCodes: [],
      }),
    );
    expect(decision.narrowed).toBe(true);
    expect([...decision.keep]).toEqual(['monthly_income']);
    expect(decision.gateSourcesDropped).toEqual(['owns_a_unit']);
  });

  it('keeps the source when anything behind it survives', () => {
    const decision = narrowAskedQuestions(
      [
        ANCHOR,
        { code: 'owns_a_unit', enabledWhen: null },
        { code: 'which_unit', enabledWhen: gate('owns_a_unit') },
      ],
      scope({
        factBoundQuestionCodes: ['which_unit'],
        askScopedQuestionCodes: ['which_unit'],
        neededQuestionCodes: ['which_unit'],
      }),
    );
    expect([...decision.keep].sort()).toEqual(['monthly_income', 'owns_a_unit', 'which_unit']);
  });

  it('refuses to drop a source that binds a fact of its own', () => {
    // `employment_status` is the live case: its only gated dependent is `military_grade`,
    // and it drives the employment allow-lists and the debt-burden cap for every program.
    const decision = narrowAskedQuestions(
      [
        ANCHOR,
        { code: 'employment_status', enabledWhen: null },
        { code: 'military_grade', enabledWhen: gate('employment_status') },
      ],
      scope({
        factBoundQuestionCodes: ['employment_status', 'military_grade'],
        askScopedQuestionCodes: ['military_grade'],
        neededQuestionCodes: [],
      }),
    );
    expect([...decision.keep].sort()).toEqual(['employment_status', 'monthly_income']);
    expect(decision.gateSourcesDropped).toEqual([]);
  });

  it('resolves a two-level chain, which one sweep would not', () => {
    // No chain exists in the seed, so a single-pass implementation passes every test written
    // against the real database and breaks the first time one does. All three links are
    // product-scoped and only the LEAF is needed, so `middle` and then `top` have to be
    // pulled back through two rounds — one sweep would reach `middle` and stop.
    const decision = narrowAskedQuestions(
      [
        ANCHOR,
        { code: 'top', enabledWhen: null },
        { code: 'middle', enabledWhen: gate('top') },
        { code: 'leaf', enabledWhen: gate('middle') },
      ],
      scope({
        factBoundQuestionCodes: ['top', 'middle', 'leaf'],
        askScopedQuestionCodes: ['top', 'middle', 'leaf'],
        neededQuestionCodes: ['leaf'],
      }),
    );
    expect([...decision.keep].sort()).toEqual(['leaf', 'middle', 'monthly_income', 'top']);
    expect([...decision.gateSourcesRetained].sort()).toEqual(['middle', 'top']);
    // Pulled back for the gate, so not a figure any program reads: not required.
    expect([...decision.extraRequired]).toEqual(['leaf']);
  });

  it('drops a whole chain when nothing at the bottom is needed', () => {
    const decision = narrowAskedQuestions(
      [
        ANCHOR,
        { code: 'top', enabledWhen: null },
        { code: 'middle', enabledWhen: gate('top') },
        { code: 'leaf', enabledWhen: gate('middle') },
      ],
      scope({
        factBoundQuestionCodes: ['middle', 'leaf'],
        askScopedQuestionCodes: ['middle', 'leaf'],
        neededQuestionCodes: [],
      }),
    );
    expect([...decision.keep]).toEqual(['monthly_income']);
  });

  it('never leaves a kept question with a dropped gate source', () => {
    // The post-condition the module asserts. Stated here too, because it is the invariant
    // the whole design turns on and it must not be reachable through any input.
    const questions = [
      ANCHOR,
      { code: 'owns_a_unit', enabledWhen: null },
      { code: 'which_unit', enabledWhen: gate('owns_a_unit') },
      { code: 'unit_price', enabledWhen: gate('owns_a_unit') },
    ];
    for (const needed of [[], ['which_unit'], ['unit_price'], ['which_unit', 'unit_price']]) {
      const decision = narrowAskedQuestions(
        questions,
        scope({
          factBoundQuestionCodes: ['which_unit', 'unit_price'],
          askScopedQuestionCodes: ['which_unit', 'unit_price'],
          neededQuestionCodes: needed,
        }),
      );
      for (const q of questions) {
        if (!decision.keep.has(q.code)) continue;
        const g = enabledWhenGate(q);
        if (g === null) continue;
        expect(decision.keep.has(g.questionCode)).toBe(true);
      }
    }
  });

  it('requires a kept product question, and never a source pulled back for its gate', () => {
    const decision = narrowAskedQuestions(
      [
        ANCHOR,
        { code: 'owns_a_unit', enabledWhen: null },
        { code: 'which_unit', enabledWhen: gate('owns_a_unit') },
      ],
      scope({
        factBoundQuestionCodes: ['which_unit'],
        askScopedQuestionCodes: ['which_unit'],
        neededQuestionCodes: ['which_unit'],
      }),
    );
    expect([...decision.extraRequired]).toEqual(['which_unit']);
  });

  it('never narrows a question that moves money for every program', () => {
    // Iterated from the constants rather than restated, so a new obligation item is covered
    // by the change that adds it. Each of these is a term of the debt-burden sum, or the
    // branch source that decides whether the itemised sum is used at all — and the four
    // money bindings are what the mobile walks to decide whether Finish may be enabled.
    const codes = [
      ...Object.values(MONEY_FIELD_BINDING_SPECS).map((spec) => spec.questionCode),
      DEBT_TYPES_QUESTION_CODE,
      ...Object.values(OBLIGATION_ITEM_QUESTION_BY_DEBT_TYPE),
    ];
    for (const code of codes) expect(NEVER_PRODUCT_SCOPED_QUESTION_CODES.has(code)).toBe(true);

    // And they survive a scope that asks for none of them and would otherwise scope them.
    const decision = narrowAskedQuestions(
      codes.map((code) => ({ code, enabledWhen: null })),
      scope({ factBoundQuestionCodes: codes, askScopedQuestionCodes: codes }),
    );
    expect([...decision.keep].sort()).toEqual([...codes].sort());
    expect([...decision.extraRequired]).toEqual([]);
  });

  it('leaves the platform its own questions', () => {
    const decision = narrowAskedQuestions(
      [
        ANCHOR,
        { code: 'i_score', enabledWhen: null },
        { code: 'academic_rank', enabledWhen: null },
      ],
      scope({
        factBoundQuestionCodes: ['i_score', 'academic_rank'],
        askScopedQuestionCodes: ['i_score', 'academic_rank'],
        platformQuestionCodes: ['i_score'],
      }),
    );
    expect([...decision.keep].sort()).toEqual(['i_score', 'monthly_income']);
  });
});
