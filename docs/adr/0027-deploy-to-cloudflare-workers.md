# Deploy the playground to Cloudflare Workers

The playground is hosted on Cloudflare Workers, amending ADR 0020. Production
runs on `workerd`, not Bun: `node:fs`, `node:path`, and `Bun.serve` are
unavailable, and configuration arrives as per-request `env` bindings rather
than `process.env`.

One Worker serves the built SPA through the static-assets binding and the
`/api` routes from the same origin, so the Vite dev proxy and the `WEB_ORIGIN`
split remain a development-only concern.

Server-side state — the Google OAuth token and pending OAuth `state` values —
lives in Workers KV because isolates are ephemeral and there is no writable
filesystem. This constrains ADR 0006 rather than reversing it: credentials
still stay out of the editor bundle.

The MVP stays single-user (ADR 0001), so a publicly reachable deployment needs
its own access-control decision, tracked in issue #216.
