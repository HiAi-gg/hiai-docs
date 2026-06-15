/**
 * Strip common markdown syntax from a string, returning plain text.
 * Intended for preview snippets — not a full markdown-to-text converter.
 */
export function stripMarkdown(markdown: string): string {
	let text = markdown;

	// Fenced code blocks → content (strip ``` fences)
	text = text.replace(/^```[\s\S]*?\n([\s\S]*?)^```/gm, "$1");

	// Inline code
	text = text.replace(/`([^`]+)`/g, "$1");

	// Images → alt text
	text = text.replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1");

	// Links → link text
	text = text.replace(/\[([^\]]*)\]\([^)]*\)/g, "$1");

	// Bold (both flavors)
	text = text.replace(/\*\*([^*]+)\*\*/g, "$1");
	text = text.replace(/__([^_]+)__/g, "$1");

	// Italic (both flavors)
	text = text.replace(/\*([^*]+)\*/g, "$1");
	text = text.replace(/_([^_]+)_/g, "$1");

	// Strikethrough
	text = text.replace(/~~([^~]+)~~/g, "$1");

	// Headings: strip leading # + space
	text = text.replace(/^#{1,6}\s+/gm, "");

	// Blockquotes: strip leading > + space
	text = text.replace(/^>\s?/gm, "");

	// Horizontal rules
	text = text.replace(/^[-*_]{3,}\s*$/gm, "");

	// Unordered list markers at line start
	text = text.replace(/^[\s]*[-*+]\s+/gm, "");

	// Ordered list markers at line start
	text = text.replace(/^[\s]*\d+\.\s+/gm, "");

	// Collapse multiple blank lines
	text = text.replace(/\n{3,}/g, "\n\n");

	// Collapse internal whitespace (but preserve newlines)
	text = text.replace(/[^\S\n]+/g, " ");

	return text.trim();
}
