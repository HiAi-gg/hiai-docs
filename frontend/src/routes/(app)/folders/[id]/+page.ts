import { redirect } from "@sveltejs/kit";
import type { PageLoad } from "./$types.js";

export const load: PageLoad = ({ params }) => {
	throw redirect(302, `/?folder=${params.id}`);
};
