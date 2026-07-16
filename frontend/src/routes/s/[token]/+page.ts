import type { PageLoad } from "./$types";

export const load: PageLoad = ({ params }) => {
	const token = params.token;

	// Token is the dynamic [token] route param — if it is missing or
	// "undefined" (which happens when navigation lands on a partially
	// resolved route), skip the network call and surface a clear
	// error instead of letting the fetch hit /api/share/undefined.
	if (!token || token === "undefined") {
		return {
			token: null,
			shareData: null,
			requiresPassword: false,
			shareError: "Missing share token",
		};
	}

	// Resolve public share data in the mounted page instead of blocking the
	// initial navigation. This lets the route render a real progress state
	// while slow storage/database work is still in flight.
	return {
		token,
		shareData: null,
		requiresPassword: false,
		shareError: null,
	};
};
