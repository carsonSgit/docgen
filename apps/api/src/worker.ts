import type { Env } from "./env";
import {
  type ApiDependencies,
  createApiDependencies,
  handleRequest,
} from "./server";

/**
 * Bindings are validated once per isolate rather than once per request: the
 * `env` object is stable for the isolate's lifetime, and the OAuth service it
 * wires holds the configured KV-backed stores across requests.
 */
const dependenciesByEnv = new WeakMap<Env, ApiDependencies>();

function dependenciesFor(env: Env): ApiDependencies {
  const cached = dependenciesByEnv.get(env);
  if (cached) return cached;

  const created = createApiDependencies(env, { requireAccess: true });
  dependenciesByEnv.set(env, created);
  return created;
}

/**
 * Cloudflare entrypoint. The static-assets binding serves the SPA from the
 * same origin; `run_worker_first` in wrangler.jsonc sends only `/api/*` and
 * `/health` here. Request handling itself stays in `handleRequest`, which the
 * Bun dev server and the Vitest suite share.
 */
export default {
  fetch(request: Request, env: Env) {
    let dependencies: ApiDependencies;
    try {
      dependencies = dependenciesFor(env);
    } catch (error) {
      // A misconfigured Worker cannot serve any route, so report the offending
      // bindings instead of failing with an opaque runtime error.
      return Response.json(
        {
          error:
            error instanceof Error
              ? error.message
              : "The API is misconfigured.",
        },
        { status: 500 },
      );
    }

    return handleRequest(request, dependencies);
  },
} satisfies ExportedHandler<Env>;
