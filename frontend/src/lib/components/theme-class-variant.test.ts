import { expect, test } from "bun:test";

const appCss = await Bun.file(`${import.meta.dir}/../../app.css`).text();

test("dark utilities follow the explicit application theme class", () => {
	expect(appCss).toContain("@custom-variant dark (&:where(.dark, .dark *));");
});
