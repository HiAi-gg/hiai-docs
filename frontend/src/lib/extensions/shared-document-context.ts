import type {
	SharedDocumentExtensionCapability,
	SharedDocumentExtensionContext,
} from "./types";

const sensitiveKeys = new Set([
	"shareToken",
	"password",
	"passwordHash",
	"workspaceAssertion",
	"authorization",
	"cookie",
	"signingSecret",
]);

function capability(
	value: SharedDocumentExtensionCapability,
): SharedDocumentExtensionCapability {
	if (!value.id.trim() || !value.expiresAt.trim()) {
		throw new TypeError(
			"Shared extension capability must include a non-empty id and expiry",
		);
	}
	return Object.freeze({ id: value.id, expiresAt: value.expiresAt });
}

/**
 * Drops undeclared properties before an extension component receives context.
 * This is deliberately a runtime boundary, not only a declaration contract.
 */
export function sanitizeSharedDocumentExtensionContext(
	value: SharedDocumentExtensionContext,
): SharedDocumentExtensionContext {
	for (const key of Object.keys(value)) {
		if (sensitiveKeys.has(key)) {
			throw new TypeError(
				`Sensitive ${key} must not be provided to a shared extension`,
			);
		}
	}
	return Object.freeze({
		documentId: value.documentId,
		title: value.title,
		content: value.content,
		...(value.contentJson === undefined
			? {}
			: { contentJson: value.contentJson }),
		role: value.role,
		capability: capability(value.capability),
		permissions: Object.freeze({
			read: true as const,
			annotate: value.permissions.annotate,
			edit: value.permissions.edit,
			export: value.permissions.export,
		}),
	});
}
