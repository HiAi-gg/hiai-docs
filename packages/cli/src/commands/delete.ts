/**
 * `hiai-docs delete <id>` — soft confirmation before issuing DELETE.
 *
 * The backend has no soft-delete; this is irreversible, so we
 * prompt unless the user passes `--yes` (or `-y`). The prompt is
 * skipped automatically when stdin isn't a TTY (e.g. piping from
 * CI) so the command remains scriptable.
 */

import type { Command } from "commander";
import { isatty } from "node:tty";
import { client, type HiaiDocsClient } from "../client.js";
import { confirm, formatError, green } from "../format.js";

export function registerDelete(program: Command, _getClient: () => HiaiDocsClient) {
	program
		.command("delete <id>")
		.description("Delete a document (irreversible)")
		.option("-y, --yes", "Skip confirmation prompt")
		.action(async (id: string, opts: { yes?: boolean }) => {
			try {
				const interactive = isatty(0) && isatty(1);
				if (interactive && !opts.yes) {
					const ok = await confirm(`Delete document ${id}? This cannot be undone.`);
					if (!ok) {
						process.stdout.write("Cancelled.\n");
						return;
					}
				}
				await client.deleteDocument(id);
				process.stdout.write(`${green("✓")} Deleted ${id}\n`);
			} catch (err) {
				process.stderr.write(`${formatError(err)}\n`);
				process.exitCode = 1;
			}
		});
}