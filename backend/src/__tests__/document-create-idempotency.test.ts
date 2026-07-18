import { expect, test } from "bun:test";
import {
	documentCreateIdempotencyKey,
	documentCreateWorkspaceIdentity,
} from "../lib/document-create-idempotency";

test("document create idempotency accepts only bounded ASCII token keys", () => {
	expect(
		documentCreateIdempotencyKey(new Request("http://docs.test")),
	).toBeNull();
	expect(
		documentCreateIdempotencyKey(
			new Request("http://docs.test", {
				headers: { "Idempotency-Key": "fork:abc_1.2" },
			}),
		),
	).toBe("fork:abc_1.2");
	expect(
		documentCreateIdempotencyKey(
			new Request("http://docs.test", {
				headers: { "Idempotency-Key": "bad key" },
			}),
		),
	).toBe("invalid");
	expect(
		documentCreateIdempotencyKey(
			new Request("http://docs.test", {
				headers: { "Idempotency-Key": "x".repeat(129) },
			}),
		),
	).toBe("invalid");
});

test("document-create operation identity is scoped to the verified tenant", () => {
	expect(documentCreateWorkspaceIdentity("actor-a", "workspace-a")).toBe(
		"workspace-a",
	);
	expect(documentCreateWorkspaceIdentity("actor-a", undefined)).toBe(
		"personal:actor-a",
	);
	expect(documentCreateWorkspaceIdentity("actor-b", undefined)).toBe(
		"personal:actor-b",
	);
});
