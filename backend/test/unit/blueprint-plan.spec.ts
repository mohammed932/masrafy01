/**
 * What creating a predefined product writes — and, on a second run, does not.
 *
 * The failure this pins is not a wrong figure, it is a DUPLICATE key. `uniqueSlug` would
 * mint `compound_2` for a second list called Compound; keys are immutable; and that key then
 * appears in every bank's stored configuration forever (§10.9). So every object is looked up
 * by key and reused, and picking the same product twice must plan nothing at all.
 */
import { describe, expect, it } from 'vitest';
import { LoanCategory } from '@prisma/client';
import {
  planBlueprint,
  type BlueprintExistingState,
} from '@/bank-programs/blueprints/blueprint-plan';
import { productBlueprint, productBlueprints } from '@/bank-programs/blueprints/product-blueprints';

const EMPTY: BlueprintExistingState = {
  typeKeys: new Set(),
  valueKeysByType: new Map(),
  questionCodes: new Set(),
  categoriesByQuestion: new Map(),
  factKeys: new Set(),
  mirroredTypeKeys: new Set(),
  productKeys: new Set(),
  questionCodeByFact: new Map(),
  unboundFactKeys: new Set(),
  inactiveQuestionCodes: new Set(),
};

const plan = (key: string, existing: BlueprintExistingState = EMPTY) =>
  planBlueprint({
    blueprint: productBlueprint(key)!,
    productKey: 'my_product',
    productLabelEn: 'My product',
    productLabelAr: 'منتجي',
    existing,
  });

/** The state the plan for `key` would leave behind, so a second run can be planned. */
function afterRunning(key: string): BlueprintExistingState {
  const result = plan(key);
  const typeKeys = new Set<string>();
  const valueKeysByType = new Map<string, Set<string>>();
  const questionCodes = new Set<string>();
  const categoriesByQuestion = new Map<string, Set<LoanCategory>>();
  const factKeys = new Set<string>();
  const mirroredTypeKeys = new Set<string>();
  const productKeys = new Set<string>();

  for (const step of result.steps) {
    switch (step.op) {
      case 'createProductRow':
        productKeys.add(step.key);
        break;
      case 'createType':
        typeKeys.add(step.typeKey);
        break;
      case 'createValues': {
        const have = valueKeysByType.get(step.typeKey) ?? new Set<string>();
        for (const value of step.values) have.add(value.key);
        valueKeysByType.set(step.typeKey, have);
        break;
      }
      case 'createQuestion':
        questionCodes.add(step.questionCode);
        categoriesByQuestion.set(step.questionCode, new Set(step.categories));
        if (step.optionsFromEnumerationType) mirroredTypeKeys.add(step.optionsFromEnumerationType);
        break;
      case 'linkMirror':
        mirroredTypeKeys.add(step.typeKey);
        break;
      case 'reactivateQuestion':
        break;
      case 'createFact':
        factKeys.add(step.factKey);
        break;
      case 'bindFact':
        break;
      case 'widenCategories':
        categoriesByQuestion.set(step.questionCode, new Set(step.categories));
        break;
      case 'setProductTemplate':
        break;
    }
  }
  const questionCodeByFact = new Map<string, string>();
  for (const step of result.steps) {
    if (step.op === 'createFact') questionCodeByFact.set(step.factKey, step.questionCode);
  }
  return {
    typeKeys,
    valueKeysByType,
    questionCodes,
    categoriesByQuestion,
    factKeys,
    mirroredTypeKeys,
    productKeys,
    questionCodeByFact,
    unboundFactKeys: new Set(),
    inactiveQuestionCodes: new Set(),
  };
}

