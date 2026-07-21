import { expect, test } from "bun:test";
import { readFile } from "node:fs/promises";

test("publishes the frozen server-only account cancellation composition", async () => {
	const manifest = JSON.parse(
		await readFile(new URL("../../../package.json", import.meta.url), "utf8"),
	);
	expect(manifest.exports["./backend/pipeline-cancellation"]).toEqual({
		browser: "./packages/sdk/dist/server-only-browser-entry.js",
		import: "./packages/sdk/dist/backend-pipeline-cancellation.js",
		types: "./packages/sdk/dist/backend-pipeline-cancellation.d.ts",
	});
	const source = await readFile(
		new URL("./account-pipeline-cancellation.ts", import.meta.url),
		"utf8",
	);
	expect(source).toContain("cancelAccountPipelineJobs(");
	expect(source).toContain("cancelActorPipeline(actorUserId, signal)");
	expect(source).toContain(
		"await Promise.all(queues.map((queue) => queue.close()))",
	);
	expect(source).toContain("new Queue<PipelineJob>");
	expect(source).not.toContain("getPipelineQueue(");
	expect(source).toContain("databaseUrl: string");
	expect(source).toContain(
		"const databaseClient = postgres(options.databaseUrl",
	);
	expect(source).not.toContain('from "../lib/db"');
	expect(source).toContain("await databaseClient.end()");
});
