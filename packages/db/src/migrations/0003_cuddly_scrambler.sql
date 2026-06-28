ALTER TABLE "versions" ADD COLUMN "label" text;--> statement-breakpoint
ALTER TABLE "versions" ADD COLUMN "description" text;--> statement-breakpoint
ALTER TABLE "versions" ADD COLUMN "is_snapshot" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "versions" ADD COLUMN "restored_from" uuid;--> statement-breakpoint
CREATE INDEX "versions_is_snapshot_idx" ON "versions" USING btree ("is_snapshot");