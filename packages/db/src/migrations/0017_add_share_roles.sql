CREATE TYPE share_role AS ENUM ('viewer', 'commenter', 'editor');
ALTER TABLE share_links ADD COLUMN role share_role NOT NULL DEFAULT 'viewer';
