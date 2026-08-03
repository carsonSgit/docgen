import { createBlankDocument } from "@document-playground/domain";
import { describe, expect, it } from "vitest";
import { compileDocument, UnsupportedContentError } from "./index";

describe("Google Docs compiler", () => {
  it("compiles supported core content deterministically with native requests", () => {
    const document = createBlankDocument();
    document.title = "Export title";
    document.content = {
      type: "doc",
      content: [
        {
          type: "heading",
          attrs: { level: 2 },
          content: [{ type: "text", text: "Hello", marks: [{ type: "bold" }] }],
        },
        { type: "paragraph", content: [{ type: "text", text: "World" }] },
        { type: "pageBreak" },
      ],
    };

    const result = compileDocument(document);

    expect(result.title).toBe("Export title");
    expect(result.requests).toEqual([
      { insertText: { location: { index: 1 }, text: "Hello" } },
      {
        updateTextStyle: {
          range: { startIndex: 1, endIndex: 6 },
          textStyle: { bold: true },
          fields: "bold",
        },
      },
      { insertText: { location: { index: 6 }, text: "\n" } },
      {
        updateParagraphStyle: {
          range: { startIndex: 1, endIndex: 7 },
          paragraphStyle: { namedStyleType: "HEADING_2" },
          fields: "namedStyleType",
        },
      },
      { insertText: { location: { index: 7 }, text: "World" } },
      { insertText: { location: { index: 12 }, text: "\n" } },
      { insertPageBreak: { location: { index: 13 } } },
    ]);
  });

  it("rejects unsupported content before producing requests", () => {
    const document = createBlankDocument();
    document.content = { type: "doc", content: [{ type: "table" }] };

    expect(() => compileDocument(document)).toThrow(UnsupportedContentError);
    expect(() => compileDocument(document)).toThrow("table");
  });

  it("preserves hard breaks as native inserted line breaks", () => {
    const document = createBlankDocument();
    document.content = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: "First" },
            { type: "hardBreak" },
            { type: "text", text: "Second" },
          ],
        },
      ],
    };

    expect(compileDocument(document).requests).toEqual([
      { insertText: { location: { index: 1 }, text: "First" } },
      { insertText: { location: { index: 6 }, text: "\n" } },
      { insertText: { location: { index: 7 }, text: "Second" } },
      { insertText: { location: { index: 13 }, text: "\n" } },
    ]);
  });

  it("compiles images with point sizing at their document position", () => {
    const document = createBlankDocument();
    document.content = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: "Before" },
            {
              type: "image",
              attrs: {
                assetId: "asset_image",
                alt: "Diagram",
                width: 240,
                height: 120,
              },
            },
            { type: "text", text: "After" },
          ],
        },
      ],
    };

    expect(
      compileDocument(
        document,
        new Map([["asset_image", "https://images.test/diagram.png"]]),
      ).requests,
    ).toEqual([
      { insertText: { location: { index: 1 }, text: "Before" } },
      {
        insertInlineImage: {
          location: { index: 7 },
          uri: "https://images.test/diagram.png",
          objectSize: {
            width: { magnitude: 240, unit: "PT" },
            height: { magnitude: 120, unit: "PT" },
          },
        },
      },
      { insertText: { location: { index: 8 }, text: "After" } },
      { insertText: { location: { index: 13 }, text: "\n" } },
    ]);
  });

  it("rejects an image whose uploaded URI is missing", () => {
    const document = createBlankDocument();
    document.content = {
      type: "doc",
      content: [
        {
          type: "image",
          attrs: { assetId: "asset_image", alt: "", width: 10, height: 20 },
        },
      ],
    };

    expect(() => compileDocument(document, new Map())).toThrow(
      "Image asset asset_image is not available for export",
    );
  });
});
