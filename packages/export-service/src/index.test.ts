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
    document.content = { type: "doc", content: [{ type: "table" }] };

    await expect(exportDocument(document, provider)).rejects.toBeInstanceOf(
      ExportServiceError,
    );
    expect(provider.createDocument).not.toHaveBeenCalled();
  });

  it("uploads local images in document order before inserting native requests", async () => {
    const provider: GoogleProviderClient = {
      createDocument: vi.fn(async () => ({ documentId: "image-doc" })),
      uploadImage: vi.fn(async (asset) => ({
        uri: `https://images.test/${asset.assetId}`,
      })),
      batchUpdate: vi.fn(async () => undefined),
    };
    const document = createBlankDocument();
    document.content = {
      type: "doc",
      content: [
        {
          type: "image",
          attrs: { assetId: "asset_a", alt: "A", width: 100, height: 50 },
        },
        {
          type: "image",
          attrs: { assetId: "asset_b", alt: "B", width: 200, height: 75 },
        },
      ],
    };
    const assets = new Map([
      [
        "asset_a",
        {
          assetId: "asset_a",
          blob: new Blob(["a"], { type: "image/png" }),
          mimeType: "image/png" as const,
          size: 1,
        },
      ],
      [
        "asset_b",
        {
          assetId: "asset_b",
          blob: new Blob(["b"], { type: "image/png" }),
          mimeType: "image/png" as const,
          size: 1,
        },
      ],
    ]);

    await exportDocument(document, provider, assets);

    expect(provider.uploadImage).toHaveBeenNthCalledWith(
      1,
      assets.get("asset_a"),
    );
    expect(provider.uploadImage).toHaveBeenNthCalledWith(
      2,
      assets.get("asset_b"),
    );
    expect(provider.createDocument).toHaveBeenCalledOnce();
    expect(provider.batchUpdate).toHaveBeenCalledWith("image-doc", [
      expect.objectContaining({
        insertInlineImage: expect.objectContaining({
          location: { index: 1 },
          objectSize: {
            width: { magnitude: 100, unit: "PT" },
            height: { magnitude: 50, unit: "PT" },
          },
        }),
      }),
      expect.objectContaining({
        insertInlineImage: expect.objectContaining({
          location: { index: 2 },
          objectSize: {
            width: { magnitude: 200, unit: "PT" },
            height: { magnitude: 75, unit: "PT" },
          },
        }),
      }),
    ]);
  });

  it("rejects a missing image before any provider write", async () => {
    const provider: GoogleProviderClient = {
      createDocument: vi.fn(async () => ({ documentId: "never" })),
      uploadImage: vi.fn(),
      batchUpdate: vi.fn(async () => undefined),
    };
    const document = createBlankDocument();
    document.content = {
      type: "doc",
      content: [
        {
          type: "image",
          attrs: { assetId: "asset_missing", alt: "", width: 10, height: 10 },
        },
      ],
    };

    await expect(exportDocument(document, provider)).rejects.toThrow(
      "asset_missing",
    );
    expect(provider.uploadImage).not.toHaveBeenCalled();
    expect(provider.createDocument).not.toHaveBeenCalled();
  });
});
