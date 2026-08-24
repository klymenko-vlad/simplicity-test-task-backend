-- Case-insensitive substring search over title/content is `ILIKE '%term%'`, which
-- only a trigram index can serve; a btree index cannot.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS "announcements_title_trgm_idx"
  ON "announcements" USING GIN ("title" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "announcements_content_trgm_idx"
  ON "announcements" USING GIN ("content" gin_trgm_ops);
