import { describe, expect, it } from "bun:test";

const frontendRoot = new URL("../../../../", import.meta.url);

describe("service worker offline fallback policy", () => {
	it("ships a data-free offline HTML shell", async () => {
		const shell = await Bun.file(
			new URL("static/offline.html", frontendRoot),
		).text();
		expect(shell).toContain("Offline — showing locally available content");
		expect(shell).not.toContain("contentJson");
		expect(shell).not.toContain("/api/");
	});

	it("uses the precached shell for failed navigations", async () => {
		const worker = await Bun.file(
			new URL("src/pwa/sw.ts", frontendRoot),
		).text();
		expect(worker).toContain('matchPrecache("/offline.html")');
		expect(worker).not.toContain('caches.match("/offline")');
	});

	it("includes the offline shell exactly once through the static asset glob", async () => {
		const config = await Bun.file(
			new URL("vite.config.ts", frontendRoot),
		).text();
		expect(config).toContain(
			'globPatterns: ["**/*.{html,js,css,ico,png,svg,webp,woff2}"]',
		);
		expect(config).not.toContain("additionalManifestEntries");
	});

	it("does not add the generated web manifest to the precache twice", async () => {
		const config = await Bun.file(
			new URL("vite.config.ts", frontendRoot),
		).text();
		expect(config).toContain('"client/manifest.webmanifest"');
	});
});
