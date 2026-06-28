import { z } from "zod";
import { client } from "../client.js";
import type { Version } from "../types.js";

export const definition = {
  name: "get_version_history",
  description:
    "List the version history for a document. Optionally restrict to named snapshots.",
  inputSchema: {
    documentId: z
      .string()
      .describe("Document ID whose versions should be listed."),
    onlySnapshots: z
      .boolean()
      .optional()
      .describe(
        "When true, only return named snapshots (skip auto-saved revisions).",
      ),
  },
} as const;

export interface VersionHistoryArgs {
  documentId: string;
  onlySnapshots?: boolean;
}

export async function handler(args: VersionHistoryArgs): Promise<Version[]> {
  return (await client.getVersionHistory(
    args.documentId,
    args.onlySnapshots,
  )) as Version[];
}
