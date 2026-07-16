import type { RequestHandler } from "./$types";

export const GET: RequestHandler = async () => {
	// The standalone product has no public marketing/authenticated document
	// routes. Keep the sitemap valid but empty rather than advertising login,
	// register, or private application screens to crawlers.
	const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>`;

	return new Response(sitemap, {
		headers: {
			"Content-Type": "application/xml",
			"Cache-Control": "public, max-age=3600",
		},
	});
};
