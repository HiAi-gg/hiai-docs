ALTER TABLE "categories"
  ADD COLUMN IF NOT EXISTS "api_mode" text DEFAULT 'unavailable' NOT NULL,
  ADD COLUMN IF NOT EXISTS "api_permission_read" boolean DEFAULT false NOT NULL,
  ADD COLUMN IF NOT EXISTS "api_permission_edit" boolean DEFAULT false NOT NULL,
  ADD COLUMN IF NOT EXISTS "api_permission_write" boolean DEFAULT false NOT NULL;

CREATE INDEX IF NOT EXISTS "categories_api_mode_idx" ON "categories" USING btree ("api_mode");
