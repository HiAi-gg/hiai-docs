import { describe, expect, test } from "bun:test";
import { apiFetch } from "./client";

describe("apiFetch", () => {
	test("is a function", () => {
		expect(typeof apiFetch).toBe("function");
	});

	test("returns promise", () => {
		const result = apiFetch("/api/test");
		expect(result).toBeInstanceOf(Promise);
		// Don't await - will fail with network error in test env
		result.catch(() => {});
	});
});
