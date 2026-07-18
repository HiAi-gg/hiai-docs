-- Lifecycle operations deliberately outlive the Better Auth account they
-- describe. Retain only a redacted subject hash after account deletion.
CREATE EXTENSION IF NOT EXISTS pgcrypto;--> statement-breakpoint

ALTER TABLE "public"."lifecycle_operations"
  ADD COLUMN "actor_subject_hash" text;--> statement-breakpoint

UPDATE "public"."lifecycle_operations"
SET "actor_subject_hash" = encode(digest("actor_user_id"::text, 'sha256'), 'hex')
WHERE "actor_subject_hash" IS NULL;--> statement-breakpoint

ALTER TABLE "public"."lifecycle_operations"
  ALTER COLUMN "actor_subject_hash" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "public"."lifecycle_operations"
  ADD CONSTRAINT "lifecycle_operations_actor_subject_hash"
  CHECK ("actor_subject_hash" ~ '^[a-f0-9]{64}$');--> statement-breakpoint

ALTER TABLE "public"."lifecycle_operations"
  DROP CONSTRAINT IF EXISTS "lifecycle_operations_actor_user_id_fkey";--> statement-breakpoint
ALTER TABLE "public"."lifecycle_operations"
  DROP CONSTRAINT IF EXISTS "lifecycle_operations_actor_user_id_users_id_fk";--> statement-breakpoint
ALTER TABLE "public"."lifecycle_operations"
  ADD CONSTRAINT "lifecycle_operations_actor_user_id_users_id_fk"
  FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "public"."lifecycle_operations"
  ALTER COLUMN "actor_user_id" DROP NOT NULL;--> statement-breakpoint

-- Terminal records remain immutable. The only allowed update is PostgreSQL's
-- FK-driven actor nulling during Better Auth account deletion.
CREATE OR REPLACE FUNCTION "public"."prevent_terminal_lifecycle_operation_mutation"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.status IN ('completed', 'rejected')
    AND NOT (
      NEW.actor_user_id IS NULL
      AND NEW.actor_user_id IS DISTINCT FROM OLD.actor_user_id
      AND NEW.actor_subject_hash = OLD.actor_subject_hash
      AND NEW.idempotency_key = OLD.idempotency_key
      AND NEW.operation_kind = OLD.operation_kind
      AND NEW.status = OLD.status
      AND NEW.lease_owner IS NOT DISTINCT FROM OLD.lease_owner
      AND NEW.lease_expires_at IS NOT DISTINCT FROM OLD.lease_expires_at
      AND NEW.fence_token_hash IS NOT DISTINCT FROM OLD.fence_token_hash
      AND NEW.completed_steps = OLD.completed_steps
      AND NEW.terminal_result IS NOT DISTINCT FROM OLD.terminal_result
      AND NEW.safe_error_code IS NOT DISTINCT FROM OLD.safe_error_code
      AND NEW.attempt_count = OLD.attempt_count
      AND NEW.created_at = OLD.created_at
      AND NEW.updated_at = OLD.updated_at
      AND NEW.completed_at IS NOT DISTINCT FROM OLD.completed_at
    ) THEN
    RAISE EXCEPTION 'terminal lifecycle operations are immutable';
  END IF;
  RETURN NEW;
END;
$$;--> statement-breakpoint

DROP POLICY IF EXISTS "lifecycle_operations_owner" ON "public"."lifecycle_operations";--> statement-breakpoint
CREATE POLICY "lifecycle_operations_owner" ON "public"."lifecycle_operations"
  FOR ALL TO hiai_app
  USING ("actor_user_id" = NULLIF(current_setting('app.current_user_id', true), '')::uuid)
  WITH CHECK (
    "actor_user_id" = NULLIF(current_setting('app.current_user_id', true), '')::uuid
    OR "actor_user_id" IS NULL
  );
