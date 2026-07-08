/**
 * Text chunking for embedding pipeline.
 * Strategy: split by paragraphs, then merge into ~500 token chunks with 50 token overlap.
 * Token estimation: 1 token ≈ 4 chars (rough heuristic).
 */

import { chunkHash } from "../lib/chunk-hash";
import { config } from "../lib/config";

const CHARS_PER_TOKEN = 4;
const TARGET_TOKENS = config.CHUNK_TARGET_TOKENS;
const OVERLAP_TOKENS = config.CHUNK_OVERLAP_TOKENS;

const TARGET_CHARS = TARGET_TOKENS * CHARS_PER_TOKEN; // 2000
const OVERLAP_CHARS = OVERLAP_TOKENS * CHARS_PER_TOKEN; // 200

/**
 * Result of chunking: a chunk's text paired with its SHA-256 hash.
 *
 * The hash lets the worker decide whether a chunk changed between embeddings
 * without re-comparing the full text byte-by-byte. Stored alongside the
 * embedding so future re-embeds can skip unchanged chunks entirely.
 */
export interface ChunkResult {
	text: string;
	hash: string;
	charStart: number;
	charEnd: number;
}

/**
 * Split text into chunks suitable for embedding.
 * Each chunk is approximately 500 tokens (~2000 characters).
 * Adjacent chunks overlap by ~50 tokens (~200 characters).
 */
export function chunkText(text: string): ChunkResult[] {
	if (!text || text.trim().length === 0) {
		return [];
	}

	// Split into paragraphs (preserve double-newline boundaries)
	const paragraphs = text.split(/\n\s*\n/).filter((p) => p.trim().length > 0);

	if (paragraphs.length === 0) {
		return [];
	}

	// If a single paragraph exceeds target, split it further by sentences
	const normalizedParagraphs: string[] = [];
	for (const para of paragraphs) {
		if (para.length > TARGET_CHARS * 1.5) {
			// Split oversized paragraph by sentences
			const sentences = para.match(/[^.!?]+[.!?]+[\s]*/g) || [para];
			normalizedParagraphs.push(...sentences);
		} else {
			normalizedParagraphs.push(para);
		}
	}

	const strings: string[] = [];
	const startPositions: number[] = [];
	let currentChunk = "";
	let currentChunkStartPos = 0;
	let currentPos = 0;

	for (const paragraph of normalizedParagraphs) {
		const prefix = currentChunk ? "\n\n" : "";
		const candidate = currentChunk
			? `${currentChunk}${prefix}${paragraph}`
			: paragraph;

		if (candidate.length <= TARGET_CHARS) {
			if (currentChunk.length === 0) {
				currentChunkStartPos = currentPos;
			}
			currentChunk = candidate;
			currentPos += prefix.length + paragraph.length;
		} else {
			// Flush current chunk if non-empty
			if (currentChunk.length > 0) {
				const trimmed = currentChunk.trim();
				strings.push(trimmed);
				startPositions.push(currentChunkStartPos);
			}
			// Start new chunk with overlap from end of previous chunk
			if (OVERLAP_CHARS > 0 && currentChunk.length > 0) {
				const overlap = currentChunk.slice(-OVERLAP_CHARS);
				currentChunk = `${overlap}\n\n${paragraph}`;
				// Overlap chars are recycled; the new content starts at currentPos
				currentChunkStartPos = currentPos - OVERLAP_CHARS;
				currentPos += OVERLAP_CHARS + prefix.length + paragraph.length;
			} else {
				currentChunk = paragraph;
				currentChunkStartPos = currentPos;
				currentPos += paragraph.length;
			}
		}
	}

	// Flush remaining chunk
	if (currentChunk.trim().length > 0) {
		strings.push(currentChunk.trim());
		startPositions.push(currentChunkStartPos);
	}

	return strings.map((text, i) => {
		const pos = startPositions[i] ?? 0;
		return {
			text,
			hash: chunkHash(text),
			charStart: pos,
			charEnd: pos + text.length,
		};
	});
}