describe('planning against an empty database', () => {
  it('creates the product row FIRST, and writes the calculation LAST', () => {
    // The row first, because a fact filed under a product names it. The calculation last,
    // because the validator checks every fact it reads.
    const steps = plan('compound_owner').steps.map((step) => step.op);
    expect(steps[0]).toBe('createProductRow');
    expect(steps.at(-1)).toBe('setProductTemplate');
  });

  it('creates a class list before the list filed under it', () => {
    // `resolveParentKey` refuses to create a filed-under value with no parent: a compound is
    // born filed. Planning them the other way round is a run that fails half-way.
    const steps = plan('compound_owner').steps;
    const classType = steps.findIndex(
      (step) => step.op === 'createType' && step.typeKey === 'compound_category',
    );
    const classValues = steps.findIndex(
      (step) => step.op === 'createValues' && step.typeKey === 'compound_category',
    );
    const childType = steps.findIndex(
      (step) => step.op === 'createType' && step.typeKey === 'compound',
    );
    const childValues = steps.findIndex(
      (step) => step.op === 'createValues' && step.typeKey === 'compound',
    );
    expect(classType).toBeGreaterThanOrEqual(0);
    expect(classValues).toBeGreaterThan(classType);
    expect(childType).toBeGreaterThan(classValues);
    expect(childValues).toBeGreaterThan(childType);
  });

  it('files the child list under its class, with a catch-all to land in', () => {
    const step = plan('compound_owner').steps.find(
      (s) => s.op === 'createType' && s.typeKey === 'compound',
    );
    expect(step).toMatchObject({
      parentTypeKey: 'compound_category',
      fallbackParentKey: 'compound_tier_other',
    });
  });

  it('mirrors a choice question off its list, so the option codes are the list keys', () => {
    const step = plan('school_stage_ceiling').steps.find(
      (s) => s.op === 'createQuestion' && s.optionsFromEnumerationType === 'school_stage',
    );
    expect(step).toMatchObject({ type: 'SINGLE_SELECT' });
  });

  it('slugs a created question code from its English wording, never a declared one', () => {
    // A question's code is generated and immutable (A33), so a code stated in a blueprint
    // would be a wish the service cannot grant — it slugs the wording and returns that. This
    // is also what makes an ask two blueprints share resolve to ONE question.
    const step = plan('school_stage_ceiling').steps.find(
      (s) => s.op === 'createQuestion' && s.optionsFromEnumerationType === 'school_stage',
    );
    expect(step && step.op === 'createQuestion' && step.questionCode).toBe(
      'which_stage_do_you_teach',
    );
  });

  it('creates a numeric question with its bounds and its branch', () => {
    const step = plan('auto_loan_crosssell').steps.find(
      (s) => s.op === 'createQuestion' && s.type === 'NUMERIC',
    );
    expect(step).toMatchObject({
      type: 'NUMERIC',
      numeric: { min: 0, max: 20000000 },
      enabledWhen: { questionCode: 'current_loans', optionCode: 'car_loan' },
    });
  });

  it('files a new fact under the product that authored it', () => {
    const step = plan('compound_owner').steps.find(
      (s) => s.op === 'createFact' && s.factKey === 'unit_paid_to_date',
    );
    expect(step).toMatchObject({ surrogateProductKey: 'my_product' });
  });

  it('leaves a CAP blueprint with no product, and its facts with the platform', () => {
    const result = planBlueprint({
      blueprint: productBlueprint('club_branch_cap')!,
      productKey: null,
      productLabelEn: '',
      productLabelAr: '',
      existing: EMPTY,
    });
    expect(result.steps.some((step) => step.op === 'createProductRow')).toBe(false);
    expect(result.steps.some((step) => step.op === 'setProductTemplate')).toBe(false);
    const fact = result.steps.find((step) => step.op === 'createFact');
    expect(fact).toBeDefined();
    expect(fact && 'surrogateProductKey' in fact).toBe(false);
  });
});

