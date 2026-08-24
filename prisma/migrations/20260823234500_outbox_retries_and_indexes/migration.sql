-- Categories are seeded reference data with no delete path; a soft-delete column
-- combined with an unconditional unique slug would permanently burn a removed slug.
ALTER TABLE "categories" DROP COLUMN "deleted_at";

-- Outbox dispatch needs to survive a permanently failing event instead of
-- re-picking it ahead of every newer one forever.
ALTER TABLE "outbox_events" ADD COLUMN "attempts" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "outbox_events" ADD COLUMN "last_error" TEXT;
ALTER TABLE "outbox_events" ADD COLUMN "failed_at" TIMESTAMPTZ(3);

DROP INDEX IF EXISTS "outbox_events_processed_at_idx";
CREATE INDEX "outbox_events_dispatch_idx"
  ON "outbox_events" ("processed_at", "failed_at", "created_at");

-- The list query filters deleted_at is null and orders by updated_at desc.
DROP INDEX IF EXISTS "announcements_updated_at_idx";
CREATE INDEX "announcements_deleted_at_updated_at_idx"
  ON "announcements" ("deleted_at", "updated_at");
