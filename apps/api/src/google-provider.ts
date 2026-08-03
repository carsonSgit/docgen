import type {
  ExportImageAsset,
  GoogleProviderClient,
} from "@document-playground/export-service";
import { z } from "zod";

const CreatedDocumentSchema = z.object({ documentId: z.string().min(1) });
const DriveFileSchema = z.object({ id: z.string().min(1) });

type FetchLike = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>;

const RETRYABLE_STATUS = new Set([408, 429, 500, 502, 503, 504]);

class GoogleProviderError extends Error {
  constructor(
    message: string,
    readonly status: number,
    options?: { cause?: unknown },
  ) {
    super(message, options);
    this.name = "GoogleProviderError";
  }
}

export function createGoogleProviderClient(options: {
  accessToken: string | undefined;
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
    for (let attempt = 0; ; attempt += 1) {
      const response = await fetchImpl(input, {
        ...init,
        headers: {
          authorization: `Bearer ${options.accessToken}`,
          "content-type": "application/json",
          ...init.headers,
        },
      });
      const body: unknown = await response.json().catch(() => undefined);
      if (response.ok) return body;
      if (RETRYABLE_STATUS.has(response.status) && attempt < 2) {
        const retryAfter = Number(response.headers.get("retry-after"));
        const delay = Number.isFinite(retryAfter)
          ? retryAfter * 1000
          : retryDelayMs * 2 ** attempt;
        if (delay > 0)
          await new Promise((resolve) =>
            setTimeout(resolve, Math.min(delay, 1000)),
          );
        continue;
      }
      const detail =
        body && typeof body === "object" && "error" in body
          ? (body as { error?: { message?: unknown } }).error?.message
          : undefined;
      const message =
        response.status === 401
          ? "Google authorization expired or was revoked. Authorize Google again and retry export."
          : `Google API request failed (${response.status})${typeof detail === "string" ? `: ${detail}` : "."}`;
      throw new GoogleProviderError(message, response.status);
    }
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
