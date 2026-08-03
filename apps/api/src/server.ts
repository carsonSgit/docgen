import {
  type DocumentEnvelope,
  parseDocumentEnvelope,
} from "@document-playground/domain";
import {
  exportDocument,
  type GoogleProviderClient,
} from "@document-playground/export-service";
import { z } from "zod";

const port = Number(process.env.PORT ?? 3000);

const ExportRequestSchema = z.object({ document: z.unknown() }).strict();

function unavailableProvider(): GoogleProviderClient {
  return {
    async createDocument() {
      throw new Error("Google OAuth is not configured for this local API.");
    },
    async batchUpdate() {
      throw new Error("Google OAuth is not configured for this local API.");
    },
  };
}

export async function handleRequest(
  request: Request,
  provider: GoogleProviderClient = unavailableProvider(),
): Promise<Response> {
  const url = new URL(request.url);

  if (request.method === "GET" && url.pathname === "/health") {
    return Response.json({ status: "ok" });
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

        return exportDocument(document, provider)
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
