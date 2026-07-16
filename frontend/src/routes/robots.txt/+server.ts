import type { RequestHandler } from "./$types";

export const GET: RequestHandler = async ({ url }) => {
	const robots = `User-agent: *
Disallow: /

Sitemap: ${url.origin}/sitemap.xml
`;

	return new Response(robots, {
		headers: {
			"Content-Type": "text/plain",
			"Cache-Control": "public, max-age=86400",
		},
	});
};
