-- Generic external workspace dimension. Personal rows remain NULL and continue
-- to use owner_id; external rows receive the verified workspace from the
-- transaction-local GUC installed by @hiai-docs/db/with-tenant.
DO $$
DECLARE
  table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'folders', 'documents', 'document_pipeline_runs',
    'document_pipeline_batches', 'tags', 'categories', 'document_tags',
    'share_links', 'guest_access', 'attachments', 'versions',
    'document_embeddings', 'api_keys', 'audit_log'
  ] LOOP
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS workspace_id text', table_name);
    EXECUTE format(
      'ALTER TABLE public.%I ALTER COLUMN workspace_id SET DEFAULT NULLIF(current_setting(''app.current_workspace_id'', true), '''')',
      table_name
    );
  END LOOP;
END $$;--> statement-breakpoint

CREATE INDEX IF NOT EXISTS documents_workspace_id_idx ON public.documents (workspace_id);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS folders_workspace_id_idx ON public.folders (workspace_id);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS tags_workspace_id_idx ON public.tags (workspace_id);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS categories_workspace_id_idx ON public.categories (workspace_id);--> statement-breakpoint

-- External workspaces are opaque tenancy boundaries. A personal row is only
-- visible to its owner; a workspace row is only visible in that workspace.
DO $$
DECLARE
  table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY['folders', 'documents', 'tags', 'categories', 'document_pipeline_runs', 'api_keys'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON public.%I', table_name);
    EXECUTE format($policy$
      CREATE POLICY tenant_isolation ON public.%I FOR ALL
      USING (
        current_setting('app.current_user_role', true) = 'admin'
        OR (workspace_id IS NULL AND owner_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid)
        OR (workspace_id IS NOT NULL AND workspace_id = NULLIF(current_setting('app.current_workspace_id', true), ''))
      )
      WITH CHECK (
        current_setting('app.current_user_role', true) = 'admin'
        OR (workspace_id IS NULL AND owner_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid)
        OR (workspace_id IS NOT NULL AND workspace_id = NULLIF(current_setting('app.current_workspace_id', true), ''))
      )
    $policy$, table_name);
  END LOOP;
END $$;--> statement-breakpoint

-- Pipeline batches derive access from their parent run. The direct workspace
-- column is still persisted so queue payloads and cache keys are portable.
DROP POLICY IF EXISTS pipeline_tenant_isolation ON public.document_pipeline_runs;--> statement-breakpoint
CREATE POLICY pipeline_tenant_isolation ON public.document_pipeline_runs
  FOR ALL TO hiai_app
  USING (
    current_setting('app.current_user_role', true) = 'admin'
    OR (workspace_id IS NULL AND owner_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid)
    OR (workspace_id IS NOT NULL AND workspace_id = NULLIF(current_setting('app.current_workspace_id', true), ''))
  )
  WITH CHECK (
    current_setting('app.current_user_role', true) = 'admin'
    OR (workspace_id IS NULL AND owner_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid)
    OR (workspace_id IS NOT NULL AND workspace_id = NULLIF(current_setting('app.current_workspace_id', true), ''))
  );--> statement-breakpoint
DROP POLICY IF EXISTS pipeline_tenant_isolation ON public.document_pipeline_batches;--> statement-breakpoint
CREATE POLICY pipeline_tenant_isolation ON public.document_pipeline_batches
  FOR ALL TO hiai_app
  USING (
    current_setting('app.current_user_role', true) = 'admin'
    OR EXISTS (
      SELECT 1 FROM public.document_pipeline_runs AS pipeline_parent
      WHERE pipeline_parent.generation_id = document_pipeline_batches.generation_id
        AND pipeline_parent.document_id = document_pipeline_batches.document_id
        AND (
          (pipeline_parent.workspace_id IS NULL AND pipeline_parent.owner_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid)
          OR pipeline_parent.workspace_id = NULLIF(current_setting('app.current_workspace_id', true), '')
        )
    )
  )
  WITH CHECK (
    current_setting('app.current_user_role', true) = 'admin'
    OR workspace_id = NULLIF(current_setting('app.current_workspace_id', true), '')
  );--> statement-breakpoint

COMMENT ON COLUMN public.documents.workspace_id IS 'Opaque external workspace tenant; NULL means personal self-hosted mode';

-- Shares are not owned by the actor who later reads or mutates them. Their
-- workspace is the primary boundary; personal shares retain created_by access.
DROP POLICY IF EXISTS tenant_isolation ON public.share_links;--> statement-breakpoint
CREATE POLICY tenant_isolation ON public.share_links FOR ALL
  USING (
    current_setting('app.current_user_role', true) = 'admin'
    OR (workspace_id IS NOT NULL AND workspace_id = NULLIF(current_setting('app.current_workspace_id', true), ''))
    OR (workspace_id IS NULL AND (
      created_by = NULLIF(current_setting('app.current_user_id', true), '')::uuid
      OR EXISTS (
        SELECT 1 FROM public.documents
        WHERE public.documents.id = public.share_links.document_id
          AND public.documents.owner_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid
      )
    ))
  )
  WITH CHECK (
    current_setting('app.current_user_role', true) = 'admin'
    OR (workspace_id IS NOT NULL AND workspace_id = NULLIF(current_setting('app.current_workspace_id', true), ''))
    OR (workspace_id IS NULL AND created_by = NULLIF(current_setting('app.current_user_id', true), '')::uuid)
  );--> statement-breakpoint

DROP POLICY IF EXISTS tenant_isolation ON public.guest_access;--> statement-breakpoint
CREATE POLICY tenant_isolation ON public.guest_access FOR ALL
  USING (
    current_setting('app.current_user_role', true) = 'admin'
    OR (workspace_id IS NOT NULL AND workspace_id = NULLIF(current_setting('app.current_workspace_id', true), ''))
    OR (workspace_id IS NULL AND EXISTS (
      SELECT 1 FROM public.share_links
      WHERE public.share_links.id = public.guest_access.share_link_id
        AND public.share_links.created_by = NULLIF(current_setting('app.current_user_id', true), '')::uuid
    ))
  )
  WITH CHECK (
    current_setting('app.current_user_role', true) = 'admin'
    OR (workspace_id IS NOT NULL AND workspace_id = NULLIF(current_setting('app.current_workspace_id', true), ''))
    OR (workspace_id IS NULL AND EXISTS (
      SELECT 1 FROM public.share_links
      WHERE public.share_links.id = public.guest_access.share_link_id
        AND public.share_links.created_by = NULLIF(current_setting('app.current_user_id', true), '')::uuid
    ))
  );
