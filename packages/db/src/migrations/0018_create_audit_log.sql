CREATE TABLE audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID NOT NULL,
  action TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id UUID,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_audit_log_actor ON audit_log(actor_id);
CREATE INDEX idx_audit_log_resource ON audit_log(resource_type, resource_id);
CREATE INDEX idx_audit_log_created ON audit_log(created_at DESC);
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- Admin-read-only policy: only admin role can read audit log
DROP POLICY IF EXISTS tenant_isolation ON public.audit_log;
CREATE POLICY tenant_isolation ON public.audit_log FOR ALL
  USING (current_setting('app.current_user_role', true) = 'admin')
  WITH CHECK (current_setting('app.current_user_role', true) = 'admin');
