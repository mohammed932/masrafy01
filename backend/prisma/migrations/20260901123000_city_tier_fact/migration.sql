-- The governorate, as a fact a bank's table can be keyed by.
--
-- The list is filed under `city_tier` (previous migration) and the question already exists and
-- is already answered ("Which governorate is the place in?", SINGLE_SELECT, options mirrored
-- from the registry). What was missing is the REGISTRY ROW that lets a rule name it: without
-- one, `validateProductRule` refuses `factParentTable` on it and the method picker does not
-- offer it.
--
-- Bound to that question by id, resolved here rather than hardcoded: the question is created
-- by `seed-questionnaire.ts` with a generated cuid, so a literal would be wrong on every
-- database but the one it was copied from.
--
-- `systemOnly` like the other platform facts (`military_grade`, `i_score`): the applicant's
-- governorate is a property of the APPLICANT, not of one product, so it is not deletable from
-- a product screen and carries no `surrogateProductKey`.
--
-- Idempotent, and a missing question is a NOTICE rather than a failure: a database that has
-- not run `seed:questionnaire` yet gets the fact the next time this is re-run by hand, and
-- blocking a deploy over a seed-created row would strand everything behind it.

BEGIN;

DO $$
DECLARE
  qid text;
BEGIN
  SELECT "id" INTO qid FROM "question"
   WHERE "code" = 'governorate' AND "isActive"
   LIMIT 1;

  IF qid IS NULL THEN
    RAISE NOTICE 'city tier fact: no governorate question yet -- run seed:questionnaire, then re-apply';
    RETURN;
  END IF;

  INSERT INTO "platform_enumeration"
    ("id","type","key","labelAr","labelEn","active","systemOnly","sortOrder","boundQuestionId","createdAt","updatedAt")
  VALUES
    ('clcitytierfact00000000000001','surrogate_fact','property_governorate',
     'المحافظة','Governorate', true, true, 60, qid, now(), now())
  ON CONFLICT ("type","key") DO UPDATE
     SET "boundQuestionId" = EXCLUDED."boundQuestionId",
         "labelAr"         = EXCLUDED."labelAr",
         "labelEn"         = EXCLUDED."labelEn",
         "active"          = true,
         "updatedAt"       = now();
END $$;

COMMIT;
