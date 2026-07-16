CREATE TYPE "public"."lifecycle_operation_kind" AS ENUM('export', 'purge');--> statement-breakpoint
CREATE TYPE "public"."lifecycle_operation_status" AS ENUM('pending', 'running', 'retryable', 'completed', 'rejected');--> statement-breakpoint
CREATE TABLE "public"."lifecycle_operations" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "actor_user_id" uuid NOT NULL REFERENCES "public"."users"("id") ON DELETE RESTRICT,
  "idempotency_key" text NOT NULL,
  "operation_kind" "public"."lifecycle_operation_kind" NOT NULL,
  "status" "public"."lifecycle_operation_status" DEFAULT 'pending' NOT NULL,
  "lease_owner" text,
  "lease_expires_at" timestamp,
  "fence_token_hash" text,
  "completed_steps" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "terminal_result" jsonb,
  "safe_error_code" text,
  "attempt_count" integer DEFAULT 0 NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  "completed_at" timestamp,
  CONSTRAINT "lifecycle_operations_actor_idempotency_unique" UNIQUE("actor_user_id", "idempotency_key"),
  CONSTRAINT "lifecycle_operations_safe_error_code" CHECK (safe_error_code IS NULL OR safe_error_code ~ '^[a-z0-9_]{1,64}$'),
  CONSTRAINT "lifecycle_operations_terminal_immutable" CHECK (
    status NOT IN ('completed', 'rejected') OR completed_at IS NOT NULL
  )
);--> statement-breakpoint
CREATE INDEX "lifecycle_operations_status_lease_idx" ON "public"."lifecycle_operations" USING btree ("status", "lease_expires_at");--> statement-breakpoint
CREATE INDEX "lifecycle_operations_actor_idx" ON "public"."lifecycle_operations" USING btree ("actor_user_id");--> statement-breakpoint
CREATE INDEX "lifecycle_operations_retryable_idx" ON "public"."lifecycle_operations" USING btree ("status") WHERE "status" = 'retryable';--> statement-breakpoint
CREATE FUNCTION "public"."prevent_terminal_lifecycle_operation_mutation"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.status IN ('completed', 'rejected') THEN
    RAISE EXCEPTION 'terminal lifecycle operations are immutable';
  END IF;
  RETURN NEW;
END;
$$;--> statement-breakpoint
CREATE TRIGGER "lifecycle_operations_terminal_immutable_trigger"
  BEFORE UPDATE OR DELETE ON "public"."lifecycle_operations"
  FOR EACH ROW EXECUTE FUNCTION "public"."prevent_terminal_lifecycle_operation_mutation"();--> statement-breakpoint
ALTER TABLE "public"."lifecycle_operations" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "lifecycle_operations_owner" ON "public"."lifecycle_operations"
  FOR ALL TO hiai_app
  USING (actor_user_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid)
  WITH CHECK (actor_user_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid);
