/**
 * `hiai-docs create` — create a new document.
 *
 * Optional `--content` lets you inline markdown from the CLI; if you
 * pipe a file (`cat spec.md | hiai-docs create --title "Spec"` —
 * reserved for a future stdin flag) you'd extend this command.
 */

import type { Command } from "commander";
import { client, type HiaiDocsClient } from "../client.js";
import { formatError } from "../format.js";

export function registerCreate(program: Command, _getClient: () => HiaiDocsClient) {
	program
		.command("create")
		.description("Create a new document")
		.requiredOption("--title <title>", "Document title")
		.option("-c, --content <markdown>", "Initial markdown content")
		.option("-f, --folder <uuid>", "Place in folder")
		.action(
			async (opts: { title: string; content?: string; folder?: string }) => {
				try {
					const doc = await client.createDocument({
						title: opts.title,
						content: opts.content,
						folderId: opts.folder,
					});
					process.stdout.write(`${doc.id}\n`);
				} catch (err) {
					process.stderr.write(`${formatError(err)}\n`);
					process.exitCode = 1;
				}
			},
		);
}