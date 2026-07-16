# External workspace context

HiAi-Docs can be mounted by a trusted host that owns workspace membership and
lifecycle. HiAi-Docs stores only an opaque `workspace_id`; it does not manage
workspaces, members, invitations, billing, or workspace UI.

## Configuration

Set `EXTERNAL_TENANT_ENABLED=true`, `EXTERNAL_TENANT_ISSUER`, and a private
`EXTERNAL_TENANT_SECRET` in the API environment. The default is disabled, and
an assertion is rejected when the integration is not enabled. Personal
self-hosted requests continue to use the session-derived `owner_id` context.

## Assertion transport

The gateway sends one `X-Hiai-Tenant-Context` header containing:

```text
base64url(JSON(ExternalTenantContext)).base64url(HMAC-SHA256(payload, secret))
```

The payload is:

```ts
interface ExternalTenantContext {
  actorUserId: string;
  workspaceId: string;
  actorRole: "owner" | "admin" | "editor" | "viewer";
  issuedAt: number;
  expiresAt: number;
  issuer: string;
}
```

HiAi-Docs verifies the signature, issuer, lifetime, role, and non-empty
workspace ID before creating a request context. A browser-supplied workspace
ID or unsigned header is never trusted. Invalid assertions fail closed rather
than falling back to personal context.

## SDK hook

Trusted hosts attach the assertion with the SDK request context:

```ts
const docs = new DocsClient({ baseUrl: "https://docs.internal" });
const workspaceDocs = docs.withRequestContext({
  externalTenantAssertion: signedAssertion,
});
await workspaceDocs.listDocs();
```

The assertion should be short-lived and generated server-side. Do not put the
signing secret or assertion-generation code in browser bundles.
