import { getDocument } from "$lib/api/documents";
import type { PageLoad } from "./$types";

export const load: PageLoad = async ({ params, fetch }) => {
	try {
		const document = await getDocument(params.id, fetch);
		return { document };
	} catch {
		// Fallback when backend unavailable
		return {
			document: {
				id: params.id,
				title: "Untitled Document",
				content: "",
				folderId: null,
				folderName: "",
				tags: [],
				createdAt: new Date().toISOString(),
				updatedAt: new Date().toISOString(),
				excerpt: "",
			} as Awaited<ReturnType<typeof getDocument>>,
		};
	}
};
