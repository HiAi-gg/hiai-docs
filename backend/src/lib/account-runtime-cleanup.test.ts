import { expect, test } from "bun:test";
import { readFile } from "node:fs/promises";

test("publishes the server-only account runtime cleanup composition", async () => {
	const manifest = JSON.parse(
		await readFile(new URL("../../../package.json", import.meta.url), "utf8"),
	);
	expect(manifest.exports["./backend/account-runtime-cleanup"]).toEqual({
		browser: "./packages/sdk/dist/server-only-browser-entry.js",
		import: "./packages/sdk/dist/backend-account-runtime-cleanup.js",
		types: "./packages/sdk/dist/backend-account-runtime-cleanup.d.ts",
	});

	const source = await readFile(
		new URL("./account-runtime-cleanup.ts", import.meta.url),
		"utf8",
	);
	expect(source).toContain("createAccountRuntimeCleanup(options");
	expect(source).toContain("redisUrl: string");
	expect(source).toContain("databaseUrl: string");
	expect(source).toContain("new Redis(options.redisUrl");
	expect(source).toContain("postgres(options.databaseUrl");
	expect(source).toContain("eq(documents.ownerId, actorUserId)");
	expect(source).toContain(
		"set_config('app.current_user_role', 'admin', true)",
	);
	expect(source).toContain("databaseClient.end()");
});
