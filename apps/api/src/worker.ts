import { handleRequest } from "./server";

/**
 * Bindings declared in wrangler.jsonc. It is empty today because the request
 * handler still reads configuration from `process.env` at module scope; issue
 * #212 moves those reads onto this type and validates them per request.
 */
type Env = Record<string, never>;

/**
 * Cloudflare entrypoint. Static assets are served before the Worker runs, so
 * this handler only sees the `run_worker_first` routes in wrangler.jsonc.
 * Request handling itself stays in `handleRequest`, which the Bun dev server
 * and the Vitest suite share.
 */
export default {
  fetch(request: Request) {
    return handleRequest(request);
  },
} satisfies ExportedHandler<Env>;
