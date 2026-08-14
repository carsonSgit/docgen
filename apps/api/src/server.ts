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
import { type ApiConfig, parseApiConfig } from "./env";
import { FileOAuthTokenStore, GoogleOAuthService } from "./google-oauth";
import { createGoogleProviderClient } from "./google-provider";

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
  /** Where the OAuth callback sends the browser once tokens are stored. */
  webOrigin: string;
};

/** Composition root: parses bindings, then wires the OAuth service. */
export function createApiDependencies(env: unknown): ApiDependencies {
  const config: ApiConfig = parseApiConfig(env);
  return {
    provider: config.GOOGLE_ACCESS_TOKEN
      ? createGoogleProviderClient({ accessToken: config.GOOGLE_ACCESS_TOKEN })
      : undefined,
    oauth: new GoogleOAuthService({
      clientId: config.GOOGLE_CLIENT_ID,
      clientSecret: config.GOOGLE_CLIENT_SECRET,
      redirectUri: config.GOOGLE_REDIRECT_URI,
      tokenStore: new FileOAuthTokenStore(config.GOOGLE_OAUTH_TOKEN_PATH),
    }),
    webOrigin: config.WEB_ORIGIN,
  };
}

export async function handleRequest(
  request: Request,
  dependencies: ApiDependencies,
): Promise<Response> {
  const { oauth, provider, webOrigin } = dependencies;
  const url = new URL(request.url);

  if (request.method === "GET" && url.pathname === "/health") {
    return Response.json({ status: "ok" });
  }

  if (request.method === "GET" && url.pathname === "/api/auth/google") {
    try {
      return Response.redirect(oauth.startAuthorization(), 302);
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
    return request
      .json()
      .then((body) => {
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

        if (!provider && !oauth.hasAccessToken()) {
          let authorizationUrl: string;
          try {
            authorizationUrl = oauth.startAuthorization();
          } catch (error) {
            return Response.json(
              {
                error:
                  error instanceof Error
                    ? error.message
                    : "OAuth is unavailable",
              },
              { status: 503 },
            );
          }
          return Response.json(
            { error: "Google authorization required", authorizationUrl },
            { status: 401 },
          );
        }

        return exportDocument(document, provider ?? oauth.provider(), assets)
          .then((result) => Response.json(result))
          .catch((error: unknown) =>
            Response.json(
              {
                error: error instanceof Error ? error.message : "Export failed",
              },
              { status: 502 },
            ),
          );
      })
      .catch(() =>
        Response.json(
          { error: "Request body must be valid JSON" },
          { status: 400 },
        ),
      );
  }

  return Response.json({ error: "Not found" }, { status: 404 });
}

if (import.meta.main) {
  const port = Number(process.env.PORT ?? 3000);
  if (!Number.isInteger(port) || port <= 0) {
    throw new Error(
      `PORT must be a positive integer, received '${process.env.PORT}'.`,
    );
  }

  // Development-only localhost defaults. They live in the Bun host, not in the
  // request handler, so a deployed Worker can never fall back to them.
  const dependencies = createApiDependencies({
    ...process.env,
    GOOGLE_REDIRECT_URI:
      process.env.GOOGLE_REDIRECT_URI ||
      `http://localhost:${port}/api/auth/google/callback`,
    WEB_ORIGIN:
      process.env.WEB_ORIGIN || "http://localhost:5173/?oauth=success",
  });

  Bun.serve({
    fetch: (request) => handleRequest(request, dependencies),
    port,
  });

  console.log(`API listening on http://localhost:${port}`);
}
