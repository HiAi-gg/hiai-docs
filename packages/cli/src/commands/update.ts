/**
 * `hiai-docs update <id>` — patch a document's title and/or content.
 *
 * Empty body is rejected by the backend; the CLI mirrors that
 * constraint early to avoid a wasted round trip.
 */

import type { Command } from "commander";
import { client, type HiaiDocsClient } from "../client.js";
import { formatError, green } from "../format.js";

export function registerUpdate(program: Command, _getClient: () => HiaiDocsClient) {
	program
		.command("update <id>")
		.description("Update a document's title and/or content")
		.option("--title <title>", "New title")
		.option("-c, --content <markdown>", "New content")
		.option("-f, --folder <uuid>", "Move to folder (use '' to clear)")
		.action(
			async (
				id: string,
				opts: { title?: string; content?: string; folder?: string },
			) => {
				try {
					if (
						opts.title === undefined &&
						opts.content === undefined &&
						opts.folder === undefined
					) {
						process.stderr.write(
							"At least one of --title, --content, or --folder is required.\n",
						);
						process.exitCode = 1;
						return;
					}
					const folder =
						opts.folder === undefined
							? undefined
							: opts.folder === ""
								? null
								: opts.folder;
					await client.updateDocument(id, {
						title: opts.title,
						content: opts.content,
						folderId: folder,
					});
					process.stdout.write(`${green("✓")} Updated ${id}\n`);
				} catch (err) {
					process.stderr.write(`${formatError(err)}\n`);
					process.exitCode = 1;
				}
			},
		);
}