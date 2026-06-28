import { z } from "zod";
import { client } from "../client.js";
import type { ListDocumentsResponse } from "../types.js";

export const definition = {
  name: "list_documents",
  description:
    "List documents with pagination, optionally filtered by folder or tag.",
  inputSchema: {
    folderId: z
      .string()
      .optional()
      .describe("Optional folder ID to filter by."),
    tag: z.string().optional().describe("Optional tag ID to filter by."),
    page: z
      .number()
      .int()
      .positive()
      .optional()
      .describe("Page number (1-indexed, default 1)."),
    limit: z
      .number()
      .int()
      .positive()
      .max(100)
      .optional()
      .describe("Items per page (default 20, max 100)."),
  },
} as const;

export interface ListDocumentsArgs {
  folderId?: string;
  tag?: string;
  page?: number;
  limit?: number;
}

export async function handler(
  args: ListDocumentsArgs,
): Promise<ListDocumentsResponse> {
  return (await client.listDocuments(args)) as ListDocumentsResponse;
}
