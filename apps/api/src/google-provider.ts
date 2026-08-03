import type { GoogleProviderClient } from "@document-playground/export-service";
import { z } from "zod";

const CreatedDocumentSchema = z.object({ documentId: z.string().min(1) });

type FetchLike = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>;

export function createGoogleProviderClient(options: {
  accessToken: string | undefined;
  fetchImpl?: FetchLike;
}): GoogleProviderClient {
  const fetchImpl = options.fetchImpl ?? fetch;
  if (!options.accessToken) {
    return {
      async createDocument() {
        throw new Error(
          "Google export is not configured. Set GOOGLE_ACCESS_TOKEN for integration verification.",
        );
      },
      async batchUpdate() {
        throw new Error(
          "Google export is not configured. Set GOOGLE_ACCESS_TOKEN for integration verification.",
        );
      },
    };
  }

  async function googleRequest(
    input: RequestInfo | URL,
    init: RequestInit,
  ): Promise<unknown> {
    const response = await fetchImpl(input, {
      ...init,
      headers: {
        authorization: `Bearer ${options.accessToken}`,
        "content-type": "application/json",
        ...init.headers,
      },
    });
    const body: unknown = await response.json();
    if (!response.ok) {
      throw new Error(`Google API request failed (${response.status}).`);
    }
    return body;
  }

  return {
    async createDocument(title) {
      const body = await googleRequest(
        "https://docs.googleapis.com/v1/documents",
        {
          method: "POST",
          body: JSON.stringify({ title }),
        },
      );
      const parsed = CreatedDocumentSchema.safeParse(body);
      if (!parsed.success)
        throw new Error("Google returned an invalid document response.");
      return parsed.data;
    },
    async batchUpdate(documentId, requests) {
      await googleRequest(
        `https://docs.googleapis.com/v1/documents/${encodeURIComponent(documentId)}:batchUpdate`,
        { method: "POST", body: JSON.stringify({ requests }) },
      );
    },
  };
}
