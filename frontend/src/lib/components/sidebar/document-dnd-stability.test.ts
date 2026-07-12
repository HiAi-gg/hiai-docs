import { describe, expect, test } from "bun:test";

const source = await Bun.file(`${import.meta.dir}/FolderTree.svelte`).text();

describe("document drag-and-drop stability", () => {
	test("persists only the document reported by the finalize event", () => {
		expect(source).toContain(
			"const finalizedDocumentId = e.detail.info?.id ?? draggedDocId",
		);
		expect(source).toContain(
			"void persistZoneChanges(zone, finalizedDocumentId)",
		);
		expect(source).toContain(
			"async function persistZoneChanges(zone: DocZone, documentId: string)",
		);
		expect(source).not.toContain("for (const item of zoneItems)");
	});

	test("keeps the dragged id until native header drop has fired", () => {
		expect(source).toContain("window.setTimeout(() => {");
		expect(source).toContain(
			"if (draggedDocId === finalizedDocumentId) draggedDocId = null",
		);
	});

	test("protects the optimistic move from concurrent sidebar refreshes", () => {
		expect(source).toContain("publishDocumentPlacement(");
		expect(source).toContain(
			"acknowledgeDocumentPlacement(documentId, placementVersion)",
		);
	});
});
