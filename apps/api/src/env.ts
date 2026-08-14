import { z } from "zod";

/**
 * Bindings the API reads. On Cloudflare Workers these arrive per request as
 * `env` (ADR 0027); the Bun development host in `server.ts` adapts
 * `process.env` into the same shape so both hosts share one validated path.
 *
 * `PORT` and `GOOGLE_VERIFY_REDIRECT_URI` are deliberately absent: `PORT` is
 * meaningless on Workers and `GOOGLE_VERIFY_REDIRECT_URI` belongs to
 * `scripts/verify-google-oauth.ts`.
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
  GOOGLE_OAUTH_TOKEN_PATH: z
    .string()
    .trim()
    .min(1, "GOOGLE_OAUTH_TOKEN_PATH is blank. Remove it or set a file path.")
    .default(".data/google-oauth-token.json"),
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
