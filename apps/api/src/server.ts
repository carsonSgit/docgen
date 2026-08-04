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
import { FileOAuthTokenStore, GoogleOAuthService } from "./google-oauth";
import { createGoogleProviderClient } from "./google-provider";

const port = Number(process.env.PORT ?? 3000);
const EXPORT_FAILURE_MESSAGE =
  "Google export failed. Your local document was not changed; retry when the provider is available.";

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

function decodeBase64Asset(assetId: string, data: string): Uint8Array {
  if (data.length === 0 || data.length % 4 === 1) {
    throw new Error(`Image asset ${assetId} has invalid base64 data.`);
  }
  try {
    const binary = atob(data);
    // Round-tripping rejects non-canonical encodings and makes decoding deterministic.
    if (btoa(binary) !== data) {
      throw new Error("not canonical base64");
    }
    return Uint8Array.from(binary, (character) => character.charCodeAt(0));
  } catch (error) {
    throw new Error(`Image asset ${assetId} has invalid base64 data.`, {
      cause: error,
    });
  }
}

const defaultProvider = createGoogleProviderClient({
  accessToken: process.env.GOOGLE_ACCESS_TOKEN,
});
const oauthService = new GoogleOAuthService({
  clientId: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  redirectUri:
    process.env.GOOGLE_REDIRECT_URI ??
    `http://localhost:${port}/api/auth/google/callback`,
  tokenStore: new FileOAuthTokenStore(
    process.env.GOOGLE_OAUTH_TOKEN_PATH ?? ".data/google-oauth-token.json",
  ),
});

export async function handleRequest(
  request: Request,
  provider?: GoogleProviderClient,
  oauth: GoogleOAuthService = oauthService,
): Promise<Response> {
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
      return Response.redirect(
        process.env.WEB_ORIGIN ?? "http://localhost:5173/?oauth=success",
        302,
      );
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
          if (assets.has(asset.assetId)) {
            return Response.json(
              { error: `Duplicate image asset ${asset.assetId}.` },
              { status: 400 },
            );
          }
          let bytes: Uint8Array;
          try {
            bytes = decodeBase64Asset(asset.assetId, asset.data);
          } catch (error) {
            return Response.json(
              {
                error:
                  error instanceof Error
                    ? error.message
                    : `Image asset ${asset.assetId} has invalid base64 data.`,
              },
              { status: 400 },
            );
          }
          assets.set(asset.assetId, {
            assetId: asset.assetId,
            blob: new Blob([new Uint8Array(bytes).buffer as ArrayBuffer], {
              type: asset.mimeType,
            }),
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

        if (
          !provider &&
          !oauth.hasAccessToken() &&
          !process.env.GOOGLE_ACCESS_TOKEN
        ) {
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

        return exportDocument(
          document,
          provider ??
            (process.env.GOOGLE_ACCESS_TOKEN
              ? defaultProvider
              : oauth.provider()),
          assets,
        )
          .then((result) => Response.json(result))
          .catch(() =>
            Response.json({ error: EXPORT_FAILURE_MESSAGE }, { status: 502 }),
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
  Bun.serve({
    fetch: (request) => handleRequest(request),
    port,
  });

  console.log(`API listening on http://localhost:${port}`);
}
