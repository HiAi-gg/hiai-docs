import { describe, expect, test } from "bun:test";
import { documentReferencesAttachment } from "../lib/share-access";

describe("legacy duplicated attachment references", () => {
	test("matches only an exact protected attachment URL", () => {
		expect(
			documentReferencesAttachment(
				{
					contentJson: {
						attrs: { src: "/api/attachments/attachment-id/raw" },
					},
				},
				"attachment-id",
			),
		).toBe(true);
		expect(
			documentReferencesAttachment(
				{ content: "/api/attachments/different-id/raw" },
				"attachment-id",
			),
		).toBe(false);
	});
});
