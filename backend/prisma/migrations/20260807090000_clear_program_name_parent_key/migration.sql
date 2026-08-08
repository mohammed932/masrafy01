-- A predefined program name belongs to NO loan category.
--
-- `20260802090000_drop_program_name_categories` removed the `categories[]` tag
-- list but left `parentKey` alone, because it is the registry's generic scoping
-- column (`professor_rank` → faculty, `military_grade` → branch, …). For
-- `program_name` rows it still held the single loan category stamped by
-- `20260724130000_program_name_enumeration` ('personal', 'car', 'mortgage',
-- 'business') — dead data that nothing reads, but that still says a name is
-- owned by one loan type. A catalog entry ("Doctor Loans", "New Car") is a
-- reusable NAME: it is pickable under every category, and every lending value
-- is authored per bank program (Principle II).
--
-- Clears the residue so the column agrees with the code. Other enumeration
-- types are untouched — the column keeps its generic meaning for them.
UPDATE "platform_enumeration"
SET "parentKey" = NULL,
    "updatedAt" = now()
WHERE "type" = 'program_name'
  AND "parentKey" IS NOT NULL;
