-- Feature: the surrogate income FACT registry becomes data.
--
-- Until now the facts a no-payslip rule can read were four entries in a code
-- constant (`matching/pipeline/surrogate-fact-bindings.ts`) with a typed profile
-- field and a hand-written income strategy each. Adding a fifth — a taxi licence
-- class, a clinic's patient count, whatever the next bank's table is keyed by —
-- was a release: enum member, resolver branch, admin dropdown entry, two locale
-- dictionaries. The bank's table itself was already data; only the question it is
-- keyed by was not.
--
-- A fact is now a row of `platform_enumeration` with `type = 'surrogate_fact'`,
-- and this column is the binding: WHICH question's answer is that fact.
--
-- On the enumeration, not on `question`. A33 forbids a scoring or profile-mapping
-- field on `Question`/`QuestionOption` and v6.0.0 deleted `Question.profileField`
-- for that reason. The direction here is the opposite one: the registry declares
-- what it reads, the question stays pure content and does not know it is read.
--
-- ON DELETE SET NULL, not CASCADE. A fact whose question left the pool still has
-- bank tables written against it; the operator must see it unbound (publish
-- reports `missing_or_inactive`) rather than have the fact disappear and take the
-- meaning of every one of those tables with it.

ALTER TABLE "platform_enumeration"
    ADD COLUMN "boundQuestionId" VARCHAR(30);

ALTER TABLE "platform_enumeration"
    ADD CONSTRAINT "platform_enumeration_boundQuestionId_fkey"
    FOREIGN KEY ("boundQuestionId") REFERENCES "question"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

-- The binding is read one fact at a time (the registry load) and cleared by
-- question id (the FK); both are point lookups, but a question deletion scans this
-- column, and the registry read filters on it being non-null.
CREATE INDEX "idx_platform_enumeration_bound_question"
    ON "platform_enumeration" ("boundQuestionId");

-- The four facts that were code constants become rows, bound to the same question
-- codes the constant named. `systemOnly` so the generic CRUD cannot rename or
-- delete a key an existing income rule's `strategy` token points at — the labels
-- stay editable, which is all an operator needs on these four.
--
-- Written here rather than in the seed script because the seed is optional in a
-- deployed environment while these four are load-bearing: a fact missing from the
-- registry is a bank program whose configured table stops resolving. `ON CONFLICT
-- DO NOTHING` keeps it idempotent and keeps a re-run from overwriting a label an
-- operator has since edited.
INSERT INTO "platform_enumeration"
    ("id", "type", "key", "labelAr", "labelEn", "active", "systemOnly", "sortOrder", "boundQuestionId", "createdAt", "updatedAt")
SELECT
    'sysfact_' || f.key,
    'surrogate_fact',
    f.key,
    f.label_ar,
    f.label_en,
    true,
    true,
    f.sort_order,
    q."id",
    NOW(),
    NOW()
FROM (VALUES
    ('military_grade',    'الرتبة العسكرية',      'Military grade',   0, 'military_grade'),
    ('academic_rank',     'الدرجة العلمية',       'Academic rank',    1, 'academic_rank'),
    ('years_in_practice', 'سنوات مزاولة المهنة',  'Years in practice', 2, 'years_in_practice'),
    ('credit_card_limit', 'حد البطاقات الائتمانية', 'Credit card limit', 3, 'credit_card_total_limit')
) AS f(key, label_ar, label_en, sort_order, question_code)
-- LEFT JOIN, not INNER: a fact whose question is not in this environment's pool is
-- still a fact whose bank tables must keep resolving. It lands unbound and the
-- questionnaire's publish check reports it, which is the state this column exists
-- to be able to represent.
LEFT JOIN "question" q ON q."code" = f.question_code
ON CONFLICT ("type", "key") DO NOTHING;
