-- v36.4.0 — a bank program's CASES: combinations of answers that replace a figure (or refuse),
-- first match wins. NULL = none, which is every program written before them.
ALTER TABLE "bank_program" ADD COLUMN "cases" JSONB;
