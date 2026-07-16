import { svelte } from "@sveltejs/vite-plugin-svelte";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const root = fileURLToPath(new URL("..", import.meta.url));
const entries = {
	dashboard: "../packages/sdk/frontend-entries/dashboard.ts",
	search: "../packages/sdk/frontend-entries/search.ts",
	"shared-document": "../packages/sdk/frontend-entries/shared-document.ts",
	extension: "../packages/sdk/frontend-entries/extension.ts",
	"api/categories": "../packages/sdk/frontend-entries/api/categories.ts",
	"api/documents": "../packages/sdk/frontend-entries/api/documents.ts",
	"api/folders": "../packages/sdk/frontend-entries/api/folders.ts",
	"api/tags": "../packages/sdk/frontend-entries/api/tags.ts",
	"api/settings": "../packages/sdk/frontend-entries/api/settings.ts",
	"components/sidebar": "../packages/sdk/frontend-entries/components/sidebar.ts",
	"components/settings": "../packages/sdk/frontend-entries/components/settings.ts",
	theme: "../packages/sdk/frontend-entries/theme.ts",
	i18n: "../packages/sdk/frontend-entries/i18n.ts",
};

/** Packaging-only build: it never changes the standalone SvelteKit app. */
export default defineConfig({
	plugins: [svelte()],
	resolve: {
		alias: {
			$lib: `${root}/frontend/src/lib`,
		},
	},
	build: {
		outDir: "../packages/sdk/dist/frontend",
		emptyOutDir: true,
		lib: { entry: entries, formats: ["es"] },
		rollupOptions: {
			external: [
				"svelte",
				"svelte/internal",
				"$app/navigation",
				"$app/state",
				"$app/environment",
			],
		},
	},
});
