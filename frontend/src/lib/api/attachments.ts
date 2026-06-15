import { apiFetch } from "./client";

export interface Attachment {
	id: string;
	filename: string;
	mimeType: string;
	size: number;
	url: string;
}

export interface AttachmentListResponse {
	items: Attachment[];
}

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export function uploadAttachment(
	documentId: string,
	file: File,
): Promise<Attachment> {
	const formData = new FormData();
	formData.append("file", file);
	return apiFetch<Attachment>(`/api/documents/${documentId}/attachments`, {
		method: "POST",
		body: formData,
		// FormData uploads can exceed the default 10s client timeout.
		timeout: 60_000,
	});
}

export function listAttachments(
	documentId: string,
): Promise<AttachmentListResponse> {
	return apiFetch<AttachmentListResponse>(
		`/api/documents/${documentId}/attachments`,
	);
}

export function isImageFile(file: File): boolean {
	return file.type.startsWith("image/");
}

export function isFileSizeAllowed(file: File): boolean {
	return file.size <= MAX_FILE_SIZE;
}
