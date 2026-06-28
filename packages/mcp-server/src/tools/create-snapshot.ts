import { z } from "zod";
import { client } from "../client.js";
import type { Version } from "../types.js";

export const definition = {
  name: "create_snapshot",
  description:
    "Create a named snapshot (labelled version) of a document from its current content.",
  inputSchema: {
    documentId: z.string().describe("Document ID to snapshot."),
    label: z
      .string()
      .describe("Short label for the snapshot (e.g. 'v1.0-release')."),
    description: z
      .string()
      .optional()
      .describe("Optional longer description of the snapshot."),
  },
} as const;

export interface CreateSnapshotArgs {
  documentId: string;
  label: string;
  description?: string;
}

export async function handler(args: CreateSnapshotArgs): Promise<Version> {
  const { documentId, ...input } = args;
  return (await client.createSnapshot(documentId, input)) as Version;
}