describe('planning against a database that already holds some of it', () => {
  it.each(productBlueprints().map((blueprint) => [blueprint.key] as const))(
    '%s plans NOTHING on a second run',
    (key) => {
      const second = plan(key, afterRunning(key));
      // The calculation write is the one step that repeats — re-saving the same form is a
      // no-op the service already handles — so `noop` looks past it.
      expect(second.noop).toBe(true);
      expect(second.steps.filter((step) => step.op !== 'setProductTemplate')).toEqual([]);
    },
  );

  it('reuses a list two blueprints share instead of minting a second one', () => {
    // The school type is a ceiling product's column AND a cap of its own. A second list would
    // be `school_type_2`, permanent, in every bank's stored table.
    const after = afterRunning('school_stage_ceiling');
    const result = plan('school_type_cap', after);
    expect(result.steps.some((step) => step.op === 'createType')).toBe(false);
    expect(result.steps.some((step) => step.op === 'createQuestion')).toBe(false);
    expect(result.reuse.typeKeys).toContain('school_type');
    expect(result.reuse.questionCodes).toContain('is_the_school_international_or_national');
  });

  it('adds only the values a list is missing, and re-labels nothing', () => {
    const existing: BlueprintExistingState = {
      ...EMPTY,
      typeKeys: new Set(['military_grade']),
      valueKeysByType: new Map([
        ['military_grade', new Set(['officer', 'senior_officer', 'general', 'grade_major'])],
      ]),
      questionCodes: new Set(['military_grade']),
      factKeys: new Set(['military_grade']),
    };
    const result = plan('armed_forces_grades', existing);
    const values = result.steps.find((step) => step.op === 'createValues');
    expect(values).toBeDefined();
    const added = values && values.op === 'createValues' ? values.values.map((v) => v.key) : [];
    expect(added).not.toContain('grade_major');
    expect(added).toHaveLength(6);
    expect(result.reuse.valueKeys).toContain('military_grade/grade_major');
  });

  it('links a copied list to its question before adding to it', () => {
    // The seed COPIED these values into the question once and set no link, so a value added
    // afterwards reached the registry and never the question — pickable by no applicant,
    // readable by no bank's table. The link is stamped first so the one sync at the end
    // reaches the new rows.
    const existing: BlueprintExistingState = {
      ...EMPTY,
      typeKeys: new Set(['professor_rank']),
      valueKeysByType: new Map([['professor_rank', new Set(['lecturer'])]]),
      questionCodes: new Set(['academic_rank']),
      factKeys: new Set(['academic_rank']),
    };
    const result = plan('academic_rank_table', existing);
    const link = result.steps.findIndex((step) => step.op === 'linkMirror');
    const values = result.steps.findIndex(
      (step) => step.op === 'createValues' && step.typeKey === 'professor_rank',
    );
    expect(link).toBeGreaterThanOrEqual(0);
    expect(values).toBeGreaterThan(link);
    expect(result.touchedMirroredTypes).toContain('professor_rank');
  });

  it('does not link a list that is already mirrored', () => {
    const existing: BlueprintExistingState = {
      ...EMPTY,
      typeKeys: new Set(['professor_rank']),
      valueKeysByType: new Map([['professor_rank', new Set(['lecturer'])]]),
      questionCodes: new Set(['academic_rank']),
      factKeys: new Set(['academic_rank']),
      mirroredTypeKeys: new Set(['professor_rank']),
    };
    expect(plan('academic_rank_table', existing).steps.some((s) => s.op === 'linkMirror')).toBe(
      false,
    );
  });

  it('widens a REUSED question to the categories the product needs, keeping the rest', () => {
    // The governorate question is seeded for mortgages only, so a personal-loan doctor is
    // never asked where they practise and the column reads nothing — the standard column
    // would price every applicant, silently. Widening ADDS: narrowing somebody else's
    // assignment because this product does not need it would break theirs.
    const existing: BlueprintExistingState = {
      ...EMPTY,
      questionCodes: new Set(['governorate', 'years_in_practice', 'existing_bank_loans']),
      categoriesByQuestion: new Map([
        ['governorate', new Set([LoanCategory.mortgage])],
        ['existing_bank_loans', new Set([LoanCategory.personal, LoanCategory.mortgage])],
      ]),
      factKeys: new Set(['years_in_practice', 'property_governorate']),
      questionCodeByFact: new Map([
        ['years_in_practice', 'years_in_practice'],
        ['property_governorate', 'governorate'],
      ]),
    };
    const result = plan('years_in_practice_bands', existing);
    const widened = result.steps.filter((step) => step.op === 'widenCategories');
    expect(
      widened.map((step) => step.op === 'widenCategories' && step.questionCode).sort(),
    ).toEqual(['existing_bank_loans', 'governorate']);
    const governorate = widened.find(
      (step) => step.op === 'widenCategories' && step.questionCode === 'governorate',
    );
    expect(
      governorate && governorate.op === 'widenCategories' && governorate.categories.sort(),
    ).toEqual(['car', 'mortgage', 'personal']);
  });

  it('widens the question behind a DERIVED axis, which has no registry row', () => {
    // A top-up column is computed from the bank the program belongs to, but the answer it is
    // computed FROM is a question — and that question is seeded for personal and mortgage
    // only, so the column is unreachable on a car loan.
    const existing: BlueprintExistingState = {
      ...EMPTY,
      questionCodes: new Set(['existing_bank_loans']),
      categoriesByQuestion: new Map([['existing_bank_loans', new Set([LoanCategory.personal])]]),
    };
    const widen = plan('years_in_practice_bands', existing).steps.find(
      (step) => step.op === 'widenCategories' && step.questionCode === 'existing_bank_loans',
    );
    expect(widen && widen.op === 'widenCategories' && widen.categories.sort()).toEqual([
      'car',
      'personal',
    ]);
  });

  it('leaves a question alone when it is already asked everywhere the product needs', () => {
    const existing: BlueprintExistingState = {
      ...EMPTY,
      questionCodes: new Set(['governorate']),
      categoriesByQuestion: new Map([
        ['governorate', new Set([LoanCategory.personal, LoanCategory.car, LoanCategory.mortgage])],
      ]),
      questionCodeByFact: new Map([['property_governorate', 'governorate']]),
    };
    const widened = plan('years_in_practice_bands', existing).steps.filter(
      (step) => step.op === 'widenCategories' && step.questionCode === 'governorate',
    );
    expect(widened).toEqual([]);
  });

  it('plans no product row when the product already exists', () => {
    const result = plan('armed_forces_grades', { ...EMPTY, productKeys: new Set(['my_product']) });
    expect(result.steps.some((step) => step.op === 'createProductRow')).toBe(false);
  });
});

