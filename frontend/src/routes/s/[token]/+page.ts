import type { PageLoad } from "./$types";

export const load: PageLoad = async ({ params, fetch }) => {
	return { token: params.token, fetch };
};
