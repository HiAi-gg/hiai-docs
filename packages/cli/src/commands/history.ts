/**
 * `hiai-docs history <id>` — list versions/snapshots for a document.
 *
 * Default behavior is to show everything (snapshots + auto-saved
 * versions). `--snapshots-only` narrows to named snapshots, which
 * is what most users care about.
 */

import type { Command } from "commander";
import { client, type HiaiDocsClient } from "../client.js";
import { formatError, renderTable } from "../format.js";

export function registerHistory(program: Command, _getClient: () => HiaiDocsClient) {
	program
		.command("history <id>")
		.description("List a document's version history")
		.option("-s, --snapshots-only", "Only show named snapshots")
		.action(async (id: string, opts: { snapshotsOnly?: boolean }) => {
			try {
				const rows = await client.listVersions(id, opts.snapshotsOnly);
				if (rows.length === 0) {
					process.stdout.write("No history.\n");
					return;
				}
				const table = renderTable(rows, [
					{ header: "ID", width: 36, get: (r) => r.id },
					{
						header: "TYPE",
						width: 12,
						get: (r) => (r.isSnapshot ? "snapshot" : "auto"),
					},
					{
						header: "LABEL",
						width: 30,
						get: (r) => r.label ?? "-",
					},
					{
						header: "CREATED",
						width: 22,
						get: (r) => r.createdAt,
					},
					{
						header: "RESTORED FROM",
						width: 36,
						get: (r) => r.restoredFrom ?? "-",
					},
				]);
				process.stdout.write(`${table}\n`);
				process.stdout.write(`\n${rows.length} version(s)\n`);
			} catch (err) {
				process.stderr.write(`${formatError(err)}\n`);
				process.exitCode = 1;
			}
		});
}