ALTER TABLE document_embeddings ADD COLUMN char_start INTEGER NOT NULL DEFAULT 0;
ALTER TABLE document_embeddings ADD COLUMN char_end INTEGER NOT NULL DEFAULT 0;
COMMENT ON COLUMN document_embeddings.char_start IS 'Character offset of chunk start in the source document text';
COMMENT ON COLUMN document_embeddings.char_end IS 'Character offset of chunk end in the source document text';
