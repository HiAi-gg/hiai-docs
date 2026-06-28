/**
 * Output formatting helpers.
 *
 * Goals:
 * - Clean, scannable tables for human use
 * - Pipe-friendly: ANSI codes disabled when stdout is not a TTY
 * - No third-party chalk/table dependencies — keep the runtime small
 */

import { isatty } from "node:tty";

const useColor = isatty(1);

function wrap(open: string, close: string): (s: string) => string {
	if (!useColor) return (s) => s;
	return (s) => `${open}${s}${close}`;
}

export const dim = wrap("\x1b[2m", "\x1b[22m");
export const bold = wrap("\x1b[1m", "\x1b[22m");
export const red = wrap("\x1b[31m", "\x1b[39m");
export const green = wrap("\x1b[32m", "\x1b[39m");
export const yellow = wrap("\x1b[33m", "\x1b[39m");
export const cyan = wrap("\x1b[36m", "\x1b[39m");

/**
 * Truncate a string to `max` characters with an ellipsis suffix.
 * Used to keep wide table cells from wrapping in terminals.
 */
export function truncate(value: string, max: number): string {
	if (max <= 0) return "";
	if (value.length <= max) return value;
	if (max <= 1) return value.slice(0, max);
	return `${value.slice(0, max - 1)}…`;
}

/**
 * Strip trailing whitespace and collapse internal newlines into single
 * spaces — keeps snippet-style cells to one row in a table.
 */
export function oneLine(value: string, max = 200): string {
	const flat = value.replace(/\s+/g, " ").trim();
	return truncate(flat, max);
}

interface Column<T> {
	header: string;
	width: number;
	get: (row: T) => string;
	align?: "left" | "right";
}

function pad(s: string, width: number, align: "left" | "right" = "left"): string {
	// Account for visible width — assumes no double-width chars for now.
	const visible = s.length;
	if (visible >= width) return s;
	const filler = " ".repeat(width - visible);
	return align === "right" ? `${filler}${s}` : `${s}${filler}`;
}

/**
 * Render an array of rows as an ASCII table. Returns "" for an empty input.
 */
export function renderTable<T>(
	rows: T[],
	columns: Array<Column<T>>,
): string {
	if (rows.length === 0) return "";
	const headerLine = columns
		.map((c) => bold(pad(c.header, c.width, c.align ?? "left")))
		.join("  ");
	const sepLine = columns.map((c) => dim("-".repeat(c.width))).join("  ");
	const body = rows.map((row) =>
		columns
			.map((c) => {
				const raw = c.get(row) ?? "";
				// Truncate *before* padding so columns stay aligned.
				const truncated = truncate(raw, c.width);
				return pad(truncated, c.width, c.align ?? "left");
			})
			.join("  "),
	);
	return [headerLine, sepLine, ...body].join("\n");
}

/**
 * Render a tree of folders given a flat parent → children mapping.
 * Each level is indented by `depth * 2` spaces. Root entries use the
 * tree glyph "▸"; deeper entries use "└─".
 */
export function renderFolderTree(
	folders: Array<{ id: string; name: string; parentId?: string | null }>,
	options: { parentId?: string | null; depth?: number } = {},
): string {
	const depth = options.depth ?? 0;
	const indent = "  ".repeat(depth);
	const childIndent = "  ".repeat(depth + 1);
	const matches = folders.filter((f) => {
		if (options.parentId === undefined) {
			return f.parentId === null || f.parentId === undefined;
		}
		if (options.parentId === null) {
			return f.parentId === null || f.parentId === undefined;
		}
		return f.parentId === options.parentId;
	});
	if (matches.length === 0) return "";
	const lines: string[] = [];
	for (const folder of matches) {
		const prefix = depth === 0 ? "▸" : "└─";
		lines.push(`${indent}${prefix} ${bold(folder.name)} ${dim(`(${folder.id})`)}`);
		const sub = renderFolderTree(folders, {
			parentId: folder.id,
			depth: depth + 1,
		});
		if (sub) lines.push(sub);
	}
	// The childIndent is only meaningful for readability of the produced
	// string — callers may chain it. Keeping it defined avoids an unused
	// warning under noUnusedLocals if we ever enable it.
	void childIndent;
	return lines.join("\n");
}

/**
 * Confirmation prompt using readline. Returns true only when the user
 * explicitly types y/yes. Any other input (including empty) returns false.
 *
 * Pass `--yes`/`-y` in the command to bypass the prompt programmatically.
 */
export async function confirm(message: string): Promise<boolean> {
	const { createInterface } = await import("node:readline/promises");
	const { stdin, stdout } = await import("node:process");
	const rl = createInterface({ input: stdin, output: stdout });
	try {
		const answer = (await rl.question(`${message} [y/N]: `)).trim().toLowerCase();
		return answer === "y" || answer === "yes";
	} finally {
		rl.close();
	}
}

export function formatError(err: unknown): string {
	if (err instanceof HiaiDocsError) {
		if (err.status === 401) return `${red("Error:")} Unauthorized — check your API key.`;
		if (err.status === 404) return `${red("Error:")} ${err.message}`;
		return `${red(`Error (${err.status}):`)} ${err.message}`;
	}
	if (err instanceof Error) return `${red("Error:")} ${err.message}`;
	return `${red("Error:")} ${String(err)}`;
}

import { HiaiDocsError } from "./client.js";