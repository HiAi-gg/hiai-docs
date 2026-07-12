import { describe, expect, test } from "bun:test";
import { resolveExtensions } from "./resolve";
import type { ExtensionVisibilityContext } from "./types";

describe("resolveExtensions", () => {
	test("orders visible extensions and ignores duplicate ids", () => {
		const extensions = resolveExtensions([
			{ id: "later", order: 10 },
			{ id: "first", order: -1 },
			{ id: "later", order: -10 },
		]);

		expect(extensions.map((extension) => extension.id)).toEqual([
			"first",
			"later",
		]);
	});

	test("evaluates visibility against the supplied host context", () => {
		const extensions = resolveExtensions(
			[
				{
					id: "allowed",
					visible: (context: ExtensionVisibilityContext) =>
						context.pathname === "/docs/1",
				},
				{ id: "hidden", visible: () => false },
			],
			{ pathname: "/docs/1" },
		);

		expect(extensions.map((extension) => extension.id)).toEqual(["allowed"]);
	});

	test("isolates the base UI from a faulty visibility predicate", () => {
		const extensions = resolveExtensions([
			{
				id: "faulty",
				visible: () => {
					throw new Error("third-party extension failure");
				},
			},
		]);

		expect(extensions).toEqual([]);
	});
});
