-- hiai-docs init.sql
-- Runs on first PostgreSQL startup via docker-entrypoint-initdb.d.
-- Schema, indexes, and FKs live in packages/db/src/schema.ts (Drizzle).

CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

GRANT ALL PRIVILEGES ON DATABASE hiai_docs TO aiuser;
GRANT ALL PRIVILEGES ON SCHEMA public TO aiuser;
