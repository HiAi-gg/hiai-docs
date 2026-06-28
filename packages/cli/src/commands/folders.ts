/**
 * `hiai-docs folders` — render a folder tree.
 *
 * The backend exposes a flat "children of parent" listing; to render
 * the full tree we walk recursively from each root and recurse into
 * children. Output uses ASCII glyphs so it stays readable when piped
 * to files/logs without a TTY.
 *
 * Also registers `folder-create` — a separate subcommand per the
 * spec, since `folders` is a read-only listing.
 */

import type { Command } from "commander";
import { client, type HiaiDocsClient } from "../client.js";
import { formatError, green, renderFolderTree } from "../format.js";

export function registerFolders(program: Command, _getClient: () => HiaiDocsClient) {
	program
		.command("folders")
		.description("List folders (tree)")
		.option("-p, --parent <uuid>", "Show children of a specific folder")
		.action(async (opts: { parent?: string }) => {
			try {
				// The root listing returns folders with parentId IS NULL.
				// To render a tree we fetch the full set once and walk in-memory.
				// Backend doesn't have a "list all folders" endpoint — `folders`
				// is keyed by parentId — so we fetch root + recurse.
				const root = await client.listFolders({
					parentId: opts.parent === undefined ? undefined : opts.parent,
				});
				if (root.length === 0) {
					process.stdout.write("No folders.\n");
					return;
				}
				// Gather everything for tree rendering when listing from root.
				let all = root;
				if (opts.parent === undefined) {
					all = await collectAllFolders(root);
				}
				const tree = renderFolderTree(all, {
					parentId: opts.parent ?? null,
				});
				process.stdout.write(`${tree}\n`);
			} catch (err) {
				process.stderr.write(`${formatError(err)}\n`);
				process.exitCode = 1;
			}
		});

	program
		.command("folder-create")
		.description("Create a new folder")
		.requiredOption("-n, --name <name>", "Folder name (1-255 chars)")
		.option("-p, --parent <uuid>", "Parent folder id")
		.action(async (opts: { name: string; parent?: string }) => {
			try {
				const folder = await client.createFolder({
					name: opts.name,
					parentId: opts.parent,
				});
				process.stdout.write(`${folder.id}\n`);
				process.stdout.write(`${green("✓")} Created folder "${folder.name}"\n`);
			} catch (err) {
				process.stderr.write(`${formatError(err)}\n`);
				process.exitCode = 1;
			}
		});
}

async function collectAllFolders(
	initial: Awaited<ReturnType<typeof client.listFolders>>,
): Promise<Awaited<ReturnType<typeof client.listFolders>>> {
	const seen = new Map<string, (typeof initial)[number]>();
	for (const f of initial) seen.set(f.id, f);
	const queue: string[] = initial.map((f) => f.id);
	while (queue.length > 0) {
		const id = queue.shift();
		if (!id) break;
		const children = await client.listFolders({ parentId: id });
		for (const child of children) {
			if (!seen.has(child.id)) {
				seen.set(child.id, child);
				queue.push(child.id);
			}
		}
	}
	return Array.from(seen.values());
}