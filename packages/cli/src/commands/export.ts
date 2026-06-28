/**
 * `hiai-docs export <id>` — write a document's markdown body.
 *
 * Defaults to stdout for piping. `--output <file>` writes to a
 * file; the existing file is overwritten silently.
 */

import { existsSync, writeFileSync } from "node:fs";
import type { Command } from "commander";
import { client, type HiaiDocsClient } from "../client.js";
import { formatError, green } from "../format.js";

export function registerExport(program: Command, _getClient: () => HiaiDocsClient) {
	program
		.command("export <id>")
		.description("Export a document's markdown")
		.option("-o, --output <file>", "Write to file (default: stdout)")
		.action(async (id: string, opts: { output?: string }) => {
			try {
				const md = await client.exportDocument(id);
				if (opts.output) {
					if (existsSync(opts.output)) {
						// Confirm before clobbering — but stay scriptable.
						process.stderr.write(`Overwriting ${opts.output}\n`);
					}
					writeFileSync(opts.output, md, "utf-8");
					process.stdout.write(`${green("✓")} Wrote ${opts.output}\n`);
				} else {
					process.stdout.write(md);
				}
			} catch (err) {
				process.stderr.write(`${formatError(err)}\n`);
				process.exitCode = 1;
			}
		});
}