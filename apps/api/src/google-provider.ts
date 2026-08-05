import type {
  ExportImageAsset,
  GoogleProviderClient,
} from "@document-playground/export-service";
import { z } from "zod";

const CreatedDocumentSchema = z.object({ documentId: z.string().min(1) });
const DriveFileSchema = z.object({ id: z.string().min(1) });
const RETRYABLE_STATUS = new Set([408, 429, 500, 502, 503, 504]);
const MAX_RETRIES = 2;

type FetchLike = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>;

export function createGoogleProviderClient(options: {
  accessToken: string | undefined;
  refreshAccessToken?: () => Promise<string | undefined>;
  fetchImpl?: FetchLike;
  retryDelayMs?: number;
}): GoogleProviderClient {
  const fetchImpl = options.fetchImpl ?? fetch;
  const retryDelayMs = options.retryDelayMs ?? 100;
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
      async uploadImage() {
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
    let accessToken = options.accessToken;
    let refreshed = false;
    for (let attempt = 0; ; attempt += 1) {
      const response = await fetchImpl(input, {
        ...init,
        headers: {
          authorization: `Bearer ${accessToken}`,
          "content-type": "application/json",
          ...init.headers,
        },
      });
      const body: unknown = await response.json().catch(() => undefined);
      if (response.ok) return body;
      if (response.status === 401 && !refreshed && options.refreshAccessToken) {
        refreshed = true;
        const nextToken = await options.refreshAccessToken();
        if (nextToken) {
          accessToken = nextToken;
          continue;
        }
      }
      if (RETRYABLE_STATUS.has(response.status) && attempt < MAX_RETRIES) {
        const delay = Math.min(retryDelayMs * 2 ** attempt, 1_000);
        if (delay > 0) {
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
        continue;
      }
      const detail =
        body && typeof body === "object" && "error" in body
          ? (body as { error?: { message?: unknown } }).error?.message
          : undefined;
      throw new Error(
        `Google API request failed (${response.status})${typeof detail === "string" ? `: ${detail}` : "."}`,
      );
    }
  }

  async function googleBinaryRequest(
    input: RequestInfo | URL,
    init: RequestInit,
  ): Promise<ArrayBuffer> {
    const response = await fetchImpl(input, {
      ...init,
      headers: {
        authorization: `Bearer ${options.accessToken}`,
        ...init.headers,
      },
    });
    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      throw new Error(
        `Google API request failed (${response.status})${detail ? `: ${detail}` : "."}`,
      );
    }
    return response.arrayBuffer();
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
      return googleRequest(
        `https://docs.googleapis.com/v1/documents/${encodeURIComponent(documentId)}:batchUpdate`,
        { method: "POST", body: JSON.stringify({ requests }) },
      );
    },
    async exportPdf(documentId) {
      const response = await googleBinaryRequest(
        `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(documentId)}/export?mimeType=application%2Fpdf`,
        { method: "GET" },
      );
      return response;
    },
    async getDocument(documentId) {
      return googleRequest(
        `https://docs.googleapis.com/v1/documents/${encodeURIComponent(documentId)}`,
        { method: "GET" },
      );
    },
    async uploadImage(asset: ExportImageAsset) {
      const boundary = "document-playground-image";
      const metadata = JSON.stringify({
        name: `document-playground-${asset.assetId}`,
        mimeType: asset.mimeType,
      });
      const bytes = new Uint8Array(
        await new Response(asset.blob).arrayBuffer(),
      );
      const prefix = `--${boundary}\r\ncontent-type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n--${boundary}\r\ncontent-type: ${asset.mimeType}\r\n\r\n`;
      const suffix = `\r\n--${boundary}--`;
      const body = new Blob([prefix, bytes, suffix], {
        type: `multipart/related; boundary=${boundary}`,
      });
      const uploaded = await googleRequest(
        "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id",
        {
          method: "POST",
          headers: {
            "content-type": `multipart/related; boundary=${boundary}`,
          },
          body,
        },
      );
      const parsed = DriveFileSchema.safeParse(uploaded);
      if (!parsed.success)
        throw new Error("Google returned an invalid image response.");
      await googleRequest(
        `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(parsed.data.id)}/permissions`,
        {
          method: "POST",
          body: JSON.stringify({ role: "reader", type: "anyone" }),
        },
      );
      return {
        uri: `https://drive.google.com/uc?export=download&id=${encodeURIComponent(parsed.data.id)}`,
      };
    },
  };
}
