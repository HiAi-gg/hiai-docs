/**
 * Config loader for the hiai-docs CLI.
 *
 * Resolution order (highest priority first):
 *   1. Environment variables (HIAI_DOCS_URL, HIAI_DOCS_API_KEY)
 *   2. JSON file at ~/.hiai-docs/config.json
 *   3. Built-in defaults
 *
 * The file config persists across invocations, so users can run
 * `hiai-docs config --url <url> --key <key>` once and reuse the
 * values. Env vars are intended for CI/ephemeral contexts where
 * writing to disk is undesirable.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export interface Config {
	url: string;
	apiKey: string;
}

const CONFIG_DIR = join(homedir(), ".hiai-docs");
const CONFIG_FILE = join(CONFIG_DIR, "config.json");
const DEFAULT_URL = "http://localhost:50700";

export function loadConfig(): Config {
	const envUrl = process.env.HIAI_DOCS_URL;
	const envKey = process.env.HIAI_DOCS_API_KEY;

	let file: Partial<Config> = {};
	if (existsSync(CONFIG_FILE)) {
		try {
			const raw = readFileSync(CONFIG_FILE, "utf-8");
			const parsed = JSON.parse(raw) as unknown;
			if (parsed && typeof parsed === "object") {
				file = parsed as Partial<Config>;
			}
		} catch {
			// Corrupted config — fall back to defaults/env. Don't throw:
			// the user should still be able to run `config` to repair it.
			file = {};
		}
	}

	return {
		url: envUrl ?? file.url ?? DEFAULT_URL,
		apiKey: envKey ?? file.apiKey ?? "",
	};
}

export function saveConfig(cfg: Config): void {
	if (!existsSync(CONFIG_DIR)) {
		mkdirSync(CONFIG_DIR, { recursive: true });
	}
	writeFileSync(CONFIG_FILE, JSON.stringify(cfg, null, 2));
}

export function configFilePath(): string {
	return CONFIG_FILE;
}