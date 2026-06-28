import type { Handle, HandleServerError } from "@sveltejs/kit";
import { getLocale } from "$lib/paraglide/runtime";

export const handle: Handle = async ({ event, resolve }) => {
	const locale = getLocale();
	return resolve(event, {
		transformPageChunk: ({ html }) =>
			html.replace("%lang%", locale).replace("%dir%", "ltr"),
	});
};

export const handleError: HandleServerError = ({ error }) => {
	console.error("DETAILED SERVER ERROR:", error);
	return {
		message: "Internal Error",
	};
};
