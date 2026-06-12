import { z } from "zod";
import { apiFetch } from "./client.js";

export interface Tag {
	id: string;
	name: string;
	color: string | null;
	createdAt: string;
	documentCount?: number;
}

// Frontend cap is 50 chars; backend hard limit is 100 (see backend/src/api/routes/tags.ts).

export const createTagInputSchema = z.object({
	name: z
		.string()
		.trim()
		.min(1, "Name is required")
		.max(50, "Name must be 50 characters or less"),
	color: z.string().max(20, "Color must be 20 characters or less").optional(),
});

export const updateTagInputSchema = z.object({
	name: z
		.string()
		.trim()
		.min(1, "Name is required")
		.max(50, "Name must be 50 characters or less")
		.optional(),
	color: z.string().max(20, "Color must be 20 characters or less").optional(),
});

export type CreateTagInput = z.infer<typeof createTagInputSchema>;
export type UpdateTagInput = z.infer<typeof updateTagInputSchema>;

// --- API Functions ---

export async function listTags(): Promise<Tag[]> {
	return apiFetch("/api/tags");
}

export function getTag(id: string): Promise<Tag> {
	return apiFetch(`/api/tags/${id}`);
}

export function createTag(name: string): Promise<Tag> {
	const input = createTagInputSchema.parse({ name });
	return apiFetch("/api/tags", {
		method: "POST",
		body: JSON.stringify(input),
	});
}

export function updateTag(id: string, name: string): Promise<Tag> {
	const input = updateTagInputSchema.parse({ name });
	return apiFetch(`/api/tags/${id}`, {
		method: "PATCH",
		body: JSON.stringify(input),
	});
}

export function deleteTag(id: string): Promise<void> {
	return apiFetch(`/api/tags/${id}`, { method: "DELETE" });
}
