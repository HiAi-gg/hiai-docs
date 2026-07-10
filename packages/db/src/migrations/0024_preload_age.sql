-- Existing volumes may predate the PostgreSQL init script that configured
-- AGE's planner hook. Apply the database-level setting so every new pooled
-- connection can execute cypher() without an explicit superuser LOAD.
DO $$
BEGIN
  EXECUTE format(
    'ALTER DATABASE %I SET session_preload_libraries = %L',
    current_database(),
    'age'
  );
END
$$;
