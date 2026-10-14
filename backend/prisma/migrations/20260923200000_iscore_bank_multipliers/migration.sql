-- THE SHARED I-SCORE TABLE TAKES THE BANK MULTIPLIERS (v30.4.0, third step).
--
-- The operator's table:
--     N/A          85%   (no score given — the optional question left blank)
--     below 521    60%
--     521 – 625    90%
--     above 625   100%
--
-- On the six bureau classes:
--     Defaulted 300–399 60% · High Risk 400–520 60% · Unsatisfactory 521–625 90% ·
--     Satisfactory 626–700 100% · Very Good 701–750 100% · Excellent 751–850 100%
-- and a SEVENTH class with no range, "No I-Score", at 85%: the table's no-score figure
-- (`platformIScoreTiers` → `noScorePercent`, read by `resolveIScoreFactor`).
--
-- Replaces the 0/50/80/100/110/120 set earlier today. Money moves on every program that
-- reads the shared table: no score is 85% where it was 100%, 300–520 is 60%, 521–625 is 90%,
-- and 701+ is 100% where it was 110% / 120%.

UPDATE "platform_enumeration" AS pe
   SET "incomePercent" = v.pct, "updatedAt" = now()
  FROM (VALUES ('defaulted', 60), ('high_risk', 60), ('unsatisfactory', 90),
               ('satisfactory', 100), ('very_good', 100), ('excellent', 100)) AS v(key, pct)
 WHERE pe."type" = 'i_score_class' AND pe."key" = v.key;

INSERT INTO "platform_enumeration"
  ("id","type","key","labelAr","labelEn","active","systemOnly","sortOrder","rangeFrom","rangeTo","incomePercent","createdAt","updatedAt")
VALUES
  ('cliscoreclass00000noscore0000','i_score_class','no_score','لا يوجد تقييم','No I-Score',true,false,0,NULL,NULL,85,now(),now())
ON CONFLICT ("type","key") DO UPDATE
   SET "incomePercent" = EXCLUDED."incomePercent",
       "rangeFrom"     = NULL,
       "rangeTo"       = NULL,
       "updatedAt"     = now();

DO $$
BEGIN
  IF (SELECT count(*) FROM "platform_enumeration"
       WHERE "type" = 'i_score_class' AND "active" AND "rangeFrom" IS NULL AND "rangeTo" IS NULL) <> 1 THEN
    RAISE EXCEPTION 'iscore_bank_multipliers: expected exactly one I-Score class with no range';
  END IF;
  IF EXISTS (SELECT 1 FROM "platform_enumeration"
              WHERE "type" = 'i_score_class' AND "active" AND "incomePercent" IS NULL) THEN
    RAISE EXCEPTION 'iscore_bank_multipliers: an active I-Score class has no income percentage';
  END IF;
END $$;
