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
    ).rejects.toThrow("Google export failed. unauthorized");
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
    expect(provider.batchUpdate).toHaveBeenCalledWith(
      "image-doc",
      expect.arrayContaining([
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
      ]),
    );
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

  it("rejects an asset whose persisted identity differs from the document reference", async () => {
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
          attrs: { assetId: "asset_document", alt: "", width: 10, height: 10 },
        },
      ],
    };
    const mismatchedAsset = {
      assetId: "asset_storage",
      blob: new Blob(["image"], { type: "image/png" }),
      mimeType: "image/png" as const,
      size: 5,
    };

    await expect(
      exportDocument(
        document,
        provider,
        new Map([["asset_document", mismatchedAsset]]),
      ),
    ).rejects.toThrow("mismatched asset identity");
    expect(provider.uploadImage).not.toHaveBeenCalled();
    expect(provider.createDocument).not.toHaveBeenCalled();
  });

  it("uploads images used by repeated header sections", async () => {
    const provider: GoogleProviderClient = {
      createDocument: vi.fn(async () => ({ documentId: "section-image-doc" })),
      uploadImage: vi.fn(async (asset) => ({
        uri: `https://images.test/${asset.assetId}`,
      })),
      batchUpdate: vi
        .fn()
        .mockResolvedValueOnce({
          replies: [{ createHeader: { headerId: "header-1" } }],
        })
        .mockResolvedValueOnce(undefined),
    };
    const document = createBlankDocument();
    document.header = {
      type: "doc",
      content: [
        {
          type: "image",
          attrs: {
            assetId: "asset_header",
            alt: "Header logo",
            width: 120,
            height: 40,
          },
        },
      ],
    };
    const asset = {
      assetId: "asset_header",
      blob: new Blob(["header"], { type: "image/png" }),
      mimeType: "image/png" as const,
      size: 6,
    };

    await exportDocument(document, provider, new Map([[asset.assetId, asset]]));

    expect(provider.uploadImage).toHaveBeenCalledWith(asset);
    expect(provider.batchUpdate).toHaveBeenNthCalledWith(
      2,
      "section-image-doc",
      expect.arrayContaining([
        expect.objectContaining({
          insertInlineImage: expect.objectContaining({
            location: { index: 0, segmentId: "header-1" },
            uri: "https://images.test/asset_header",
          }),
        }),
      ]),
    );
  });

  it("creates header then footer and writes content with returned segment ids", async () => {
    const provider: GoogleProviderClient = {
      createDocument: vi.fn(async () => ({ documentId: "section-doc" })),
      batchUpdate: vi
        .fn()
        .mockResolvedValueOnce({
          replies: [
            { createHeader: { headerId: "header-1" } },
            { createFooter: { footerId: "footer-1" } },
          ],
        })
        .mockResolvedValueOnce(undefined),
    };
    const document = createBlankDocument();
    document.header = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          attrs: { textAlign: "center" },
          content: [{ type: "text", text: "H", marks: [{ type: "bold" }] }],
        },
      ],
    };
    document.footer = {
      type: "doc",
      content: [{ type: "paragraph", content: [{ type: "text", text: "F" }] }],
    };

    await exportDocument(document, provider);

    expect(provider.batchUpdate).toHaveBeenNthCalledWith(1, "section-doc", [
      { createHeader: { type: "DEFAULT" } },
      { createFooter: { type: "DEFAULT" } },
    ]);
    expect(provider.batchUpdate).toHaveBeenNthCalledWith(2, "section-doc", [
      {
        updateDocumentStyle: {
          documentStyle: {
            pageSize: {
              width: { magnitude: 612, unit: "PT" },
              height: { magnitude: 792, unit: "PT" },
            },
            marginTop: { magnitude: 72, unit: "PT" },
            marginBottom: { magnitude: 72, unit: "PT" },
            marginLeft: { magnitude: 72, unit: "PT" },
            marginRight: { magnitude: 72, unit: "PT" },
            marginHeader: { magnitude: 36, unit: "PT" },
            marginFooter: { magnitude: 36, unit: "PT" },
          },
          fields:
            "pageSize,marginTop,marginBottom,marginLeft,marginRight,marginHeader,marginFooter",
        },
      },
      {
        updateParagraphStyle: {
          range: { startIndex: 1, endIndex: 2 },
          paragraphStyle: {
            lineSpacing: 115,
            spaceAbove: { magnitude: 0, unit: "PT" },
            spaceBelow: { magnitude: 0, unit: "PT" },
          },
          fields: "lineSpacing,spaceAbove,spaceBelow",
        },
      },
      {
        updateTextStyle: {
          range: { startIndex: 1, endIndex: 2 },
          textStyle: {
            weightedFontFamily: { fontFamily: "Arial" },
            fontSize: { magnitude: 11, unit: "PT" },
          },
          fields: "weightedFontFamily,fontSize",
        },
      },
      {
        insertText: {
          location: { index: 0, segmentId: "header-1" },
          text: "H",
        },
      },
      expect.objectContaining({
        updateTextStyle: expect.objectContaining({
          range: { startIndex: 0, endIndex: 1, segmentId: "header-1" },
        }),
      }),
      {
        insertText: {
          location: { index: 1, segmentId: "header-1" },
          text: "\n",
        },
      },
      expect.objectContaining({
        updateParagraphStyle: expect.objectContaining({
          range: { startIndex: 0, endIndex: 2, segmentId: "header-1" },
          paragraphStyle: {
            lineSpacing: 115,
            spaceAbove: { magnitude: 0, unit: "PT" },
            spaceBelow: { magnitude: 0, unit: "PT" },
          },
        }),
      }),
      expect.objectContaining({
        updateTextStyle: expect.objectContaining({
          range: { startIndex: 0, endIndex: 2, segmentId: "header-1" },
          textStyle: {
            weightedFontFamily: { fontFamily: "Arial" },
            fontSize: { magnitude: 11, unit: "PT" },
          },
        }),
      }),
      expect.objectContaining({
        updateParagraphStyle: expect.objectContaining({
          range: { startIndex: 0, endIndex: 2, segmentId: "header-1" },
        }),
      }),
      {
        insertText: {
          location: { index: 0, segmentId: "footer-1" },
          text: "F",
        },
      },
      {
        insertText: {
          location: { index: 1, segmentId: "footer-1" },
          text: "\n",
        },
      },
      expect.objectContaining({
        updateParagraphStyle: expect.objectContaining({
          range: { startIndex: 0, endIndex: 2, segmentId: "footer-1" },
        }),
      }),
      expect.objectContaining({
        updateTextStyle: expect.objectContaining({
          range: { startIndex: 0, endIndex: 2, segmentId: "footer-1" },
        }),
      }),
    ]);
  });

  it("rejects unsupported footer content before creating a Google document", async () => {
    const provider: GoogleProviderClient = {
      createDocument: vi.fn(async () => ({ documentId: "never" })),
      batchUpdate: vi.fn(async () => undefined),
    };
    const document = createBlankDocument();
    document.footer = { type: "doc", content: [{ type: "table" }] };

    await expect(exportDocument(document, provider)).rejects.toThrow("table");
    expect(provider.createDocument).not.toHaveBeenCalled();
    expect(provider.batchUpdate).not.toHaveBeenCalled();
  });
});
