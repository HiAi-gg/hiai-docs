import { z } from "zod";
import { client } from "../client.js";
import type { DocumentDetail } from "../types.js";

export const definition = {
  name: "get_document",
  description:
    "Fetch a single document by ID. Returns full content, metadata, and tags.",
  inputSchema: {
    id: z.string().describe("Document ID."),
  },
} as const;

export interface GetDocumentArgs {
  id: string;
}

export async function handler(args: GetDocumentArgs): Promise<DocumentDetail> {
  return (await client.getDocument(args.id)) as DocumentDetail;
}
