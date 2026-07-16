import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("GraphRAG admin inventory", () => {
	test("returns the AGE aggregate value instead of counting its single result row", () => {
		const source = readFileSync(
			resolve(import.meta.dir, "../api/routes/admin.ts"),
			"utf8",
		);
		expect(source).toContain(
			"SELECT count::text AS count FROM cypher('docs_graph'",
		);
		expect(source).not.toContain(
			"SELECT count(*) AS count FROM cypher('docs_graph'",
		);
	});
});
