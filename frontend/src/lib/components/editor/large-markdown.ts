export const LARGE_MARKDOWN_THRESHOLD = 250_000;

export function shouldDeferMarkdownParsing(markdown: string): boolean {
	return markdown.length > LARGE_MARKDOWN_THRESHOLD;
}
