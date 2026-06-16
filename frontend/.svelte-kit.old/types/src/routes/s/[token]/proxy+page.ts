// @ts-nocheck
import type { PageLoad } from "./$types";

export const load = async ({ params, fetch }: Parameters<PageLoad>[0]) => {
	return { token: params.token, fetch };
};
