-- Admin role expansion (4 distinct roles instead of 3).
-- Maps existing rows: SUPER_ADMIN -> super_admin, ADMIN -> sales_manager, VIEWER -> analyst.
--
-- Postgres enum values cannot be renamed in-place safely. Pattern: create the
-- new enum, swap the column with a USING cast that maps old -> new, drop the
-- old enum, rename the new enum to the canonical name. Wrapped in an explicit
-- transaction so a failure mid-way leaves nothing dangling.

BEGIN;

CREATE TYPE "StaffRole_new" AS ENUM ('super_admin', 'sales_manager', 'sales_agent', 'analyst');

ALTER TABLE "staff_account"
  ALTER COLUMN "role" DROP DEFAULT,
  ALTER COLUMN "role" TYPE "StaffRole_new" USING (
    CASE "role"::text
      WHEN 'SUPER_ADMIN' THEN 'super_admin'::"StaffRole_new"
      WHEN 'ADMIN'       THEN 'sales_manager'::"StaffRole_new"
      WHEN 'VIEWER'      THEN 'analyst'::"StaffRole_new"
    END
  );

DROP TYPE "StaffRole";
ALTER TYPE "StaffRole_new" RENAME TO "StaffRole";

COMMIT;
