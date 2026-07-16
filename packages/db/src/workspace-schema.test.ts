import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { documents, folders, shareLinks } from "./schema";

const migration = readFileSync(
	new URL("./migrations/0035_external_workspace_context.sql", import.meta.url),
	"utf8",
);
const journal = JSON.parse(
	readFileSync(new URL("./migrations/meta/_journal.json", import.meta.url), "utf8"),
) as { entries: Array<{ idx: number; tag: string }> };

describe("external workspace persistence contract", () => {
	it("models workspace dimensions on core tables", () => {
		expect(documents.workspaceId.name).toBe("workspace_id");
		expect(folders.workspaceId.name).toBe("workspace_id");
		expect(shareLinks.workspaceId.name).toBe("workspace_id");
	});

	it("installs workspace defaults and RLS predicates", () => {
		expect(migration).toContain("app.current_workspace_id");
		expect(migration).toContain("workspace_id IS NULL");
		expect(migration).toContain("workspace_id IS NOT NULL");
		expect(migration).toContain("DROP POLICY IF EXISTS tenant_isolation ON public.share_links");
		expect(journal.entries).toContainEqual(expect.objectContaining({
			idx: 35,
			tag: "0035_external_workspace_context",
		}));
	});
});
