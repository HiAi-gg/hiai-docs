import { expect, test } from "bun:test";

import { readFile } from "node:fs/promises";

const migrationPath = new URL("./migrations/0036_lifecycle_operations.sql", import.meta.url);
const journalPath = new URL("./migrations/meta/_journal.json", import.meta.url);

test("lifecycle migration defines durable operation constraints and tenant RLS", async () => {
	const migration = await readFile(migrationPath, "utf8");
	expect(migration).toContain('UNIQUE("actor_user_id", "idempotency_key")');
	expect(migration).toContain("ENUM('export', 'purge')");
	expect(migration).toContain(
		"ENUM('pending', 'running', 'retryable', 'completed', 'rejected')",
	);
	expect(migration).toContain('CREATE INDEX "lifecycle_operations_status_lease_idx"');
	expect(migration).toContain('CREATE INDEX "lifecycle_operations_retryable_idx"');
	expect(migration).toContain('ENABLE ROW LEVEL SECURITY');
	expect(migration).toContain('TO hiai_app');
	expect(migration).toContain('prevent_terminal_lifecycle_operation_mutation');
	expect(migration).toContain("OLD.status IN ('completed', 'rejected')");
	expect(migration).not.toContain('"fence_token" text');
	expect(migration).not.toContain("document_content");
	expect(migration).not.toContain("raw_error");
});

test("lifecycle migration is the latest journaled operation", async () => {
	const journal = JSON.parse(await readFile(journalPath, "utf8")) as {
		entries: Array<{ idx: number; tag: string }>;
	};
	expect(journal.entries.at(-1)).toMatchObject({
		idx: 36,
		tag: "0036_lifecycle_operations",
	});
});
