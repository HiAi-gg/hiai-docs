/**
 * `hiai-docs read <id>` — fetch a single document and print its body.
 *
 * Title + metadata block first, then the raw markdown body to stdout.
 * Pipe-friendly: emitting markdown only would force callers to either
 * parse the metadata out or accept the whole blob.
 */

import type { Command } from "commander";
import { client, type HiaiDocsClient } from "../client.js";
import { dim, formatError } from "../format.js";

export function registerRead(program: Command, _getClient: () => HiaiDocsClient) {
	program
		.command("read <id>")
		.description("Read a document (title + markdown body)")
		.action(async (id: string) => {
			try {
				const doc = await client.getDocument(id);
				const tagList = (doc.tags ?? [])
					.map((t) => t.name)
					.join(", ");
				const meta = [
					`id: ${doc.id}`,
					`updated: ${doc.updatedAt}`,
					doc.folderId ? `folder: ${doc.folderId}` : null,
					tagList ? `tags: ${tagList}` : null,
				]
					.filter(Boolean)
					.join("\n");
				process.stdout.write(`# ${doc.title}\n\n${dim(meta)}\n\n`);
				process.stdout.write(`${doc.content ?? ""}\n`);
			} catch (err) {
				process.stderr.write(`${formatError(err)}\n`);
				process.exitCode = 1;
			}
		});
}