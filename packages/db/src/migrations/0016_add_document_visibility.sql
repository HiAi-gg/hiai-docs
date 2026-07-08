CREATE TYPE document_visibility AS ENUM ('private', 'shared', 'public');
ALTER TABLE documents ADD COLUMN visibility document_visibility NOT NULL DEFAULT 'private';
CREATE INDEX idx_documents_visibility ON documents(visibility);

-- Public documents are readable by all authenticated users
DROP POLICY IF EXISTS document_visibility_select ON public.documents;
CREATE POLICY document_visibility_select ON public.documents FOR SELECT
  USING (
    owner_id = current_setting('app.current_user_id', true)::uuid
    OR current_setting('app.current_user_role', true) = 'admin'
    OR visibility = 'public'
  );
