/**
 * `hiai-docs list` — paginated document listing.
 *
 * Calls GET /api/documents with optional folder/tag filters and prints
 * a table with title, updated timestamp, and folder id.
 */

import type { Command } from "commander";
import { client, type HiaiDocsClient } from "../client.js";
import { formatError, renderTable } from "../format.js";

export function registerList(program: Command, _getClient: () => HiaiDocsClient) {
	program
		.command("list")
		.description("List documents (paginated)")
		.option("-f, --folder <uuid>", "Filter by folder id")
		.option("-t, --tag <uuid>", "Filter by tag id")
		.option("-p, --page <n>", "Page number", (v) => Number.parseInt(v, 10))
		.option("-l, --limit <n>", "Items per page (1-100)", (v) => Number.parseInt(v, 10))
		.action(
			async (opts: { folder?: string; tag?: string; page?: number; limit?: number }) => {
				try {
					const res = await client.listDocuments({
						folderId: opts.folder,
						tag: opts.tag,
						page: opts.page,
						limit: opts.limit,
					});
					if (res.items.length === 0) {
						process.stdout.write("No documents.\n");
						return;
					}
					const table = renderTable(res.items, [
						{ header: "ID", width: 36, get: (r) => r.id },
						{ header: "TITLE", width: 50, get: (r) => r.title },
						{ header: "UPDATED", width: 22, get: (r) => formatDate(r.updatedAt) },
						{ header: "FOLDER", width: 36, get: (r) => r.folderId ?? "-" },
					]);
					process.stdout.write(`${table}\n`);
					process.stdout.write(
						`\nPage ${res.page} — ${res.items.length} of ${res.total} document(s)\n`,
					);
				} catch (err) {
					process.stderr.write(`${formatError(err)}\n`);
					process.exitCode = 1;
				}
			},
		);
}

function formatDate(iso: string): string {
	const d = new Date(iso);
	if (Number.isNaN(d.getTime())) return iso;
	// YYYY-MM-DD HH:MM — short, sortable, no locale surprises.
	const yyyy = d.getUTCFullYear();
	const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
	const dd = String(d.getUTCDate()).padStart(2, "0");
	const hh = String(d.getUTCHours()).padStart(2, "0");
	const mi = String(d.getUTCMinutes()).padStart(2, "0");
	return `${yyyy}-${mm}-${dd} ${hh}:${mi}`;
}