ALTER TABLE "share_links" ADD COLUMN "category_id" uuid;--> statement-breakpoint
ALTER TABLE "share_links" ADD CONSTRAINT "share_links_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "share_links" ADD CONSTRAINT "share_links_exactly_one_target_check" CHECK (num_nonnulls(document_id, folder_id, category_id) = 1);--> statement-breakpoint
CREATE INDEX "share_links_category_id_idx" ON "share_links" USING btree ("category_id");--> statement-breakpoint

-- Guest grants belong to the creator of any supported share target. The old
-- policy joined through documents only, which excluded folder shares.
DROP POLICY IF EXISTS tenant_isolation ON public.guest_access;--> statement-breakpoint
CREATE POLICY tenant_isolation ON public.guest_access FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.share_links
    WHERE public.share_links.id = public.guest_access.share_link_id
      AND (
        public.share_links.created_by = current_setting('app.current_user_id', true)::uuid
        OR current_setting('app.current_user_role', true) = 'admin'
      )
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.share_links
    WHERE public.share_links.id = public.guest_access.share_link_id
      AND (
        public.share_links.created_by = current_setting('app.current_user_id', true)::uuid
        OR current_setting('app.current_user_role', true) = 'admin'
      )
  ));
