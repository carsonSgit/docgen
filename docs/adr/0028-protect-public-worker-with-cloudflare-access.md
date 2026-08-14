# Protect the public Worker with Cloudflare Access

The deployed Worker is protected by Cloudflare Access. The Access policy allows
only the single approved owner identity; the Worker validates the
`CF-Access-Jwt-Assertion` against the configured Access issuer, audience, and
JWKS before handling any `/api/*` request. The application’s Google OAuth flow
remains separate because it authorizes Google Drive writes, not application
access.

Production also disables unprotected `workers.dev` and preview routes, and the
export endpoint has an application-level rate limit in addition to Cloudflare
edge controls. This prevents an alternate hostname or a direct API caller from
turning the single stored Google credential into an anonymous export service.
