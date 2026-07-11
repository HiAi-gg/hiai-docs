import { describe, expect, test } from "bun:test";
import { rankChunkRows } from "../api/routes/search";

describe("search route chunk hydration", () => {
	test("keeps the top three finite cosine scores, not index order or zero placeholders", () => {
		const ranked = rankChunkRows([
			{ document_id: "doc-1", chunk_index: 0, chunk_text: "low", score: 0.2 },
			{ document_id: "doc-1", chunk_index: 4, chunk_text: "best", score: 0.95 },
			{ document_id: "doc-1", chunk_index: 2, chunk_text: "mid", score: 0.7 },
			{ document_id: "doc-1", chunk_index: 3, chunk_text: "third", score: 0.5 },
			{
				document_id: "doc-1",
				chunk_index: 9,
				chunk_text: "nan",
				score: Number.NaN,
			},
		]);

		expect(ranked.get("doc-1")?.map((chunk) => chunk.chunkText)).toEqual([
			"best",
			"mid",
			"third",
		]);
		expect(ranked.get("doc-1")?.map((chunk) => chunk.score)).toEqual([
			0.95, 0.7, 0.5,
		]);
	});
});
