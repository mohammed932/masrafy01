-- THE I-SCORE CLASSES BECOME THE SHARED TABLE (v30.4.0, second half).
--
-- Each `i_score_class` row gains the share of the income it counts, and the six rows ARE the
-- I-Score table every program reads when neither it nor its product states one
-- (`effectiveIScoreTiers`: program → product → platform). An edit on Manage values reaches
-- every such program at once.
--
--   300–399 Defaulted 0% · 400–520 High Risk 50% · 521–625 Unsatisfactory 80% ·
--   626–700 Satisfactory 100% · 701–750 Very Good 110% · 751–850 Excellent 120%
--
-- 0% is a stated figure, not a missing one: the class counts no income and the program offers
-- nothing (`resolveIScoreFactor`).
--
-- The COPIES `iscore_classes` wrote a few minutes earlier are removed, because a stored copy
-- would win over the shared table and freeze it out:
--   · every program table that is exactly the six classes at 100% (the seeded copy), and
--   · every product table that is exactly the six classes at 80/80/100/100/110/110, with its
--     estimate markers.
-- A table anybody typed differs from both and is left alone. Money moves on every program
-- that now reads the shared table; that is the operator's decision this migration carries.

ALTER TABLE "platform_enumeration" ADD COLUMN "incomePercent" DECIMAL(7,4);

UPDATE "platform_enumeration" AS pe
   SET "incomePercent" = v.pct, "updatedAt" = now()
  FROM (VALUES ('defaulted', 0), ('high_risk', 50), ('unsatisfactory', 80),
               ('satisfactory', 100), ('very_good', 110), ('excellent', 120)) AS v(key, pct)
 WHERE pe."type" = 'i_score_class' AND pe."key" = v.key AND pe."incomePercent" IS NULL;

DO $$
DECLARE
  neutral_table JSONB := '{"bands":[{"fromInclusive":"0","toExclusive":"400","incomeEGP":"100"},{"fromInclusive":"400","toExclusive":"521","incomeEGP":"100"},{"fromInclusive":"521","toExclusive":"626","incomeEGP":"100"},{"fromInclusive":"626","toExclusive":"701","incomeEGP":"100"},{"fromInclusive":"701","toExclusive":"751","incomeEGP":"100"},{"fromInclusive":"751","toExclusive":null,"incomeEGP":"100"}]}';
  class_table JSONB := '{"bands":[{"fromInclusive":"0","toExclusive":"400","incomeEGP":"80"},{"fromInclusive":"400","toExclusive":"521","incomeEGP":"80"},{"fromInclusive":"521","toExclusive":"626","incomeEGP":"100"},{"fromInclusive":"626","toExclusive":"701","incomeEGP":"100"},{"fromInclusive":"701","toExclusive":"751","incomeEGP":"110"},{"fromInclusive":"751","toExclusive":null,"incomeEGP":"110"}]}';
  n INTEGER;
BEGIN
  UPDATE "bank_program"
     SET "incomeAssumption" = "incomeAssumption" - 'iScoreTiers'
   WHERE "incomeAssumption" -> 'iScoreTiers' = neutral_table;
  GET DIAGNOSTICS n = ROW_COUNT;
  RAISE NOTICE 'iscore_shared_table: % seeded program table(s) removed', n;

  UPDATE "platform_enumeration"
     SET "iScoreDefaults" = NULL,
         "valueSources"   = (
           SELECT COALESCE(jsonb_object_agg(k, v), '{}'::jsonb)
             FROM jsonb_each(COALESCE("valueSources", '{}'::jsonb)) AS e(k, v)
            WHERE k NOT LIKE 'iScoreDefaults.%'
         ),
         "updatedAt" = now()
   WHERE "type" = 'surrogate_product' AND "iScoreDefaults" = class_table;
  GET DIAGNOSTICS n = ROW_COUNT;
  RAISE NOTICE 'iscore_shared_table: % seeded product table(s) removed', n;

  -- END STATE, ASSERTED.
  IF EXISTS (SELECT 1 FROM "platform_enumeration"
              WHERE "type" = 'i_score_class' AND "active" AND "incomePercent" IS NULL) THEN
    RAISE EXCEPTION 'iscore_shared_table: an active I-Score class has no income percentage';
  END IF;
  IF EXISTS (SELECT 1 FROM "bank_program" WHERE "incomeAssumption" -> 'iScoreTiers' = neutral_table)
     OR EXISTS (SELECT 1 FROM "platform_enumeration"
                 WHERE "type" = 'surrogate_product' AND "iScoreDefaults" = class_table) THEN
    RAISE EXCEPTION 'iscore_shared_table: a seeded copy still overrides the shared table';
  END IF;
END $$;
