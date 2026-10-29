/**
 * The six car questions — the car's price, the down payment, its model year, origin, fuel type
 * and dealer.
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
  'car_price',
  'car_down_payment',
  'car_model_year',
  'car_origin',
  'car_fuel_type',
  'car_dealer',
];
