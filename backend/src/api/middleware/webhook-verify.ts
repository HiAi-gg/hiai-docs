import { createHmac, timingSafeEqual } from "node:crypto";
import { config } from "../../lib/config";

const WEBHOOK_SECRET = config.WEBHOOK_SECRET;

export function verifyWebhookSignature(
	body: string,
	signature: string | null,
): boolean {
	if (!signature || !WEBHOOK_SECRET) return false;
	const expected = createHmac("sha256", WEBHOOK_SECRET)
		.update(body)
		.digest("hex");
	try {
		return timingSafeEqual(
			Buffer.from(signature, "hex"),
			Buffer.from(expected, "hex"),
		);
	} catch {
		return false;
	}
}
