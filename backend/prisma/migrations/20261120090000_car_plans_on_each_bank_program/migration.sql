-- Car plans live on each bank program, not on the product (operator's call, 2026-11-20).
--
-- A bank program that read its product's plan tables (`plansSource = 'product'`) takes a copy
-- of them as its own, cell for cell, so every quote stays the same. The product then carries
-- no plans: what a bank charges, lends and finances by the down payment is the bank's, and is
-- edited on its own program.
--
-- The "the team guessed this" marks move with the cells: a whole grid is copied, so a cell
-- keeps its index and `planDefaults.<table>.cells.N.value` becomes the program's own path.

WITH src AS (
  SELECT bp.id, p."planDefaults" AS pd, coalesce(p."valueSources", '{}'::jsonb) AS vs
  FROM bank_program bp
  JOIN platform_enumeration n ON n.type = 'program_name' AND n.key = bp."programNameKey"
  JOIN platform_enumeration p ON p.type = 'surrogate_product' AND p.key = n."surrogateProductKey"
  WHERE bp."plansSource" = 'product' AND p."planDefaults" IS NOT NULL
),
marks AS (
  SELECT src.id,
    coalesce(jsonb_object_agg(
      CASE split_part(e.key, '.', 2)
        WHEN 'rateByFact' THEN 'pricing'
        WHEN 'maxMonthsByFact' THEN 'tenor'
        WHEN 'minMonthsByFact' THEN 'tenor'
        WHEN 'ltvCeilingByFact' THEN 'loanLimits'
        WHEN 'minAmountByFact' THEN 'loanLimits'
        WHEN 'carInsuranceRateByFact' THEN 'fees'
      END || substr(e.key, length('planDefaults') + 1),
      e.value
    ) FILTER (WHERE e.key LIKE 'planDefaults.%'), '{}'::jsonb) AS moved
  FROM src LEFT JOIN LATERAL jsonb_each(src.vs) e ON true
  GROUP BY src.id
)
UPDATE bank_program bp SET
  pricing = coalesce(bp.pricing, '{}'::jsonb)
    || CASE WHEN src.pd ? 'rateByFact' AND NOT coalesce(bp.pricing, '{}'::jsonb) ? 'rateByFact'
         THEN jsonb_build_object('rateByFact', src.pd->'rateByFact') ELSE '{}'::jsonb END,
  tenor = coalesce(bp.tenor, '{}'::jsonb)
    || CASE WHEN src.pd ? 'maxMonthsByFact' AND NOT coalesce(bp.tenor, '{}'::jsonb) ? 'maxMonthsByFact'
         THEN jsonb_build_object('maxMonthsByFact', src.pd->'maxMonthsByFact') ELSE '{}'::jsonb END
    || CASE WHEN src.pd ? 'minMonthsByFact' AND NOT coalesce(bp.tenor, '{}'::jsonb) ? 'minMonthsByFact'
         THEN jsonb_build_object('minMonthsByFact', src.pd->'minMonthsByFact') ELSE '{}'::jsonb END,
  "loanLimits" = coalesce(bp."loanLimits", '{}'::jsonb)
    || CASE WHEN src.pd ? 'ltvCeilingByFact' AND NOT coalesce(bp."loanLimits", '{}'::jsonb) ? 'ltvCeilingByFact'
         THEN jsonb_build_object('ltvCeilingByFact', src.pd->'ltvCeilingByFact') ELSE '{}'::jsonb END
    || CASE WHEN src.pd ? 'minAmountByFact' AND NOT coalesce(bp."loanLimits", '{}'::jsonb) ? 'minAmountByFact'
         THEN jsonb_build_object('minAmountByFact', src.pd->'minAmountByFact') ELSE '{}'::jsonb END,
  fees = coalesce(bp.fees, '{}'::jsonb)
    || CASE WHEN src.pd ? 'carInsuranceRateByFact' AND NOT coalesce(bp.fees, '{}'::jsonb) ? 'carInsuranceRateByFact'
         THEN jsonb_build_object('carInsuranceRateByFact', src.pd->'carInsuranceRateByFact') ELSE '{}'::jsonb END,
  "valueSources" = coalesce(bp."valueSources", '{}'::jsonb) || marks.moved,
  "plansSource" = 'own',
  version = bp.version + 1,
  "updatedAt" = now()
FROM src JOIN marks ON marks.id = src.id
WHERE bp.id = src.id;

-- The product keeps how income is worked out; the plan tables and their marks go.
UPDATE platform_enumeration SET
  "planDefaults" = NULL,
  "valueSources" = CASE WHEN "valueSources" IS NULL THEN NULL ELSE (
    SELECT coalesce(jsonb_object_agg(e.key, e.value), '{}'::jsonb)
    FROM jsonb_each("valueSources") e WHERE e.key NOT LIKE 'planDefaults.%'
  ) END,
  "updatedAt" = now()
WHERE type = 'surrogate_product' AND "planDefaults" IS NOT NULL;
