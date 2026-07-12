import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

export const REMOTE_IMAGE_MAX_BYTES = 25 * 1024 * 1024;
const MAX_REDIRECTS = 3;
const ALLOWED_IMAGE_TYPES = new Set([
	"image/jpeg",
	"image/png",
	"image/gif",
	"image/bmp",
]);

function isBlockedIpv4(address: string): boolean {
	const octets = address.split(".").map(Number);
	const [a, b] = octets;
	if (octets.length !== 4 || a === undefined || b === undefined) return true;
	return (
		a === 0 ||
		a === 10 ||
		a === 127 ||
		a >= 224 ||
		(a === 169 && b === 254) ||
		(a === 172 && b >= 16 && b <= 31) ||
		(a === 192 && b === 168) ||
		(a === 100 && b >= 64 && b <= 127)
	);
}

export function isPublicAddress(address: string): boolean {
	const version = isIP(address);
	if (version === 4) return !isBlockedIpv4(address);
	if (version !== 6) return false;
	const normalized = address.toLowerCase();
	if (normalized.startsWith("::ffff:")) {
		return !isBlockedIpv4(normalized.slice(7));
	}
	return !(
		normalized === "::" ||
		normalized === "::1" ||
		normalized.startsWith("fc") ||
		normalized.startsWith("fd") ||
		normalized.startsWith("fe8") ||
		normalized.startsWith("fe9") ||
		normalized.startsWith("fea") ||
		normalized.startsWith("feb")
	);
}

export async function assertPublicRemoteUrl(url: URL): Promise<void> {
	if (url.protocol !== "http:" && url.protocol !== "https:") {
		throw new Error("Only HTTP image URLs are supported");
	}
	if (url.username || url.password || url.port) {
		throw new Error("Remote image URL contains unsupported authority data");
	}
	const hostname = url.hostname.toLowerCase();
	if (hostname === "localhost" || hostname.endsWith(".local")) {
		throw new Error("Private image hosts are not allowed");
	}
	if (isIP(hostname)) {
		if (!isPublicAddress(hostname))
			throw new Error("Private image hosts are not allowed");
		return;
	}
	const addresses = await lookup(hostname, { all: true, verbatim: true });
	if (
		addresses.length === 0 ||
		addresses.some(({ address }) => !isPublicAddress(address))
	) {
		throw new Error("Private image hosts are not allowed");
	}
}

export interface RemoteImageResult {
	bytes: Uint8Array;
	contentType: string;
}

type RemoteFetch = (
	input: RequestInfo | URL,
	init?: RequestInit,
) => Promise<Response>;

async function readBoundedBody(response: Response): Promise<Uint8Array> {
	if (!response.body) return new Uint8Array();
	const reader = response.body.getReader();
	const chunks: Uint8Array[] = [];
	let total = 0;
	while (true) {
		const { done, value } = await reader.read();
		if (done) break;
		if (!value) continue;
		total += value.byteLength;
		if (total > REMOTE_IMAGE_MAX_BYTES) {
			await reader.cancel();
			throw new Error("Remote image is too large");
		}
		chunks.push(value);
	}
	const bytes = new Uint8Array(total);
	let offset = 0;
	for (const chunk of chunks) {
		bytes.set(chunk, offset);
		offset += chunk.byteLength;
	}
	return bytes;
}

export async function fetchRemoteImage(
	source: string,
	fetchImpl: RemoteFetch = fetch,
): Promise<RemoteImageResult> {
	let url = new URL(source);
	for (let redirect = 0; redirect <= MAX_REDIRECTS; redirect += 1) {
		await assertPublicRemoteUrl(url);
		const response = await fetchImpl(url, {
			redirect: "manual",
			signal: AbortSignal.timeout(10_000),
			headers: { Accept: "image/jpeg,image/png,image/gif,image/bmp" },
		});
		if (response.status >= 300 && response.status < 400) {
			const location = response.headers.get("location");
			if (!location || redirect === MAX_REDIRECTS)
				throw new Error("Too many image redirects");
			url = new URL(location, url);
			continue;
		}
		if (!response.ok)
			throw new Error(`Remote image returned ${response.status}`);
		const contentType = (
			(response.headers.get("content-type") ?? "").split(";", 1)[0] ?? ""
		)
			.trim()
			.toLowerCase();
		if (!ALLOWED_IMAGE_TYPES.has(contentType))
			throw new Error("Unsupported remote image type");
		const length = Number(response.headers.get("content-length"));
		if (Number.isFinite(length) && length > REMOTE_IMAGE_MAX_BYTES)
			throw new Error("Remote image is too large");
		const bytes = await readBoundedBody(response);
		return { bytes, contentType };
	}
	throw new Error("Remote image could not be fetched");
}
