/**
 * `hiai-docs snapshot <id>` — create a named, immutable snapshot of
 * the document's current state.
 *
 * Snapshots are stored as `versions` rows with `isSnapshot=true`
 * (see backend/src/api/routes/versions.ts). They survive the
 * auto-prune that keeps ordinary auto-saved versions bounded.
 */

import type { Command } from "commander";
import { client, type HiaiDocsClient } from "../client.js";
import { formatError, green } from "../format.js";

export function registerSnapshot(program: Command, _getClient: () => HiaiDocsClient) {
	program
		.command("snapshot <id>")
		.description("Create a named snapshot of a document")
		.requiredOption("-n, --name <label>", "Snapshot label (1-200 chars)")
		.option("-d, --description <text>", "Snapshot description")
		.action(async (id: string, opts: { name: string; description?: string }) => {
			try {
				const snap = await client.createSnapshot(id, {
					label: opts.name,
					description: opts.description,
				});
				process.stdout.write(`${snap.id} (${snap.label})\n`);
				process.stdout.write(
					`${green("✓")} Snapshot created for ${id}\n`,
				);
			} catch (err) {
				process.stderr.write(`${formatError(err)}\n`);
				process.exitCode = 1;
			}
		});
}