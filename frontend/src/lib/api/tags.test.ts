import { describe, expect, test } from "bun:test";
import {
	createTag,
	createTagInputSchema,
	deleteTag,
	getTag,
	updateTag,
	updateTagInputSchema,
} from "./tags";

describe("createTagInputSchema", () => {
	test("accepts a non-empty name", () => {
		const result = createTagInputSchema.safeParse({ name: "design" });
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.name).toBe("design");
		}
	});

	test("trims surrounding whitespace", () => {
		const result = createTagInputSchema.safeParse({ name: "  design  " });
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.name).toBe("design");
		}
	});

	test("rejects an empty name", () => {
		const result = createTagInputSchema.safeParse({ name: "" });
		expect(result.success).toBe(false);
	});

	test("rejects a whitespace-only name after trim", () => {
		const result = createTagInputSchema.safeParse({ name: "   " });
		expect(result.success).toBe(false);
	});

	test("rejects a name over 50 chars", () => {
		const result = createTagInputSchema.safeParse({ name: "x".repeat(51) });
		expect(result.success).toBe(false);
	});

	test("accepts a name of exactly 50 chars", () => {
		const result = createTagInputSchema.safeParse({ name: "x".repeat(50) });
		expect(result.success).toBe(true);
	});
});

describe("updateTagInputSchema", () => {
	test("accepts a name update", () => {
		const result = updateTagInputSchema.safeParse({ name: "engineering" });
		expect(result.success).toBe(true);
	});

	test("rejects an empty name", () => {
		const result = updateTagInputSchema.safeParse({ name: "" });
		expect(result.success).toBe(false);
	});
});

describe("tag api functions", () => {
	test("createTag is a function", () => {
		expect(typeof createTag).toBe("function");
	});

	test("updateTag is a function", () => {
		expect(typeof updateTag).toBe("function");
	});

	test("deleteTag is a function", () => {
		expect(typeof deleteTag).toBe("function");
	});

	test("getTag is a function", () => {
		expect(typeof getTag).toBe("function");
	});

	test("createTag validates input via schema", () => {
		expect(() => createTag("")).toThrow();
	});

	test("createTag validates length via schema", () => {
		expect(() => createTag("x".repeat(51))).toThrow();
	});

	test("updateTag validates input via schema", () => {
		expect(() =>
			updateTag("550e8400-e29b-41d4-a716-446655440000", { name: "" }),
		).toThrow();
	});
});
