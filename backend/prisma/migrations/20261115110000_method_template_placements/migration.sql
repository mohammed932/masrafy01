-- A ready method's own groups carry their members (v37.0.0): which answer sits in which group.
ALTER TABLE "method_template" ADD COLUMN "placements" JSONB NOT NULL DEFAULT '{}';
