-- Apache AGE stores each property graph in its own PostgreSQL schema.
-- The application role needs access to the backing label tables and
-- sequences for cypher() reads, MERGE writes, and traversal queries.
-- Keep this conditional because GraphRAG is optional and docs_graph may not
-- exist in installations that leave both graph feature flags disabled.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'hiai_app')
     AND EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'docs_graph') THEN
    EXECUTE 'GRANT USAGE ON SCHEMA docs_graph TO hiai_app';
    EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA docs_graph TO hiai_app';
    EXECUTE 'GRANT USAGE, SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA docs_graph TO hiai_app';

    EXECUTE 'ALTER DEFAULT PRIVILEGES FOR ROLE aiuser IN SCHEMA docs_graph GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO hiai_app';
    EXECUTE 'ALTER DEFAULT PRIVILEGES FOR ROLE aiuser IN SCHEMA docs_graph GRANT USAGE, SELECT, UPDATE ON SEQUENCES TO hiai_app';
  END IF;
END
$$;
