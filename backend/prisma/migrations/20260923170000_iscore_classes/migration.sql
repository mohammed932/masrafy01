-- I-SCORE ON THE SIX BUREAU CLASSES (v30.4.0).
--
-- 1. `platform_enumeration` gains `rangeFrom` / `rangeTo` — the score range an
--    `i_score_class` row covers, inclusive. NULL on every other type.
-- 2. The `i_score_class` lookup and its six rows, on Manage values:
--      300–399 Defaulted · 400–520 High Risk · 521–625 Unsatisfactory ·
--      626–700 Satisfactory · 701–750 Very Good · 751–850 Excellent
-- 3. The nine products' one table (0/550/700 → 80/100/110) is redrawn on those classes at
--    80 / 80 / 100 / 100 / 110 / 110 — the operator's choice for the two edges that did not
--    line up: 521–549 goes UP from 80% to 100%, and a score of exactly 700 goes DOWN from
--    110% to 100%. Every other score keeps its factor. Estimate markers follow, one per row,
--    exactly as `seed:sheet-figures` writes them.
-- 4. Every bank programme that reads NO table — no own one, and no product behind its name
--    with one — gets its OWN, on the six classes at 100%. A 100% multiplier returns the same
--    figure (`applyIScoreFactor`), so no quote moves; what changes is that the table exists
--    to be edited. A programme under a tiered product is left alone: its own table would win
--    outright (`effectiveIScoreTiers`) and switch the product's 80% / 110% off.
--
-- The tier edges are the classes' with the ends opened (0 at the bottom, open at the top),
-- because a table must cover every score (`validateBands` coverAll): a score outside
-- 300–850 reads as the nearest class instead of killing the quote.
--
-- Idempotent: the type and rows upsert, the product rewrite is keyed on the old table, and
-- the programme write skips any programme that already states a table.

ALTER TABLE "platform_enumeration" ADD COLUMN "rangeFrom" INTEGER;
ALTER TABLE "platform_enumeration" ADD COLUMN "rangeTo" INTEGER;

INSERT INTO "enumeration_type_def"
  ("id","key","labelAr","labelEn","descriptionAr","descriptionEn","icon",
   "deletable","onValuesRail","systemOnly","active","sortOrder","createdAt","updatedAt")
VALUES
  ('cliscoreclassdef000000000001','i_score_class','تصنيف I-Score','I-Score classes',
   'تصنيفات الجهاز المصرفي لدرجة I-Score ونطاق كل تصنيف',
   'The credit bureau''s I-Score classes and the score range each one covers',
   'safety', false, true, false, true, 75, now(), now())
ON CONFLICT ("key") DO UPDATE
   SET "labelAr"       = EXCLUDED."labelAr",
       "labelEn"       = EXCLUDED."labelEn",
       "descriptionAr" = EXCLUDED."descriptionAr",
       "descriptionEn" = EXCLUDED."descriptionEn",
       "updatedAt"     = now();

INSERT INTO "platform_enumeration"
  ("id","type","key","labelAr","labelEn","active","systemOnly","sortOrder","rangeFrom","rangeTo","createdAt","updatedAt")
VALUES
  ('cliscoreclass0000000defaulted','i_score_class','defaulted',      'متعثر',        'Defaulted',      true,false,1,300,399,now(),now()),
  ('cliscoreclass0000000highrisk2','i_score_class','high_risk',      'مخاطر مرتفعة', 'High Risk',      true,false,2,400,520,now(),now()),
  ('cliscoreclass000unsatisfactor','i_score_class','unsatisfactory', 'غير مرضي',     'Unsatisfactory', true,false,3,521,625,now(),now()),
  ('cliscoreclass0000satisfactory','i_score_class','satisfactory',   'مرضي',         'Satisfactory',   true,false,4,626,700,now(),now()),
  ('cliscoreclass00000verygood005','i_score_class','very_good',      'جيد جدًا',      'Very Good',      true,false,5,701,750,now(),now()),
  ('cliscoreclass0000excellent006','i_score_class','excellent',      'ممتاز',        'Excellent',      true,false,6,751,850,now(),now())
ON CONFLICT ("type","key") DO UPDATE
   SET "labelAr"   = EXCLUDED."labelAr",
       "labelEn"   = EXCLUDED."labelEn",
       "sortOrder" = EXCLUDED."sortOrder",
       "rangeFrom" = EXCLUDED."rangeFrom",
       "rangeTo"   = EXCLUDED."rangeTo",
       "updatedAt" = now();

