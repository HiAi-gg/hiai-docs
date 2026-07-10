import { describe, expect, it } from "bun:test";
import { parseOwnerUrlArg, resolveMigrationOwnerUrl } from "./migrate.js";

describe("migration owner contract", () => {
	it("requires the explicit migration owner URL instead of runtime DATABASE_URL", async () => {
		await expect(
			resolveMigrationOwnerUrl({
				env: { DATABASE_URL: "postgresql://hiai_app:runtime@db/app" },
			}),
		).rejects.toThrow("MIGRATION_DATABASE_URL");
	});

	it("resolves MIGRATION_DATABASE_URL and never reads DATABASE_URL as a fallback", async () => {
		await expect(
			resolveMigrationOwnerUrl({
				env: {
					DATABASE_URL: "postgresql://hiai_app:runtime@db/app",
					MIGRATION_DATABASE_URL: "postgresql://aiuser:owner@db/app",
				},
			}),
		).resolves.toBe("postgresql://aiuser:owner@db/app");
	});

	it("accepts an explicit owner URL through the migration command parser", () => {
		expect(parseOwnerUrlArg(["--owner-url", "postgresql://aiuser:owner@db/app"]))
			.toBe("postgresql://aiuser:owner@db/app");
		expect(parseOwnerUrlArg(["--owner-url=postgresql://aiuser:owner@db/app"]))
			.toBe("postgresql://aiuser:owner@db/app");
	});
});
