-- Link the live no-payslip products' ways to the ready methods they were taken from (v37.0.0).
--
-- Writes `methodKey` into each way of `templateSpec` only. The compiled `incomeRule` — what a
-- quote reads — is untouched, so no figure moves. Each link is guarded by the question the
-- way reads, so a way that was changed since is left unlinked rather than linked wrongly.

UPDATE "platform_enumeration"
SET "templateSpec" = jsonb_set("templateSpec", '{primary,methodKey}', '"military_grade"')
WHERE "type" = 'surrogate_product' AND "key" = 'armed_forces_grades' AND "templateSpec"->'primary'->>'fact' = 'military_grade';

UPDATE "platform_enumeration"
SET "templateSpec" = jsonb_set("templateSpec", '{primary,methodKey}', '"academic_rank_university"')
WHERE "type" = 'surrogate_product' AND "key" = 'academic_rank_table' AND "templateSpec"->'primary'->>'fact' = 'academic_rank';

UPDATE "platform_enumeration"
SET "templateSpec" = jsonb_set("templateSpec", '{primary,methodKey}', '"years_in_practice_city"')
WHERE "type" = 'surrogate_product' AND "key" = 'doctors_clinic_owner' AND "templateSpec"->'primary'->>'fact' = 'years_in_practice';

UPDATE "platform_enumeration"
SET "templateSpec" = jsonb_set("templateSpec", '{primary,methodKey}', '"years_in_practice"')
WHERE "type" = 'surrogate_product' AND "key" = 'doctors_in_practice' AND "templateSpec"->'primary'->>'fact' = 'years_in_practice';

UPDATE "platform_enumeration"
SET "templateSpec" = jsonb_set("templateSpec", '{primary,methodKey}', '"card_limit_share"')
WHERE "type" = 'surrogate_product' AND "key" = 'card_limit_share' AND "templateSpec"->'primary'->>'fact' = 'credit_card_limit';

UPDATE "platform_enumeration"
SET "templateSpec" = jsonb_set("templateSpec", '{primary,methodKey}', '"car_instalment_times"')
WHERE "type" = 'surrogate_product' AND "key" = 'auto_loan_crosssell' AND "templateSpec"->'primary'->>'fact' = 'car_loan_installment';

UPDATE "platform_enumeration"
SET "templateSpec" = jsonb_set("templateSpec", '{alternatives,0,methodKey}', '"car_loan_share"')
WHERE "type" = 'surrogate_product' AND "key" = 'auto_loan_crosssell' AND "templateSpec"->'alternatives'->0->>'fact' = 'auto_loan_amount';

UPDATE "platform_enumeration"
SET "templateSpec" = jsonb_set("templateSpec", '{primary,methodKey}', '"pledged_share"')
WHERE "type" = 'surrogate_product' AND "key" = 'pledged_collateral_share' AND "templateSpec"->'primary'->>'fact' = 'pledged_free_amount';

UPDATE "platform_enumeration"
SET "templateSpec" = jsonb_set("templateSpec", '{primary,methodKey}', '"compound_class"')
WHERE "type" = 'surrogate_product' AND "key" = 'compound_owner' AND "templateSpec"->'primary'->>'fact' = 'compound_name';

UPDATE "platform_enumeration"
SET "templateSpec" = jsonb_set("templateSpec", '{alternatives,0,methodKey}', '"compound_down_payment"')
WHERE "type" = 'surrogate_product' AND "key" = 'compound_owner' AND "templateSpec"->'alternatives'->0->>'fact' = 'unit_down_payment';

UPDATE "platform_enumeration"
SET "templateSpec" = jsonb_set("templateSpec", '{alternatives,1,methodKey}', '"compound_paid_share"')
WHERE "type" = 'surrogate_product' AND "key" = 'compound_owner' AND "templateSpec"->'alternatives'->1->>'fact' = 'unit_paid_to_date';

UPDATE "platform_enumeration"
SET "templateSpec" = jsonb_set("templateSpec", '{alternatives,2,methodKey}', '"unit_type"')
WHERE "type" = 'surrogate_product' AND "key" = 'compound_owner' AND "templateSpec"->'alternatives'->2->>'fact' = 'owned_unit_type';

UPDATE "platform_enumeration"
SET "templateSpec" = jsonb_set("templateSpec", '{primary,methodKey}', '"school_stage_type"')
WHERE "type" = 'surrogate_product' AND "key" = 'school_stage_ceiling' AND "templateSpec"->'primary'->>'fact' = 'school_stage';

UPDATE "platform_enumeration"
SET "templateSpec" = jsonb_set("templateSpec", '{primary,methodKey}', '"club_branch"')
WHERE "type" = 'surrogate_product' AND "key" = 'club_branch_cap' AND "templateSpec"->'primary'->>'fact' = 'club_branch';

UPDATE "platform_enumeration"
SET "templateSpec" = jsonb_set("templateSpec", '{primary,methodKey}', '"car_down_payment_divided"')
WHERE "type" = 'surrogate_product' AND "key" = 'down_payment_income' AND "templateSpec"->'primary'->>'fact' = 'car_down_payment';

UPDATE "platform_enumeration"
SET "templateSpec" = jsonb_set("templateSpec", '{alternatives,0,methodKey}', '"savings_divided"')
WHERE "type" = 'surrogate_product' AND "key" = 'down_payment_income' AND "templateSpec"->'alternatives'->0->>'fact' = 'total_savings';
