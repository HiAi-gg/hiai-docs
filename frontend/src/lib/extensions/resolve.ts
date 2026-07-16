import type { ExtensionVisibility, ExtensionVisibilityContext } from "./types";

type OrderedExtension = {
	id: string;
	order?: number;
	visible?: ExtensionVisibility;
};

/**
 * Returns extensions in a deterministic order, omitting duplicate ids and
 * extensions that are unavailable in the current host context.
 *
 * Extension manifests are an optional product boundary. A faulty visibility
 * predicate must not prevent the stock DocsMint UI from rendering, so a
 * throwing predicate is treated as not visible.
 */
export function resolveExtensions<T extends OrderedExtension>(
	extensions: readonly T[],
	context: ExtensionVisibilityContext = {},
): T[] {
	const seen = new Set<string>();
	const visible: T[] = [];

	for (const extension of extensions) {
		if (seen.has(extension.id) || !isVisible(extension.visible, context)) {
			continue;
		}
		seen.add(extension.id);
		visible.push(extension);
	}

	return visible.sort((a, b) => {
		const orderDifference = (a.order ?? 0) - (b.order ?? 0);
		return orderDifference !== 0 ? orderDifference : a.id.localeCompare(b.id);
	});
}

function isVisible(
	visible: ExtensionVisibility | undefined,
	context: ExtensionVisibilityContext,
): boolean {
	if (!visible) return true;
	try {
		return visible(context);
	} catch {
		return false;
	}
}
