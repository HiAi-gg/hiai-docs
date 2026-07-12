import { describe, expect, test } from "bun:test";
import { fetchRemoteImage, isPublicAddress } from "../lib/remote-image";

describe("remote image SSRF protection", () => {
	test("rejects private and loopback addresses", () => {
		for (const address of [
			"127.0.0.1",
			"10.0.0.1",
			"172.16.0.1",
			"192.168.1.1",
			"169.254.169.254",
			"::1",
			"fd00::1",
		]) {
			expect(isPublicAddress(address)).toBe(false);
		}
		expect(isPublicAddress("93.184.216.34")).toBe(true);
		expect(isPublicAddress("2606:2800:220:1:248:1893:25c8:1946")).toBe(true);
	});

	test("accepts a bounded supported image", async () => {
		const result = await fetchRemoteImage(
			"https://93.184.216.34/image",
			async () =>
				new Response(Uint8Array.from([1, 2, 3]), {
					headers: { "content-type": "image/png", "content-length": "3" },
				}),
		);
		expect(result.contentType).toBe("image/png");
		expect(result.bytes).toEqual(Uint8Array.from([1, 2, 3]));
	});

	test("rejects redirects to private hosts", async () => {
		await expect(
			fetchRemoteImage(
				"https://93.184.216.34/image",
				async () =>
					new Response(null, {
						status: 302,
						headers: { location: "http://127.0.0.1/secret" },
					}),
			),
		).rejects.toThrow("Private image hosts");
	});

	test("rejects non-image responses", async () => {
		await expect(
			fetchRemoteImage(
				"https://93.184.216.34/image",
				async () =>
					new Response("secret", { headers: { "content-type": "text/plain" } }),
			),
		).rejects.toThrow("Unsupported remote image type");
	});
});
