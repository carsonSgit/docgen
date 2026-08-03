import type { DocumentEnvelope } from "@document-playground/domain";
import { z } from "zod";

const ExportResponseSchema = z.object({
  documentId: z.string().min(1),
  url: z.string().url(),
});

const ExportErrorSchema = z.object({ error: z.string().min(1) });
type FetchLike = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>;

export async function requestExport(
  document: DocumentEnvelope,
  fetchImpl: FetchLike = fetch,
): Promise<{ documentId: string; url: string }> {
  let response: Response;
  try {
    response = await fetchImpl("/api/export", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ document }),
    });
  } catch (error) {
    throw new Error("Export could not connect to the local API.", {
      cause: error,
    });
  }

  const payload: unknown = await response.json();
  if (!response.ok) {
    const parsed = ExportErrorSchema.safeParse(payload);
    throw new Error(parsed.success ? parsed.data.error : "Export failed.");
  }

  const parsed = ExportResponseSchema.safeParse(payload);
  if (!parsed.success) throw new Error("The export response was invalid.");
  return parsed.data;
}
