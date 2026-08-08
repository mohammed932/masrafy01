-- Feature: per-catalog-name question TEMPLATE.
--
-- A predefined program name ("New Car", "Working Capital") gains a suggested set
-- of questions to score on — the archetype's house opinion about what matters
-- for that product. It pre-ticks step 1 of the per-bank-program scoring wizard,
-- where the admin then assigns the weights: the archetype says WHICH questions,
-- each bank says HOW MUCH.
--
-- NOTHING READS THIS AT RUNTIME. `scoring_weight_set.weights.questionWeights`
-- stays the sole authority on what a bank program scores, and `saveWeights` does
-- not consult this table. Wiring it into save validation would make a catalog
-- edit retroactively invalidate weight sets banks already saved — the one
-- outcome this feature must make impossible.
--
-- No weights stored here, deliberately: two banks offering the same archetype
-- price it differently, which is the entire marketplace, so a shared weight
-- would be a value with no owner.
--
-- Keyed by `questionId` rather than `code` so the admin board can distinguish
-- "the question left the pool" (row cascaded away) from "the question is out of
-- scope for this name" (row still present, flagged). Those have different fixes.
--
-- SEEDED EMPTY, deliberately. Deriving a default from existing
-- `scoring_weight_set` rows was considered and rejected: it would invert the
-- direction of authority (whichever admin saved first becomes the archetype's
-- invisible author), the source rows are dev seed fixtures, the "most common"
-- key set would be a mode over one-to-six samples, and it would promote today's
-- configuration drift into a permanent default. An empty template means the
-- wizard seeds nothing and behaviour is byte-identical to before this migration
-- until an operator configures a name; the board offers a one-click
-- "tick everything asked here" so the all-in-scope default is still one gesture,
-- but an attributed and audited one.

CREATE TABLE "platform_enumeration_question" (
    "enumerationId" VARCHAR(30) NOT NULL,
    "questionId" VARCHAR(30) NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pk_platform_enumeration_question" PRIMARY KEY ("enumerationId","questionId")
);

-- The composite PK already covers lookups by `enumerationId` (leading column);
-- this covers the reverse — "which names suggest this question", which the
-- questionnaire side needs to warn before a question is retired.
CREATE INDEX "idx_platform_enumeration_question_question"
    ON "platform_enumeration_question"("questionId");

ALTER TABLE "platform_enumeration_question"
    ADD CONSTRAINT "platform_enumeration_question_enumerationId_fkey"
    FOREIGN KEY ("enumerationId") REFERENCES "platform_enumeration"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "platform_enumeration_question"
    ADD CONSTRAINT "platform_enumeration_question_questionId_fkey"
    FOREIGN KEY ("questionId") REFERENCES "question"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
