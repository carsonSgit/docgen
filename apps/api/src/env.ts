import { z } from "zod";

/**
 * Bindings the API reads. On Cloudflare Workers these arrive per request as
 * `env` (ADR 0027); the Bun development host in `dev-server.ts` adapts
 * `process.env` into the same shape so both hosts share one validated path.
 *
 * `PORT`, `GOOGLE_VERIFY_REDIRECT_URI`, and `GOOGLE_OAUTH_TOKEN_PATH` are
 * deliberately absent: `PORT` is meaningless on Workers,
 * `GOOGLE_VERIFY_REDIRECT_URI` belongs to `scripts/verify-google-oauth.ts`, and
 * the token file path is read by the Bun development host alone.
 */
export type Env = z.input<typeof EnvSchema>;

/** Configuration the request handler works with, parsed once at the boundary. */
export type ApiConfig = z.output<typeof EnvSchema>;

/** Thrown when a required binding is missing or unusable. */
export class ApiConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ApiConfigurationError";
  }
}

function requiredUrl(name: string, hint: string) {
  return z
    .string({ error: `${name} is not set. ${hint}` })
    .trim()
    .min(1, `${name} is blank. ${hint}`)
    .refine(
      (value) => URL.canParse(value),
      `${name} must be an absolute URL. ${hint}`,
    );
}

/**
 * KV namespace bindings arrive as live objects rather than strings, so they are
 * validated structurally: a misspelled binding name shows up as `undefined`,
 * and a name that collides with a plain variable shows up as a string.
 */
function kvNamespace(name: string, hint: string) {
  return z.custom<KVNamespace>(
    (value) =>
      typeof value === "object" &&
      value !== null &&
      typeof (value as KVNamespace).get === "function" &&
      typeof (value as KVNamespace).put === "function",
    `${name} is not a Workers KV namespace binding. ${hint}`,
  );
}

/** Blank bindings are treated as unset so an empty `.env` entry is not a value. */
const optionalSecret = z
  .string()
  .trim()
  .optional()
  .transform((value) => value || undefined);

const EnvSchema = z.object({
  GOOGLE_CLIENT_ID: optionalSecret,
  GOOGLE_CLIENT_SECRET: optionalSecret,
  GOOGLE_REDIRECT_URI: requiredUrl(
    "GOOGLE_REDIRECT_URI",
    "Set it to this API's OAuth callback (for example https://<worker-host>/api/auth/google/callback) and register the same URI in the Google OAuth client.",
  ),
  WEB_ORIGIN: requiredUrl(
    "WEB_ORIGIN",
    "Set it to the URL the browser should return to after Google authorization completes.",
  ),
  GOOGLE_ACCESS_TOKEN: optionalSecret,
  CF_ACCESS_TEAM_DOMAIN: optionalSecret,
  CF_ACCESS_AUDIENCE: optionalSecret,
  EXPORT_RATE_LIMIT: z.coerce.number().int().positive().default(10),
  GOOGLE_OAUTH_TOKENS: kvNamespace(
    "GOOGLE_OAUTH_TOKENS",
    "Bind the KV namespace declared in wrangler.jsonc; it holds the Google OAuth token between isolates.",
  ).optional(),
});

/**
 * Validates bindings once, at the host boundary. Failure is loud on purpose:
 * a deployed Worker must not silently fall back to localhost defaults.
 */
export function parseApiConfig(env: unknown): ApiConfig {
  const parsed = EnvSchema.safeParse(env);
  if (parsed.success) return parsed.data;

  const details = parsed.error.issues.map((issue) => issue.message).join(" ");
  throw new ApiConfigurationError(`The API is misconfigured. ${details}`);
}
