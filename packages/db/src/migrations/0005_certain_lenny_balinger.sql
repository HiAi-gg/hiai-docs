ALTER TABLE "categories" ADD COLUMN "order" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "folders" ADD COLUMN "order" integer DEFAULT 0 NOT NULL;