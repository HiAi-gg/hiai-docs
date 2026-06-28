/**
 * DOCX → Markdown conversion via mammoth.
 *
 * `mammoth.convertToMarkdown({ buffer })` converts a Word document to a
 * Markdown-flavoured string: headings, lists, bold/italic, links, and code
 * blocks all map to their Markdown equivalents. This is the canonical path
 * when callers want to preserve document structure for storage as a
 * knowledge-base entry. We use this over `extractRawText` because the plan
 * (Step 2.4) explicitly targets DOCX→Markdown fidelity.
 *
 * Error handling:
 *   - Empty input returns an empty string (callers can persist empty
 *     documents without treating this as a hard failure).
 *   - Any mammoth-side failure (corrupt file, encrypted document, wrong
 *     format) is wrapped in `DocxParseError` so callers can distinguish
 *     parsing failures from generic 500s.
 */

import mammoth from "mammoth";

/**
 * Mammoth's bundled TypeScript definitions (`mammoth@1.12.x`) do not declare
 * `convertToMarkdown` even though the runtime exposes it. Cast to a richer
 * shape locally so we can call it with full type-safety without installing
 * extra `@types/mammoth` typings (which would conflict with the bundled
 * `lib/index.d.ts`).
 */
type MammothWithMarkdown = typeof mammoth & {
	convertToMarkdown: (input: { buffer: Buffer }) => Promise<{
		value: string;
		messages: Array<{ type: string; message: string }>;
	}>;
};

export class DocxParseError extends Error {
	readonly fileName?: string;
	readonly cause: unknown;
	constructor(message: string, fileName: string | undefined, cause: unknown) {
		super(message);
		this.name = "DocxParseError";
		this.fileName = fileName;
		this.cause = cause;
	}
}

/**
 * Convert a DOCX file's raw bytes to a Markdown string.
 *
 * @param buffer   The DOCX file contents (typically from `File.arrayBuffer()`
 *                 or `fs.readFile`).
 * @param fileName Optional original filename used only to enrich error
 *                 messages. Not embedded in the returned content.
 * @returns        Markdown text representing the document body. Empty string
 *                 for an empty buffer.
 * @throws         `DocxParseError` if mammoth cannot parse the buffer.
 */
export async function docxToMarkdown(
	buffer: Buffer,
	fileName?: string,
): Promise<string> {
	if (!buffer || buffer.length === 0) {
		return "";
	}
	try {
		const m = mammoth as MammothWithMarkdown;
		const result = await m.convertToMarkdown({ buffer });
		const text = (result.value ?? "").trim();
		if (result.messages && result.messages.length > 0) {
			// mammoth emits non-fatal warnings (unsupported styles, ignored
			// images, etc.). Surface via the server logger so issues are
			// visible in logs but don't fail the conversion — most DOCX
			// files extract cleanly enough for chunking/embedding even with
			// style warnings.
			for (const msg of result.messages) {
				console.warn(
					`[docx-parser] mammoth message (${fileName ?? "buffer"}): ${msg.type} ${msg.message}`,
				);
			}
		}
		return text;
	} catch (err) {
		throw new DocxParseError(
			`Failed to parse DOCX${fileName ? ` "${fileName}"` : ""}: ${err instanceof Error ? err.message : String(err)}`,
			fileName,
			err,
		);
	}
}
