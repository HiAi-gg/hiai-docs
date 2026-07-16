import { redirect } from "@sveltejs/kit";
import type { LayoutServerLoad } from "./$types";

export const load: LayoutServerLoad = async ({ cookies }) => {
	const sessionCookie =
		cookies.get("better-auth.session_token") ??
		cookies.get("__Secure-better-auth.session_token");
	if (!sessionCookie) throw redirect(302, "/login");
	return {};
};
