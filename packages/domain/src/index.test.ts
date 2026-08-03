import { describe, expect, it } from "vitest";
import {
  createBlankDocument,
  createImageNode,
  DOCUMENT_VERSION,
  parseDocumentEnvelope,
  validateDocumentEnvelope,
  validateImageDimensions,
} from "./index";

describe("document envelope", () => {
  it("creates a valid blank document with the fixed letter layout", () => {
    const document = createBlankDocument();

    expect(document).toEqual({
      version: DOCUMENT_VERSION,
      title: "Untitled document",
      page: {
        size: "letter",
        width: 612,
        height: 792,
        margins: { top: 72, right: 72, bottom: 72, left: 72 },
      },
      content: { type: "doc", content: [{ type: "paragraph" }] },
    });
    expect(validateDocumentEnvelope(document).success).toBe(true);
  });

  it("parses a valid versioned Tiptap document", () => {
    const document = createBlankDocument();
    document.content = {
      type: "doc",
      content: [
        { type: "paragraph", content: [{ type: "text", text: "Hello" }] },
      ],
    };

    expect(parseDocumentEnvelope(document)).toEqual(document);
  });

  it("returns structured issues for invalid persisted data", () => {
    const result = validateDocumentEnvelope({ version: 999, title: "" });

    expect(result.success).toBe(false);
    if (result.success) {
      throw new Error("Expected invalid document data");
    }

    expect(result.error.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: ["version"] }),
        expect.objectContaining({ path: ["title"] }),
        expect.objectContaining({ path: ["page"] }),
        expect.objectContaining({ path: ["content"] }),
      ]),
    );
  });

  it("accepts a validated inline image with stable asset metadata", () => {
    const document = createBlankDocument();
    document.content = {
      type: "doc",
      content: [
        createImageNode({
          assetId: "asset_01J4N7R8Q2M4K6P8T0V2X4Z6B8",
          alt: "A diagram",
          width: 240,
          height: 120,
        }),
      ],
    };

    expect(parseDocumentEnvelope(document).content.content?.[0]).toEqual(
      document.content.content?.[0],
    );
  });

  it("rejects invalid image dimensions", () => {
    expect(() => validateImageDimensions(0, 10)).toThrow();
    expect(() => validateImageDimensions(10, 2000)).toThrow();
  });
});
