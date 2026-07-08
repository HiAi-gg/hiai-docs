import { Elysia } from "elysia";

export interface PluginManifest {
	name: string;
	version: string;
	description: string;
	configSchema?: Record<string, unknown>;
}

const pluginRegistry: PluginManifest[] = [
	{
		name: "highlight",
		version: "1.0.0",
		description: "Text highlight/marker extension",
	},
	{
		name: "link",
		version: "1.0.0",
		description: "Hyperlink support with auto-link detection",
	},
	{
		name: "image",
		version: "1.0.0",
		description: "Image embed support",
	},
	{
		name: "table",
		version: "1.0.0",
		description: "Table editing support",
	},
	{
		name: "task-list",
		version: "1.0.0",
		description: "Task/checklist items",
	},
];

export const pluginsRoutes = new Elysia({ prefix: "/api/plugins" })
	.get("/", async () => {
		return { plugins: pluginRegistry };
	})
	.get("/:name", async ({ params, set }) => {
		const plugin = pluginRegistry.find((p) => p.name === params.name);
		if (!plugin) {
			set.status = 404;
			return { error: "Plugin not found" };
		}
		return plugin;
	});
