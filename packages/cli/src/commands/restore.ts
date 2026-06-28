/**
 * `hiai-docs restore <id> --version <vid>` — restore a prior version.
 *
 * The backend saves an auto-backup of the current content before
 * overwriting, so this command is always reversible. The CLI doesn't
 * add a confirmation prompt: the server-side auto-backup is the
 * safety net.
 */

import type { Command } from "commander";
import { client, type HiaiDocsClient } from "../client.js";
import { formatError, green } from "../format.js";

export function registerRestore(program: Command, _getClient: () => HiaiDocsClient) {
	program
		.command("restore <id>")
		.description("Restore a prior version (auto-backup is taken first)")
		.requiredOption("-v, --version <vid>", "Version id to restore")
		.action(async (id: string, opts: { version: string }) => {
			try {
				await client.restoreVersion(id, opts.version);
				process.stdout.write(
					`${green("✓")} Restored ${id} to version ${opts.version}\n`,
				);
			} catch (err) {
				process.stderr.write(`${formatError(err)}\n`);
				process.exitCode = 1;
			}
		});
}