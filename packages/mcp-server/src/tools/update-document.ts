import { z } from "zod";
import { client } from "../client.js";
import type { DocumentDetail } from "../types.js";

export const definition = {
  name: "update_document",
  description:
    "Update an existing document's title and/or content. The server creates a new version on each update.",
  inputSchema: {
    id: z.string().describe("Document ID to update."),
    title: z.string().optional().describe("New title for the document."),
    content: z
      .string()
      .optional()
      .describe("New markdown content for the document."),
  },
} as const;

export interface UpdateDocumentArgs {
  id: string;
  title?: string;
  content?: string;
}

export async function handler(
  args: UpdateDocumentArgs,
): Promise<DocumentDetail> {
  const { id, ...patch } = args;
  return (await client.updateDocument(id, patch)) as DocumentDetail;
}
