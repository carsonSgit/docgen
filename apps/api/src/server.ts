import {
  type DocumentEnvelope,
  parseDocumentEnvelope,
} from "@document-playground/domain";
import {
  type ExportImageAsset,
  exportDocument,
  type GoogleProviderClient,
  preflightExport,
} from "@document-playground/export-service";
import { z } from "zod";
import { type AccessVerifier, createAccessVerifier } from "./access";
import { type ApiConfig, ApiConfigurationError, parseApiConfig } from "./env";
import { GoogleOAuthService } from "./google-oauth";
import { createGoogleProviderClient } from "./google-provider";
import { KVOAuthStateStore, type OAuthStateStore } from "./oauth-state-store";
import { KVOAuthTokenStore, type OAuthTokenStore } from "./oauth-token-store";
import { createKVRateLimiter, type RateLimiter } from "./rate-limit";

const ExportRequestSchema = z
  .object({
    document: z.unknown(),
    assets: z
      .array(
        z
          .object({
            assetId: z.string().min(1),
            mimeType: z.enum([
              "image/jpeg",
              "image/png",
              "image/webp",
              "image/gif",
            ]),
            data: z.string().regex(/^[A-Za-z0-9+/]*={0,2}$/),
          })
          .strict(),
      )
      .default([]),
  })
  .strict();

/**
 * Everything the request handler needs, built once per host from validated
 * configuration. Nothing here is read from a global inside a request.
 */
export type ApiDependencies = {
  /**
   * Provider used for exports without browser OAuth: built from
   * `GOOGLE_ACCESS_TOKEN` when that binding is set, or injected by tests.
   */
  provider?: GoogleProviderClient;
  oauth: GoogleOAuthService;
  access?: AccessVerifier;
  rateLimiter?: RateLimiter;
  /** Where the OAuth callback sends the browser once tokens are stored. */
  webOrigin: string;
};

/**
 * Host-supplied collaborators the bindings cannot describe. The Bun
 * development host passes a file-backed token store here; the Worker passes
 * nothing and gets the KV store built from its namespace binding.
 */
type ApiHost = {
  requireAccess?: boolean;
  accessVerifier?: AccessVerifier;
  rateLimiter?: RateLimiter;
  stateStore?: OAuthStateStore;
  tokenStore?: OAuthTokenStore;
};

/** Composition root: parses bindings, then wires the OAuth service. */
export function createApiDependencies(
  env: unknown,
  host: ApiHost = {},
): ApiDependencies {
  const config: ApiConfig = parseApiConfig(env);
  if (
    host.requireAccess &&
    (!config.CF_ACCESS_TEAM_DOMAIN || !config.CF_ACCESS_AUDIENCE)
  ) {
    throw new ApiConfigurationError(
      "The API is misconfigured. CF_ACCESS_TEAM_DOMAIN and CF_ACCESS_AUDIENCE are required for the public Worker.",
    );
  }
  return {
    provider: config.GOOGLE_ACCESS_TOKEN
      ? createGoogleProviderClient({ accessToken: config.GOOGLE_ACCESS_TOKEN })
      : undefined,
    oauth: new GoogleOAuthService({
      clientId: config.GOOGLE_CLIENT_ID,
      clientSecret: config.GOOGLE_CLIENT_SECRET,
      redirectUri: config.GOOGLE_REDIRECT_URI,
      stateStore:
        host.stateStore ??
        (config.GOOGLE_OAUTH_TOKENS
          ? new KVOAuthStateStore(config.GOOGLE_OAUTH_TOKENS)
          : undefined),
      tokenStore: host.tokenStore ?? kvTokenStore(config),
    }),
    webOrigin: config.WEB_ORIGIN,
    access:
      host.accessVerifier ??
      (config.CF_ACCESS_TEAM_DOMAIN && config.CF_ACCESS_AUDIENCE
        ? createAccessVerifier(
            config.CF_ACCESS_TEAM_DOMAIN,
            config.CF_ACCESS_AUDIENCE,
          )
        : undefined),
    rateLimiter:
      host.rateLimiter ??
      (config.GOOGLE_OAUTH_TOKENS
        ? createKVRateLimiter(
            config.GOOGLE_OAUTH_TOKENS,
            config.EXPORT_RATE_LIMIT,
          )
        : undefined),
  };
}

