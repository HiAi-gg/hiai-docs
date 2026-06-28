import { redirect } from "@sveltejs/kit";
import { listCategories } from "$lib/api/categories.js";
import { ApiError } from "$lib/api/client.js";
import { listDocuments } from "$lib/api/documents.js";
import { getFolder, getFolderPath, listFolders } from "$lib/api/folders.js";
import { listTags } from "$lib/api/tags.js";
import type { PageLoad } from "./$types.js";

export const load: PageLoad = async ({ url, fetch, depends }) => {
	depends("app:dashboard");

	const folderId = url.searchParams.get("folder");

	try {
		const [categories, tags] = await Promise.all([
			listCategories(fetch),
			listTags(fetch).catch(() => []),
		]);

		let activeFolder: any = null;
		let breadcrumb: any[] = [];
		let rootFolders: any[] = [];
		let recentDocs: any[] = [];

		if (folderId) {
			const [folder, path] = await Promise.all([
				getFolder(folderId, fetch),
				getFolderPath(folderId, fetch),
			]);
			activeFolder = folder;
			breadcrumb = path;
		} else {
			const [rootResult, docsResult] = await Promise.all([
				listFolders(null, false, fetch),
				listDocuments({ limit: 100 }, fetch).catch(() => ({ items: [] })),
			]);
			rootFolders = rootResult[0]?.children ?? [];
			recentDocs = docsResult.items ?? [];
		}

		return {
			categories,
			tags,
			activeFolder,
			breadcrumb,
			rootFolders,
			recentDocs,
		};
	} catch (err) {
		if (err instanceof ApiError && err.status === 401) {
			throw redirect(302, "/login");
		}
		throw err;
	}
};
