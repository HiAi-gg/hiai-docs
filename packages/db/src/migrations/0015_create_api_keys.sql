CREATE TABLE api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  key_hash TEXT NOT NULL UNIQUE,
  prefix TEXT NOT NULL,
  scopes JSONB NOT NULL DEFAULT '[]'::jsonb,
  last_used_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_api_keys_owner ON api_keys(owner_id);
CREATE INDEX idx_api_keys_prefix ON api_keys(prefix);
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;

-- RLS: users can only see their own keys
DROP POLICY IF EXISTS tenant_isolation ON public.api_keys;
CREATE POLICY tenant_isolation ON public.api_keys FOR ALL
  USING (owner_id = current_setting('app.current_user_id', true)::uuid
         OR current_setting('app.current_user_role', true) = 'admin')
  WITH CHECK (owner_id = current_setting('app.current_user_id', true)::uuid
              OR current_setting('app.current_user_role', true) = 'admin');
