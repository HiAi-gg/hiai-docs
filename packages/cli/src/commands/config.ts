/**
 * `hiai-docs config` — save or update the CLI config file.
 *
 * Both --url and --key are optional: with neither supplied the
 * command just prints the current configuration. With either
 * supplied, only the provided keys are updated (the other is
 * preserved from the existing file or env var).
 */

import type { Command } from "commander";
import { loadConfig, saveConfig } from "../config.js";
import { dim, formatError, green } from "../format.js";

export function registerConfig(program: Command) {
	program
		.command("config")
		.description("View or update CLI configuration")
		.option("--url <url>", "API base URL")
		.option("--key <key>", "API key (Bearer token)")
		.option("--show", "Print the resolved configuration and exit")
		.action(
			async (opts: { url?: string; key?: string; show?: boolean }) => {
				try {
					const current = loadConfig();
					if (opts.show || (opts.url === undefined && opts.key === undefined)) {
						process.stdout.write(`url:  ${current.url}\n`);
						process.stdout.write(
							`key:  ${current.apiKey ? `${current.apiKey.slice(0, 4)}…(redacted)` : "(unset)"}\n`,
						);
						process.stdout.write(
							`${dim("Env vars HIAI_DOCS_URL / HIAI_DOCS_API_KEY override the file.")}\n`,
						);
						return;
					}
					const next = {
						url: opts.url ?? current.url,
						apiKey: opts.key ?? current.apiKey,
					};
					saveConfig(next);
					process.stdout.write(`${green("✓")} Configuration saved.\n`);
				} catch (err) {
					process.stderr.write(`${formatError(err)}\n`);
					process.exitCode = 1;
				}
			},
		);
}