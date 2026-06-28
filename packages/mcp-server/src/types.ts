/**
 * Shared TypeScript types for hiai-docs REST API responses.
 * Keep these minimal — only the fields consumed by MCP tools.
 */

export interface Tag {
  id: string;
  name: string;
  color: string | null;
}

export interface DocumentSummary {
  id: string;
  title: string;
  content?: string;
  folderId: string | null;
  createdAt: string;
  updatedAt: string;
  tags?: Tag[];
}

export interface DocumentDetail {
  id: string;
  ownerId: string;
  folderId: string | null;
  folderName?: string | null;
  title: string;
  content: string;
  contentJson?: unknown;
  createdAt: string;
  updatedAt: string;
  tags?: Tag[];
}

export interface SearchResultItem {
  id: string;
  title: string;
  snippet: string;
  score: number;
  folder_id: string | null;
  folder_name: string | null;
  created_at: string;
  updated_at: string;
  tags?: Tag[];
}

export interface SearchResponse {
  items: SearchResultItem[];
  total: number;
  page: number;
  limit: number;
}

export interface ListDocumentsResponse {
  items: DocumentSummary[];
  total: number;
  page: number;
  limit: number;
}

export interface Folder {
  id: string;
  name: string;
  parentId: string | null;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
}

export interface Version {
  id: string;
  documentId: string;
  content: string;
  contentJson?: unknown;
  createdBy: string;
  createdAt: string;
}

export interface ExportResponse {
  markdown: string;
  filename?: string;
}

export interface CreateDocumentInput {
  title: string;
  content?: string;
  folderId?: string;
}

export interface UpdateDocumentInput {
  title?: string;
  content?: string;
}

export interface CreateSnapshotInput {
  label: string;
  description?: string;
}

export interface CreateFolderInput {
  name: string;
  parentId?: string;
}

export interface SearchInput {
  query: string;
  folder?: string;
  tags?: string[];
  limit?: number;
}

export interface ListDocumentsInput {
  folderId?: string;
  tag?: string;
  page?: number;
  limit?: number;
}

export interface ListFoldersInput {
  parentId?: string;
}

export interface VersionHistoryInput {
  documentId: string;
  onlySnapshots?: boolean;
}
