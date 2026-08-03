import {
  type DocumentEnvelope,
  parseDocumentEnvelope,
} from "@document-playground/domain";
import {
  exportDocument,
  type GoogleProviderClient,
} from "@document-playground/export-service";
import { z } from "zod";
import { GoogleOAuthService } from "./google-oauth";
import { createGoogleProviderClient } from "./google-provider";

const port = Number(process.env.PORT ?? 3000);

const ExportRequestSchema = z.object({ document: z.unknown() }).strict();

const defaultProvider = createGoogleProviderClient({
  accessToken: process.env.GOOGLE_ACCESS_TOKEN,
});
const oauthService = new GoogleOAuthService({
  clientId: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  redirectUri:
    process.env.GOOGLE_REDIRECT_URI ??
    `http://localhost:${port}/api/auth/google/callback`,
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