DO $$
DECLARE
  old_table JSONB := '{"bands":[{"fromInclusive":"0","toExclusive":"550","incomeEGP":"80"},{"fromInclusive":"550","toExclusive":"700","incomeEGP":"100"},{"fromInclusive":"700","toExclusive":null,"incomeEGP":"110"}]}';
  class_table JSONB := '{"bands":[{"fromInclusive":"0","toExclusive":"400","incomeEGP":"80"},{"fromInclusive":"400","toExclusive":"521","incomeEGP":"80"},{"fromInclusive":"521","toExclusive":"626","incomeEGP":"100"},{"fromInclusive":"626","toExclusive":"701","incomeEGP":"100"},{"fromInclusive":"701","toExclusive":"751","incomeEGP":"110"},{"fromInclusive":"751","toExclusive":null,"incomeEGP":"110"}]}';
  neutral_table JSONB := '{"bands":[{"fromInclusive":"0","toExclusive":"400","incomeEGP":"100"},{"fromInclusive":"400","toExclusive":"521","incomeEGP":"100"},{"fromInclusive":"521","toExclusive":"626","incomeEGP":"100"},{"fromInclusive":"626","toExclusive":"701","incomeEGP":"100"},{"fromInclusive":"701","toExclusive":"751","incomeEGP":"100"},{"fromInclusive":"751","toExclusive":null,"incomeEGP":"100"}]}';
  markers JSONB := '{"iScoreDefaults.bands.0.incomeEGP":"team_estimated","iScoreDefaults.bands.1.incomeEGP":"team_estimated","iScoreDefaults.bands.2.incomeEGP":"team_estimated","iScoreDefaults.bands.3.incomeEGP":"team_estimated","iScoreDefaults.bands.4.incomeEGP":"team_estimated","iScoreDefaults.bands.5.incomeEGP":"team_estimated"}';
  n INTEGER;
BEGIN
  -- 3 ── the products. Keyed on the OLD table: a product an operator already redrew is theirs.
  UPDATE "platform_enumeration"
     SET "iScoreDefaults" = class_table,
         "valueSources"   = COALESCE("valueSources", '{}'::jsonb) || markers,
         "updatedAt"      = now()
   WHERE "type" = 'surrogate_product'
     AND "iScoreDefaults" = old_table;
  GET DIAGNOSTICS n = ROW_COUNT;
  RAISE NOTICE 'iscore_classes: % product table(s) redrawn on the six classes', n;

  -- 4 ── every programme that reads no table gets its own, at 100%.
  UPDATE "bank_program" bp
     SET "incomeAssumption" = COALESCE(bp."incomeAssumption", '{}'::jsonb)
                              || jsonb_build_object('iScoreTiers', neutral_table)
   WHERE COALESCE(jsonb_array_length(bp."incomeAssumption" -> 'iScoreTiers' -> 'bands'), 0) = 0
     AND NOT EXISTS (
       SELECT 1
         FROM "platform_enumeration" nm
         JOIN "platform_enumeration" pr
           ON pr."type" = 'surrogate_product' AND pr."key" = nm."surrogateProductKey"
        WHERE nm."type" = 'program_name'
          AND nm."key" = bp."programNameKey"
          AND COALESCE(jsonb_array_length(pr."iScoreDefaults" -> 'bands'), 0) > 0
     );
  GET DIAGNOSTICS n = ROW_COUNT;
  RAISE NOTICE 'iscore_classes: % programme(s) given their own 100%% table', n;

  -- END STATE, ASSERTED: every programme now reads a table, own or its product's.
  SELECT count(*) INTO n
    FROM "bank_program" bp
   WHERE COALESCE(jsonb_array_length(bp."incomeAssumption" -> 'iScoreTiers' -> 'bands'), 0) = 0
     AND NOT EXISTS (
       SELECT 1
         FROM "platform_enumeration" nm
         JOIN "platform_enumeration" pr
           ON pr."type" = 'surrogate_product' AND pr."key" = nm."surrogateProductKey"
        WHERE nm."type" = 'program_name'
          AND nm."key" = bp."programNameKey"
          AND COALESCE(jsonb_array_length(pr."iScoreDefaults" -> 'bands'), 0) > 0
     );
  IF n > 0 THEN
    RAISE EXCEPTION 'iscore_classes: % programme(s) still read no I-Score table', n;
  END IF;
  IF EXISTS (SELECT 1 FROM "platform_enumeration"
              WHERE "type" = 'surrogate_product' AND "iScoreDefaults" = old_table) THEN
    RAISE EXCEPTION 'iscore_classes: a product still holds the 0/550/700 table';
  END IF;
END $$;
