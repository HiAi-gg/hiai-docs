// @ts-nocheck
import { getFolder, getFolderPath } from "$lib/api/folders.js";
import type { PageLoad } from "./$types.js";

export const load = async ({ params }: Parameters<PageLoad>[0]) => {
	const [folder, breadcrumb] = await Promise.all([
		getFolder(params.id),
		getFolderPath(params.id),
	]);

	return {
		folder,
		breadcrumb,
	};
};
