-- The second fact named after its own question code, and the same cause as
-- `20260906120000`: `BlueprintService#factLabels` falls back to the question CODE when a
-- `bindQuestion` ask states no labels, and the state it reads carries no question text.
--
-- Worse than the first one in the Arabic bundle, where `practice_governorate` is not a bad
-- name but no name at all — a Latin slug in the middle of an Arabic list. The blueprint now
-- states both labels; this repairs the row that already exists.
--
-- Guarded the same way: it fires only while the row still holds the slug it was born with,
-- so an operator's own wording is never overwritten and a re-run is a no-op. Split from the
-- earlier migration rather than folded into it because that one has already been applied.
UPDATE "platform_enumeration"
SET "labelEn" = 'Governorate of practice',
    "labelAr" = 'محافظة مزاولة المهنة',
    "updatedAt" = now()
WHERE "type" = 'surrogate_fact'
  AND "key" = 'practice_governorate'
  AND "labelEn" = 'practice_governorate';
