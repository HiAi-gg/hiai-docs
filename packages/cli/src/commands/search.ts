/**
 * `hiai-docs search <query>` — hybrid full-text + semantic search.
 *
 * Calls GET /api/search with optional folder/tags/limit filters and
 * prints a score-ranked table.
 */

import type { Command } from "commander";
import { client, type HiaiDocsClient } from "../client.js";
import { formatError, renderTable } from "../format.js";

export function registerSearch(program: Command, _getClient: () => HiaiDocsClient) {
	program
		.command("search <query>")
		.description("Search documents (hybrid full-text + semantic)")
		.option("-l, --limit <n>", "Max results (1-100)", (v) => Number.parseInt(v, 10))
		.option("-f, --folder <uuid>", "Restrict to a folder")
		.option("-t, --tags <list>", "Comma-separated tag names")
		.action(async (query: string, opts: { limit?: number; folder?: string; tags?: string }) => {
			try {
				const tags = opts.tags
					? opts.tags
							.split(",")
							.map((t) => t.trim())
							.filter(Boolean)
					: undefined;
				const res = await client.search({
					query,
					folder: opts.folder,
					tags,
					limit: opts.limit,
				});
				if (res.items.length === 0) {
					process.stdout.write("No matches.\n");
					return;
				}
				const table = renderTable(res.items, [
					{ header: "ID", width: 36, get: (r) => r.id },
					{ header: "TITLE", width: 40, get: (r) => r.title },
					{ header: "SCORE", width: 7, get: (r) => r.score.toFixed(3), align: "right" },
					{ header: "SNIPPET", width: 60, get: (r) => oneLineForCli(r.snippet) },
				]);
				process.stdout.write(`${table}\n`);
				process.stdout.write(`\n${res.items.length} of ${res.total} result(s)\n`);
			} catch (err) {
				process.stderr.write(`${formatError(err)}\n`);
				process.exitCode = 1;
			}
		});
}

// Local helper to avoid pulling in format.ts just for oneLine.
function oneLineForCli(value: string): string {
	const flat = value.replace(/\s+/g, " ").trim();
	return flat.length > 60 ? `${flat.slice(0, 59)}…` : flat;
}