describe('finishing a run that failed part-way', () => {
  it('BINDS a fact row that exists and reads nothing, instead of failing on its key', () => {
    // A fact is two writes — the row, then the binding that makes it readable — so a failure
    // between them leaves a row bound to nothing. It is also invisible to the usable
    // registry, which filters to bound facts, so a plan built on that would create a row
    // whose key is already taken and could never get past it.
    const existing: BlueprintExistingState = {
      ...EMPTY,
      typeKeys: new Set(['school_stage', 'school_type']),
      valueKeysByType: new Map([
        ['school_stage', new Set(['stage_primary', 'stage_preparatory', 'stage_secondary'])],
        ['school_type', new Set(['school_international', 'school_national'])],
      ]),
      questionCodes: new Set([
        'which_stage_do_you_teach',
        'is_the_school_international_or_national',
      ]),
      factKeys: new Set(['school_stage']),
      unboundFactKeys: new Set(['school_stage']),
    };
    const steps = plan('school_stage_ceiling', existing).steps;
    expect(steps.some((step) => step.op === 'createFact' && step.factKey === 'school_stage')).toBe(
      false,
    );
    expect(steps.find((step) => step.op === 'bindFact')).toMatchObject({
      factKey: 'school_stage',
      questionCode: 'which_stage_do_you_teach',
    });
    // And the fact that was never created at all is still created.
    expect(steps.some((step) => step.op === 'createFact' && step.factKey === 'school_type')).toBe(
      true,
    );
  });

  it('leaves a fact that is already bound completely alone', () => {
    const existing: BlueprintExistingState = {
      ...EMPTY,
      factKeys: new Set(['school_stage']),
      questionCodeByFact: new Map([['school_stage', 'which_stage_do_you_teach']]),
    };
    const steps = plan('school_stage_ceiling', existing).steps;
    expect(steps.some((step) => step.op === 'bindFact')).toBe(false);
  });
});

describe('a question that was switched off', () => {
  /**
   * A purge SOFT-deletes: `application_answer` has a RESTRICT foreign key onto the question,
   * so a product that once existed leaves its questions behind, switched off, with their
   * options and every stored answer intact. Their codes are still taken — the unique is
   * global and immutable.
   *
   * Found by hitting it against a real database: the plan reused four such questions, the
   * facts bound to them served nothing (the registry filters to facts whose question is
   * live), and the save was refused naming a FACT the operator could not see was fine.
   */
  const existing: BlueprintExistingState = {
    ...EMPTY,
    typeKeys: new Set(['school_stage', 'school_type']),
    valueKeysByType: new Map([
      ['school_stage', new Set(['stage_primary', 'stage_preparatory', 'stage_secondary'])],
      ['school_type', new Set(['school_international', 'school_national'])],
    ]),
    questionCodes: new Set(['which_stage_do_you_teach', 'is_the_school_international_or_national']),
    inactiveQuestionCodes: new Set(['which_stage_do_you_teach']),
  };

  it('is switched back on rather than duplicated under a `_2` code', () => {
    const steps = plan('school_stage_ceiling', existing).steps;
    expect(steps.find((step) => step.op === 'reactivateQuestion')).toMatchObject({
      questionCode: 'which_stage_do_you_teach',
    });
    expect(steps.some((step) => step.op === 'createQuestion')).toBe(false);
  });

  it('is left alone when it is already live', () => {
    const steps = plan('school_stage_ceiling', {
      ...existing,
      inactiveQuestionCodes: new Set(),
    }).steps;
    expect(steps.some((step) => step.op === 'reactivateQuestion')).toBe(false);
  });
});
