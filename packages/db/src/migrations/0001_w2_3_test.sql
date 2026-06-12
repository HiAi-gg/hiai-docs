ALTER TABLE "documents" ADD COLUMN "search_vector" "tsvector" GENERATED ALWAYS AS (to_tsvector('english', COALESCE(title, '') || ' ' || COALESCE(content, ''))) STORED;--> statement-breakpoint
ALTER TABLE "folders" ADD CONSTRAINT "folders_parent_id_folders_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."folders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_document_embeddings_hnsw" ON "document_embeddings" USING hnsw ("embedding" vector_cosine_ops);--> statement-breakpoint
CREATE INDEX "idx_documents_search_vector" ON "documents" USING gin ("search_vector");--> statement-breakpoint
CREATE INDEX "idx_documents_title_trgm" ON "documents" USING gin ("title" gin_trgm_ops);