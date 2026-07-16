export const EXTERNAL_TENANT_CONTEXT_HEADER = "x-hiai-tenant-context";

export class ExternalTenantContextError extends Error {
	readonly status = 401;

	constructor(message: string, options?: { cause?: unknown }) {
		super(message, options);
		this.name = "ExternalTenantContextError";
	}
}

export const externalTenantContextSchema = {
	actorRole: ["owner", "admin", "editor", "viewer"] as const,
};

export interface ExternalTenantContext {
	actorUserId: string;
	workspaceId: string;
	actorRole: (typeof externalTenantContextSchema.actorRole)[number];
	issuedAt: number;
	expiresAt: number;
	issuer: string;
}

export interface ExternalTenantAssertionOptions {
	secret: string;
	issuer: string;
	nowSeconds?: number;
	clockSkewSeconds?: number;
}

const encoder = new TextEncoder();

function encode(value: string): string {
	return Buffer.from(value, "utf8").toString("base64url");
}

function decode(value: string): string {
	return Buffer.from(value, "base64url").toString("utf8");
}

async function sign(payload: string, secret: string): Promise<string> {
	const key = await crypto.subtle.importKey(
		"raw",
		encoder.encode(secret),
		{ name: "HMAC", hash: "SHA-256" },
		false,
		["sign"],
	);
	return Buffer.from(
		await crypto.subtle.sign("HMAC", key, encoder.encode(payload)),
	).toString("base64url");
}

function assertContext(value: unknown): asserts value is ExternalTenantContext {
	if (!value || typeof value !== "object")
		throw new Error("Invalid tenant context");
	const context = value as Record<string, unknown>;
	if (typeof context.actorUserId !== "string" || !context.actorUserId) {
		throw new Error("Invalid actorUserId");
	}
	if (typeof context.workspaceId !== "string" || !context.workspaceId) {
		throw new Error("Invalid workspaceId");
	}
	if (
		typeof context.actorRole !== "string" ||
		!externalTenantContextSchema.actorRole.includes(
			context.actorRole as ExternalTenantContext["actorRole"],
		)
	) {
		throw new Error("Invalid actorRole");
	}
	for (const field of ["issuedAt", "expiresAt"]) {
		if (
			typeof context[field] !== "number" ||
			!Number.isFinite(context[field])
		) {
			throw new Error(`Invalid ${field}`);
		}
	}
	if (typeof context.issuer !== "string" || !context.issuer) {
		throw new Error("Invalid issuer");
	}
}

export async function createExternalTenantAssertion(
	context: ExternalTenantContext,
	secret: string,
): Promise<string> {
	assertContext(context);
	const payload = encode(JSON.stringify(context));
	return `${payload}.${await sign(payload, secret)}`;
}

export async function verifyExternalTenantAssertion(
	assertion: string,
	options: ExternalTenantAssertionOptions,
): Promise<ExternalTenantContext> {
	const [payload, signature, ...extra] = assertion.split(".");
	if (!payload || !signature || extra.length > 0) {
		throw new Error("Invalid tenant assertion format");
	}
	const expected = await sign(payload, options.secret);
	if (expected.length !== signature.length || expected !== signature) {
		throw new Error("Invalid tenant assertion signature");
	}
	let decoded: unknown;
	try {
		decoded = JSON.parse(decode(payload));
	} catch {
		throw new Error("Invalid tenant assertion payload");
	}
	assertContext(decoded);
	if (decoded.issuer !== options.issuer)
		throw new Error("Invalid tenant assertion issuer");
	const now = options.nowSeconds ?? Math.floor(Date.now() / 1000);
	const skew = options.clockSkewSeconds ?? 5;
	if (decoded.issuedAt > now + skew)
		throw new Error("Tenant assertion is not yet valid");
	if (decoded.expiresAt <= now - skew)
		throw new Error("Tenant assertion is expired");
	if (decoded.expiresAt <= decoded.issuedAt)
		throw new Error("Invalid tenant assertion lifetime");
	return decoded;
}
