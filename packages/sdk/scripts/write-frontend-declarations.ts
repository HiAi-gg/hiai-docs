const declarations: Record<string, string> = {
	"dashboard.d.ts": 'import type { Component } from "svelte";\nexport declare const DocsmintDashboardHost: Component;\n',
	"search.d.ts": 'import type { Component } from "svelte";\nexport declare const DocsmintSearchHost: Component;\n',
	"shared-document.d.ts": 'import type { Component } from "svelte";\nexport declare const DocsmintSharedDocumentHost: Component;\nexport declare function renderSharedDocument(...args: readonly unknown[]): unknown;\n',
	"extension.d.ts": 'import type { Component } from "svelte";\nexport declare const DocsmintExtensionProvider: Component;\n',
	"components/sidebar.d.ts": 'import type { Component } from "svelte";\nexport declare const Sidebar: Component;\n',
	"components/settings.d.ts": 'import type { Component } from "svelte";\nexport declare const SettingsDialog: Component;\n',
	"theme.d.ts": 'export type ThemeMode = "light" | "dark" | "system";\nexport declare const theme: { readonly value: ThemeMode; readonly isDark: boolean };\nexport declare function setTheme(value: ThemeMode): void;\nexport declare function toggleTheme(): void;\n',
	"i18n.d.ts": 'export type Locale = string;\nexport declare const messages: Record<string, unknown>;\nexport declare const supportedLocales: readonly Locale[];\nexport declare function setLocale(locale: Locale): unknown;\nexport declare function getMessage(name: string): unknown;\n',
};

declarations["api/categories.d.ts"] = `
export type CategoryDto = Readonly<Record<string, unknown>>;
export declare const createCategoryInputSchema: unknown;
export declare const updateCategoryInputSchema: unknown;
export declare function listCategories(...args: readonly unknown[]): Promise<readonly CategoryDto[]>;
export declare function createCategory(...args: readonly unknown[]): Promise<CategoryDto>;
export declare function updateCategory(...args: readonly unknown[]): Promise<CategoryDto>;
export declare function deleteCategory(...args: readonly unknown[]): Promise<unknown>;
export declare function setDocumentCategory(...args: readonly unknown[]): Promise<unknown>;
export declare function setFolderCategory(...args: readonly unknown[]): Promise<unknown>;
`;
declarations["api/documents.d.ts"] = `
export type DocumentDto = Readonly<Record<string, unknown>>;
export declare function listDocuments(...args: readonly unknown[]): Promise<readonly DocumentDto[]>;
export declare function getDocument(...args: readonly unknown[]): Promise<DocumentDto>;
export declare function createDocument(...args: readonly unknown[]): Promise<DocumentDto>;
export declare function updateDocument(...args: readonly unknown[]): Promise<DocumentDto>;
export declare function deleteDocument(...args: readonly unknown[]): Promise<unknown>;
export declare function importDocument(...args: readonly unknown[]): Promise<DocumentDto>;
export declare function importDocuments(...args: readonly unknown[]): Promise<readonly DocumentDto[]>;
export declare function clearDocumentsCache(...args: readonly unknown[]): void;
`;
declarations["api/folders.d.ts"] = `
export type FolderDto = Readonly<Record<string, unknown>>;
export declare function listFolders(...args: readonly unknown[]): Promise<readonly FolderDto[]>;
export declare function getFolder(...args: readonly unknown[]): Promise<FolderDto>;
export declare function getFolderPath(...args: readonly unknown[]): Promise<readonly FolderDto[]>;
export declare function createFolder(...args: readonly unknown[]): Promise<FolderDto>;
export declare function updateFolder(...args: readonly unknown[]): Promise<FolderDto>;
export declare function deleteFolder(...args: readonly unknown[]): Promise<unknown>;
export declare function duplicateDocument(...args: readonly unknown[]): Promise<unknown>;
export declare function deleteDocument(...args: readonly unknown[]): Promise<unknown>;
`;
declarations["api/tags.d.ts"] = `
export type TagDto = Readonly<Record<string, unknown>>;
export declare const createTagInputSchema: unknown;
export declare const updateTagInputSchema: unknown;
export declare function listTags(...args: readonly unknown[]): Promise<readonly TagDto[]>;
export declare function getTag(...args: readonly unknown[]): Promise<TagDto>;
export declare function createTag(...args: readonly unknown[]): Promise<TagDto>;
export declare function updateTag(...args: readonly unknown[]): Promise<TagDto>;
export declare function deleteTag(...args: readonly unknown[]): Promise<unknown>;
export declare function addTagToDocument(...args: readonly unknown[]): Promise<unknown>;
export declare function removeTagFromDocument(...args: readonly unknown[]): Promise<unknown>;
`;
declarations["api/settings.d.ts"] = `
export type ProfileDto = Readonly<Record<string, unknown>>;
export type EmbeddingConfigDto = Readonly<Record<string, unknown>>;
export declare function getProfile(...args: readonly unknown[]): Promise<ProfileDto>;
export declare function updateProfile(...args: readonly unknown[]): Promise<ProfileDto>;
export declare function getEmbeddingConfig(...args: readonly unknown[]): Promise<EmbeddingConfigDto>;
export declare function updateEmbeddingConfig(...args: readonly unknown[]): Promise<EmbeddingConfigDto>;
export declare function deleteAccount(...args: readonly unknown[]): Promise<unknown>;
`;

const out = new URL("../dist/frontend/", import.meta.url);
for (const [name, contents] of Object.entries(declarations)) {
	await Bun.write(new URL(name, out), contents);
}
