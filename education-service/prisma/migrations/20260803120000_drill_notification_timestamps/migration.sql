-- AlterTable
-- Track G: at-most-once claim timestamps for the two drill emails. Nullable with no
-- default, so every existing row starts unclaimed and IF NOT EXISTS keeps the migration
-- re-runnable against a database where an earlier partial apply already added them.
ALTER TABLE "drill_assignment"
    ADD COLUMN IF NOT EXISTS "notified_assigned_at" TIMESTAMP(3),
    ADD COLUMN IF NOT EXISTS "notified_completed_at" TIMESTAMP(3);
