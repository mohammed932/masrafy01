-- The order a CATEGORY asks its questions in.
--
-- Until now there was one sequence for the whole pool (`question.displayOrder`), and every
-- category was served that sequence filtered down to what it asks. So "move the property
-- questions up for mortgage" moved them for personal and business too, because the three
-- share the rows. This column is the second axis: a question asked by three categories can
-- sit third in one and tenth in another.
--
-- ON THE JOIN ROW, and it has to be here. A26/A33 keep per-category scoping in
-- `question_loan_category` and nowhere else: a `mortgageOrder` column on `question` would be
-- a fifth one the day a fifth category arrived, and a second table keyed by
-- (question, category) would be this table with a different name.
--
-- WITHIN A STEP. The mobile app renders one step per question GROUP and sorts the questions
-- inside it, so a position only means anything among the questions of one group. Nothing
-- here enforces that — the value is a plain sort key — but the admin list that writes it is
-- grouped by step, and the serve path sorts inside each group.
--
-- BACKFILLED FROM THE POOL'S OWN ORDER, which is what makes this migration move nothing:
-- every category's served order is the pool order today, and after this it is a copy of the
-- pool order per category. The first drag is the first divergence.
--
-- NOT NULL with a default rather than nullable. A NULL would have to mean "fall back to the
-- pool", and a sort mixing resolved positions with fallbacks has no stable answer when the
-- two collide — the reader would be choosing between two orders row by row. One number per
-- row, always, and the fallback lives in the SNAPSHOT reader instead, where it answers a
-- different question: a version published before this column exists carries no per-category
-- order at all, and reads as the pool's.
ALTER TABLE "question_loan_category" ADD COLUMN "displayOrder" INTEGER NOT NULL DEFAULT 0;

UPDATE "question_loan_category" qlc
   SET "displayOrder" = q."displayOrder"
  FROM "question" q
 WHERE q."id" = qlc."questionId";

-- The read is always (category, displayOrder): one category's whole asked set, in order.
CREATE INDEX "idx_question_loan_category_order"
    ON "question_loan_category" ("category", "displayOrder");
