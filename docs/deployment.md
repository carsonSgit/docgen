# Cloudflare deployment

The production target is one Cloudflare Worker serving both the Vite SPA and
the `/api` routes. Cloudflare Git integration deploys the `main` branch; the
repository does not run a second deployment from GitHub Actions. The Worker is
not published on an unprotected `workers.dev` URL.

## Create the Cloudflare resources

1. Create or select a Cloudflare account and connect the `carsonSgit/docgen`
   repository in Workers & Pages.
2. Configure the production branch as `main` and the build command as
   `bun run deploy`. Use Bun 1.3.14, matching CI.
3. Create the token namespace:

   ```sh
   bunx wrangler kv namespace create GOOGLE_OAUTH_TOKENS
   ```

   Put the returned production namespace ID into `wrangler.jsonc` as the
   `GOOGLE_OAUTH_TOKENS` binding. Do not use a preview namespace for production.
4. Add a custom domain for the Worker. The deployed API callback will be:
   `https://<worker-host>/api/auth/google/callback`.
5. Keep `workers_dev` disabled and disable Preview URLs unless they have a
   separate Access application, separate KV namespace, and separate Google
   OAuth client. Preview deployments must never receive the production Google
   client secret or production KV namespace.

## Configure Cloudflare Access

Create an Access application covering the production Worker hostname. Its
policy should allow only the approved owner email, using the selected identity
provider. Copy the application’s audience tag and Access team domain into the
Worker variables below. Access blocks requests at the edge, and the Worker
also validates the `CF-Access-Jwt-Assertion` signature, issuer, audience, and
expiry before it handles `/api/*`.

The application’s Google OAuth login is a separate step: Access proves that the
visitor may use DocGen, while Google OAuth authorizes the Worker to write to
Google Drive. The two flows must not be conflated.

Add a WAF rate-limiting rule for `POST /api/export` as an additional edge
control. The Worker also applies its own per-client-IP limit because every
export can perform Google API writes.

## Environment matrix

Set ordinary variables in the Worker’s Variables and Secrets configuration.
Set the client secret only as a secret.

| Variable | Cloudflare kind | Production value |
| --- | --- | --- |
| `GOOGLE_CLIENT_ID` | Plain variable | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | Secret | Google OAuth client secret |
| `GOOGLE_REDIRECT_URI` | Plain variable | `https://<worker-host>/api/auth/google/callback` |
| `WEB_ORIGIN` | Plain variable | `https://<worker-host>` |
| `GOOGLE_OAUTH_TOKENS` | KV binding | Namespace declared in `wrangler.jsonc` |
| `CF_ACCESS_TEAM_DOMAIN` | Plain variable | `https://<team-name>.cloudflareaccess.com` |
| `CF_ACCESS_AUDIENCE` | Plain variable | Access application audience tag |
| `EXPORT_RATE_LIMIT` | Plain variable | Requests per client IP per 60 seconds, normally `10` |
| `PORT` | Local-only | Never configure on Workers |
| `GOOGLE_VERIFY_REDIRECT_URI` | Local-only | Never configure on Workers |
| `GOOGLE_ACCESS_TOKEN` | Local-only | Never configure on Workers |
| `GOOGLE_OAUTH_TOKEN_PATH` | Local-only | Never configure on Workers |

The secret can be set with Wrangler without putting it in the repository:

```sh
printf '%s' "$GOOGLE_CLIENT_SECRET" | bunx wrangler secret put GOOGLE_CLIENT_SECRET
```

Never commit the value or place it in a GitHub issue, pull request, preview
environment, or browser bundle.

## Configure Google OAuth

In Google Cloud Console, on the same OAuth client used for the deployment:

1. Add `https://<worker-host>/api/auth/google/callback` as an authorized
   redirect URI.
2. Set `GOOGLE_REDIRECT_URI` to that exact value, including scheme, host, path,
   and trailing-slash behavior. Google rejects a mismatch.
3. Keep the `documents` and `drive.file` scopes only.
4. Complete Access login first, then authorize Google when the first export
   needs Drive access.

## Verify before calling it live

From the repository root:

```sh
bun install --frozen-lockfile
bun run format:check
bun run lint
bun run typecheck
bun run test
bun run knip
bun run verify:worker-assets
bunx wrangler deploy --dry-run
```

Then confirm the production host has these properties:

- unauthenticated `/api/*` requests are rejected by Access and the Worker;
- `/health` responds only through the intended production hostname;
- the SPA, OAuth callback, and API all use the same origin;
- `POST /api/export` is rate-limited;
- Access allows only the approved owner identity;
- no public `workers.dev` or preview route bypasses Access; and
- the KV binding is the production namespace, not a placeholder or preview
  namespace.