/**
 * Workers have no writable filesystem, so a deployment without the namespace
 * binding would silently re-authorize on every cold start. Fail loudly instead.
 */
function kvTokenStore(config: ApiConfig): OAuthTokenStore {
  if (!config.GOOGLE_OAUTH_TOKENS) {
    throw new ApiConfigurationError(
      "The API is misconfigured. GOOGLE_OAUTH_TOKENS is not bound. Add the kv_namespaces binding from wrangler.jsonc so the Google OAuth token survives across isolates.",
    );
  }
  return new KVOAuthTokenStore(config.GOOGLE_OAUTH_TOKENS);
}

export async function handleRequest(
  request: Request,
  dependencies: ApiDependencies,
): Promise<Response> {
  const { access, oauth, provider, rateLimiter, webOrigin } = dependencies;
  const url = new URL(request.url);

  if (access && url.pathname.startsWith("/api/")) {
    try {
      await access(request);
    } catch (error) {
      return Response.json(
        { error: error instanceof Error ? error.message : "Access denied" },
        { status: 401 },
      );
    }
  }

  if (request.method === "GET" && url.pathname === "/health") {
    return Response.json({ status: "ok" });
  }

  if (request.method === "GET" && url.pathname === "/api/auth/google") {
    try {
      return Response.redirect(await oauth.startAuthorization(), 302);
    } catch (error) {
      return Response.json(
        {
          error:
            error instanceof Error ? error.message : "OAuth is unavailable",
        },
        { status: 503 },
      );
    }
  }

  if (
    request.method === "GET" &&
    url.pathname === "/api/auth/google/callback"
  ) {
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    if (!code || !state)
      return Response.json(
        { error: "OAuth callback is missing code or state" },
        { status: 400 },
      );
    try {
      await oauth.completeAuthorization(code, state);
      return Response.redirect(webOrigin, 302);
    } catch (error) {
      return Response.json(
        {
          error:
            error instanceof Error ? error.message : "OAuth callback failed",
        },
        { status: 400 },
      );
    }
  }

  if (request.method === "POST" && url.pathname === "/api/export") {
    if (rateLimiter && !(await rateLimiter(request))) {
      return Response.json(
        { error: "Export rate limit exceeded. Try again later." },
        { status: 429, headers: { "retry-after": "60" } },
      );
    }
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return Response.json(
        { error: "Request body must be valid JSON" },
        { status: 400 },
      );
    }

    const parsed = ExportRequestSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json(
        { error: "Invalid export request", issues: parsed.error.issues },
        { status: 400 },
      );
    }

    let document: DocumentEnvelope;
    try {
      document = parseDocumentEnvelope(parsed.data.document);
    } catch {
      return Response.json(
        { error: "Invalid document envelope" },
        { status: 400 },
      );
    }

    const assets = new Map<string, ExportImageAsset>();
    for (const asset of parsed.data.assets) {
      const bytes = Uint8Array.from(atob(asset.data), (character) =>
        character.charCodeAt(0),
      );
      assets.set(asset.assetId, {
        assetId: asset.assetId,
        blob: new Blob([bytes], { type: asset.mimeType }),
        mimeType: asset.mimeType,
        size: bytes.byteLength,
      });
    }

    try {
      preflightExport(document, assets);
    } catch (error) {
      return Response.json(
        {
          error:
            error instanceof Error
              ? error.message
              : "The document could not be exported",
        },
        { status: 400 },
      );
    }

    if (!provider && !(await oauth.hasAccessToken())) {
      let authorizationUrl: string;
      try {
        authorizationUrl = await oauth.startAuthorization();
      } catch (error) {
        return Response.json(
          {
            error:
              error instanceof Error ? error.message : "OAuth is unavailable",
          },
          { status: 503 },
        );
      }
      return Response.json(
        { error: "Google authorization required", authorizationUrl },
        { status: 401 },
      );
    }

    return exportDocument(
      document,
      provider ?? (await oauth.provider()),
      assets,
    )
      .then((result) => Response.json(result))
      .catch((error: unknown) =>
        Response.json(
          {
            error: error instanceof Error ? error.message : "Export failed",
          },
          { status: 502 },
        ),
      );
  }

  return Response.json({ error: "Not found" }, { status: 404 });
}
