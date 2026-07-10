import { afterEach, describe, expect, test } from "bun:test";

import { getOpenAICompatibleEmbedding } from "../embedding/providers/openai-compatible";
import { EMBEDDING_DIMENSIONS } from "../embedding/utils";

const originalFetch = globalThis.fetch;

afterEach(() => {
	globalThis.fetch = originalFetch;
});

function embeddingResponse(embedding: number[], status = 200): Response {
	return new Response(JSON.stringify({ data: [{ embedding }] }), {
		status,
		headers: { "Content-Type": "application/json" },
	});
}

describe("OpenAI-compatible embedding provider dimensions", () => {
	test("requests and returns exactly 1024 dimensions", async () => {
		let requestBody: Record<string, unknown> | undefined;
		const vector = Array.from(
			{ length: EMBEDDING_DIMENSIONS },
			(_, index) => index,
		);

		globalThis.fetch = (async (_input, init) => {
			requestBody = JSON.parse(String(init?.body)) as Record<string, unknown>;
			return embeddingResponse(vector);
		}) as typeof globalThis.fetch;

		const result = await getOpenAICompatibleEmbedding(
			"test text",
			"https://example.test/v1",
			"test-key",
			"test-embedding-model",
			5_000,
		);

		expect(requestBody).toEqual({
			model: "test-embedding-model",
			input: "test text",
			dimensions: EMBEDDING_DIMENSIONS,
		});
		expect(result).toEqual(vector);
		expect(result).toHaveLength(EMBEDDING_DIMENSIONS);
	});

	test("rejects providers that ignore the requested dimensions", async () => {
		globalThis.fetch = (async () =>
			embeddingResponse(
				Array.from({ length: 1_536 }, () => 0),
			)) as unknown as typeof globalThis.fetch;

		await expect(
			getOpenAICompatibleEmbedding(
				"test text",
				"https://example.test/v1",
				"",
				"test-embedding-model",
				5_000,
			),
		).rejects.toThrow(
			"OpenAI-compatible provider returned 1536 dimensions; expected 1024",
		);
	});
});
