import { FileOAuthTokenStore } from "./oauth-token-store-file";
import { createApiDependencies, handleRequest } from "./server";

/**
 * Bun development host. It exists apart from `server.ts` so the file-backed
 * token store — and with it `node:fs` and `node:path` — stays unreachable from
 * the Worker entrypoint, which has no writable filesystem (ADR 0027).
 */
const port = Number(process.env.PORT ?? 3000);
if (!Number.isInteger(port) || port <= 0) {
  throw new Error(
    `PORT must be a positive integer, received '${process.env.PORT}'.`,
  );
}

const tokenPath =
  process.env.GOOGLE_OAUTH_TOKEN_PATH?.trim() ||
  ".data/google-oauth-token.json";

// Development-only localhost defaults. They live in the Bun host, not in the
// request handler, so a deployed Worker can never fall back to them.
const dependencies = createApiDependencies(
  {
    ...process.env,
    GOOGLE_REDIRECT_URI:
      process.env.GOOGLE_REDIRECT_URI ||
      `http://localhost:${port}/api/auth/google/callback`,
    WEB_ORIGIN:
      process.env.WEB_ORIGIN || "http://localhost:5173/?oauth=success",
  },
  { tokenStore: new FileOAuthTokenStore(tokenPath) },
);

Bun.serve({
  fetch: (request) => handleRequest(request, dependencies),
  port,
});

console.log(`API listening on http://localhost:${port}`);
