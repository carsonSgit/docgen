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
          paragraphStyle: {
            namedStyleType: "HEADING_2",
            lineSpacing: 115,
            spaceAbove: { magnitude: 12, unit: "PT" },
            spaceBelow: { magnitude: 4, unit: "PT" },
            keepWithNext: true,
            keepLinesTogether: true,
          },
          fields:
            "namedStyleType,lineSpacing,spaceAbove,spaceBelow,keepWithNext,keepLinesTogether",
        },
      },
      {
        updateTextStyle: {
          range: { startIndex: 1, endIndex: 7 },
          textStyle: {
            weightedFontFamily: { fontFamily: "Arial" },
            fontSize: { magnitude: 16, unit: "PT" },
            bold: true,
          },
          fields: "weightedFontFamily,fontSize,bold",
        },
      },
      { insertText: { location: { index: 7 }, text: "World" } },
      { insertText: { location: { index: 12 }, text: "\n" } },
      {
        updateParagraphStyle: {
          range: { startIndex: 7, endIndex: 13 },
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
          range: { startIndex: 7, endIndex: 13 },
          textStyle: {
            weightedFontFamily: { fontFamily: "Arial" },
            fontSize: { magnitude: 11, unit: "PT" },
          },
          fields: "weightedFontFamily,fontSize",
        },
      },
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
      { insertText: { location: { index: 1 }, text: "First" } },
      { insertText: { location: { index: 6 }, text: "\n" } },
      { insertText: { location: { index: 7 }, text: "Second" } },
      { insertText: { location: { index: 13 }, text: "\n" } },
      {
        updateParagraphStyle: {
          range: { startIndex: 1, endIndex: 14 },
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
          range: { startIndex: 1, endIndex: 14 },
          textStyle: {
            weightedFontFamily: { fontFamily: "Arial" },
            fontSize: { magnitude: 11, unit: "PT" },
          },
          fields: "weightedFontFamily,fontSize",
        },
      },
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
      {
        updateParagraphStyle: {
          range: { startIndex: 1, endIndex: 14 },
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
          range: { startIndex: 1, endIndex: 14 },
          textStyle: {
            weightedFontFamily: { fontFamily: "Arial" },
            fontSize: { magnitude: 11, unit: "PT" },
          },
          fields: "weightedFontFamily,fontSize",
        },
      },
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

  it("compiles header and footer in deterministic segment-local order", () => {
    const document = createBlankDocument();
    document.header = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          attrs: { textAlign: "center" },
          content: [
            { type: "text", text: "Header", marks: [{ type: "bold" }] },
          ],
        },
      ],
    };
    document.footer = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          attrs: { textAlign: "right" },
          content: [{ type: "text", text: "Footer" }],
        },
      ],
    };

    expect(compileDocument(document).sections).toEqual({
      header: [
        { insertText: { location: { index: 0 }, text: "Header" } },
        {
          updateTextStyle: {
            range: { startIndex: 0, endIndex: 6 },
            textStyle: { bold: true },
            fields: "bold",
          },
        },
        { insertText: { location: { index: 6 }, text: "\n" } },
        {
          updateParagraphStyle: {
            range: { startIndex: 0, endIndex: 7 },
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
            range: { startIndex: 0, endIndex: 7 },
            textStyle: {
              weightedFontFamily: { fontFamily: "Arial" },
              fontSize: { magnitude: 11, unit: "PT" },
            },
            fields: "weightedFontFamily,fontSize",
          },
        },
        {
          updateParagraphStyle: {
            range: { startIndex: 0, endIndex: 7 },
            paragraphStyle: { alignment: "CENTER" },
            fields: "alignment",
          },
        },
      ],
      footer: [
        { insertText: { location: { index: 0 }, text: "Footer" } },
        { insertText: { location: { index: 6 }, text: "\n" } },
        {
          updateParagraphStyle: {
            range: { startIndex: 0, endIndex: 7 },
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
            range: { startIndex: 0, endIndex: 7 },
            textStyle: {
              weightedFontFamily: { fontFamily: "Arial" },
              fontSize: { magnitude: 11, unit: "PT" },
            },
            fields: "weightedFontFamily,fontSize",
          },
        },
        {
          updateParagraphStyle: {
            range: { startIndex: 0, endIndex: 7 },
            paragraphStyle: { alignment: "RIGHT" },
            fields: "alignment",
          },
        },
      ],
    });
  });

  it("rejects unsupported header content before section compilation", () => {
    const document = createBlankDocument();
    document.header = { type: "doc", content: [{ type: "table" }] };

    expect(() => compileDocument(document)).toThrow("header.content[0]");
    expect(() => compileDocument(document)).toThrow("table");
  });
});
