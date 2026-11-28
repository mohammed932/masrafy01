/**
 * The six car questions — the car's category and brand, its fuel, price, down payment and model
 * year (v37.0.0; origin and dealer retired).
 *
 * FIXED until v32.0.0, when a question stopped carrying loan types and "fixed" came to mean
 * every program of every loan type. They became TICKS instead (`program_name_question_addition`)
 * on every program name offered under car — migration `20261029100000_program_question_order`
 * on an existing database, `seed-program-catalog.ts` on a fresh one — and the admin owns them
 * like any other question: `seed-questionnaire.ts` inserts each once and never rewrites it.
 *
 * One list for both seeds. The migration states the same six codes in SQL; a seventh car
 * question is the admin's to add to car programs on the Program catalog, not a code change.
 */
export const CAR_QUESTION_CODES: readonly string[] = [
  'car_category',
  'what_brand_is_the_car',
  'car_fuel_type',
  'car_price',
  'car_down_payment',
  'car_model_year',
];

/**
 * The car questions ONE car name ticks (v37.0.0): the customer picks New or Used first, and each
 * is its own flow — gas or electric is asked on a new car only, the model year on a used car
 * only. Every other car name ticks all six. Used by both seeds for a name newly offered under
 * car; migration `20261128100000_car_flow_questions` made the same change on a live database.
 */
export function carQuestionCodesFor(nameKey: string): readonly string[] {
  if (nameKey === 'new_car') return CAR_QUESTION_CODES.filter((c) => c !== 'car_model_year');
  if (nameKey === 'used_car') return CAR_QUESTION_CODES.filter((c) => c !== 'car_fuel_type');
  return CAR_QUESTION_CODES;
}
