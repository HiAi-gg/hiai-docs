import { expect, test } from "bun:test";

const source = await Bun.file(
	`${import.meta.dir}/../../routes/(app)/+layout.server.ts`,
).text();

test("all private app routes redirect anonymous requests before mounting sidebar data loaders", () => {
	expect(source).toContain('cookies.get("better-auth.session_token")');
	expect(source).toContain('cookies.get("__Secure-better-auth.session_token")');
	expect(source).toContain('redirect(302, "/login")');
});
