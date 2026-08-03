import { createBlankDocument } from "@document-playground/domain";
import { describe, expect, it, vi } from "vitest";
import {
  ExportServiceError,
  exportDocument,
  type GoogleProviderClient,
} from "./index";

describe("export service", () => {
  it("creates a new document and returns its URL without changing local data", async () => {
    const provider: GoogleProviderClient = {
      createDocument: vi.fn(async () => ({ documentId: "abc/123" })),
      batchUpdate: vi.fn(async () => undefined),
    };
    const document = createBlankDocument();
    document.title = "My document";
    const before = structuredClone(document);

    const result = await exportDocument(document, provider);

    expect(result.url).toBe(
      "https://docs.google.com/document/d/abc%2F123/edit",
    );
    expect(provider.createDocument).toHaveBeenCalledWith("My document");
    expect(document).toEqual(before);
  });

  it("returns an actionable provider error", async () => {
    const provider: GoogleProviderClient = {
      createDocument: vi.fn(async () => {
        throw new Error("unauthorized");
      }),
      batchUpdate: vi.fn(async () => undefined),
    };

    await expect(
      exportDocument(createBlankDocument(), provider),
    ).rejects.toThrow("Google export failed");
  });

  it("rejects unsupported content before the provider is called", async () => {
    const provider: GoogleProviderClient = {
      createDocument: vi.fn(async () => ({ documentId: "never" })),
      batchUpdate: vi.fn(async () => undefined),
    };
    const document = createBlankDocument();
    document.content = { type: "doc", content: [{ type: "image" }] };

    await expect(exportDocument(document, provider)).rejects.toBeInstanceOf(
      ExportServiceError,
    );
    expect(provider.createDocument).not.toHaveBeenCalled();
  });
});
