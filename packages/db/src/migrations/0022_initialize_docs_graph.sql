-- Graph DDL must run as the migration owner (`aiuser`), never as the
-- restricted runtime role. PostgreSQL init creates the graph schema on fresh
-- volumes; this migration adds the labels/indexes and also repairs databases
-- created before GraphRAG was enabled.
LOAD 'age';--> statement-breakpoint
SET search_path = ag_catalog, public;--> statement-breakpoint

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM ag_catalog.ag_graph WHERE name = 'docs_graph') THEN
    PERFORM ag_catalog.create_graph('docs_graph');
  END IF;
END
$$;--> statement-breakpoint

DO $$
DECLARE
  label_name text;
BEGIN
  FOREACH label_name IN ARRAY ARRAY['Document', 'Person', 'Organization', 'Concept', 'Location', 'Topic']
  LOOP
    IF NOT EXISTS (
      SELECT 1
      FROM ag_catalog.ag_label l
      JOIN ag_catalog.ag_graph g ON g.graphid = l.graph
      WHERE g.name = 'docs_graph' AND l.name = label_name AND l.kind = 'v'
    ) THEN
      PERFORM ag_catalog.create_vlabel('docs_graph', label_name);
    END IF;
  END LOOP;

  FOREACH label_name IN ARRAY ARRAY['MENTIONS', 'REFERENCES', 'BELONGS_TO', 'RELATED_TO', 'AUTHORED_BY']
  LOOP
    IF NOT EXISTS (
      SELECT 1
      FROM ag_catalog.ag_label l
      JOIN ag_catalog.ag_graph g ON g.graphid = l.graph
      WHERE g.name = 'docs_graph' AND l.name = label_name AND l.kind = 'e'
    ) THEN
      PERFORM ag_catalog.create_elabel('docs_graph', label_name);
    END IF;
  END LOOP;
END
$$;--> statement-breakpoint

-- AGE stores vertex properties in a single agtype column rather than physical
-- `name`/`id` columns. GIN indexes support property-map predicates used by
-- Cypher MATCH/MERGE without referencing a non-existent SQL column.
CREATE INDEX IF NOT EXISTS idx_document_properties ON docs_graph."Document" USING gin (properties);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_person_properties ON docs_graph."Person" USING gin (properties);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_organization_properties ON docs_graph."Organization" USING gin (properties);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_concept_properties ON docs_graph."Concept" USING gin (properties);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_location_properties ON docs_graph."Location" USING gin (properties);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_topic_properties ON docs_graph."Topic" USING gin (properties);--> statement-breakpoint

GRANT USAGE ON SCHEMA docs_graph TO hiai_app;--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA docs_graph TO hiai_app;--> statement-breakpoint
GRANT USAGE, SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA docs_graph TO hiai_app;
