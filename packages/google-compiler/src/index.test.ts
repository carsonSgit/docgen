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
    document.content = { type: "doc", content: [{ type: "image" }] };

    expect(() => compileDocument(document)).toThrow(UnsupportedContentError);
    expect(() => compileDocument(document)).toThrow("image");
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
});
