import { createBlankDocument } from "@document-playground/domain";
import { describe, expect, it } from "vitest";
import { compileDocument, UnsupportedContentError } from "./index";

describe("Google Docs compiler", () => {
  it("uses the document's structural trailing newline for the final paragraph", () => {
    const document = createBlankDocument();
    document.content = {
      type: "doc",
      content: [
        { type: "paragraph", content: [{ type: "text", text: "Hello" }] },
      ],
    };

    const requests = compileDocument(document).requests;

    expect(
      requests.some(
        (request) =>
          "insertText" in request && request.insertText.text === "\n",
      ),
    ).toBe(false);
  });

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
            spaceBelow: { magnitude: 6, unit: "PT" },
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

  it("applies the calibrated link appearance in native Docs", () => {
    const document = createBlankDocument();
    document.content = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: "Read more",
              marks: [
                { type: "link", attrs: { href: "https://example.test" } },
              ],
            },
          ],
        },
      ],
    };

    expect(compileDocument(document).requests).toContainEqual({
      updateTextStyle: {
        range: { startIndex: 1, endIndex: 10 },
        textStyle: {
          link: { url: "https://example.test" },
          foregroundColor: {
            color: {
              rgbColor: { red: 17 / 255, green: 85 / 255, blue: 204 / 255 },
            },
          },
          underline: true,
        },
        fields: "link,foregroundColor,underline",
      },
    });
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

  it("uses the native Google Docs enum for justified paragraphs", () => {
    const document = createBlankDocument();
    document.content = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          attrs: { textAlign: "justify" },
          content: [{ type: "text", text: "Justified" }],
        },
      ],
    };

    expect(compileDocument(document).requests).toContainEqual({
      updateParagraphStyle: {
        range: { startIndex: 1, endIndex: 11 },
        paragraphStyle: { alignment: "JUSTIFIED" },
        fields: "alignment",
      },
    });
  });

  it("rejects unsupported paragraph alignment before producing requests", () => {
    const document = createBlankDocument();
    document.content = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          attrs: { textAlign: "start" },
          content: [{ type: "text", text: "Unsupported alignment" }],
        },
      ],
    };

    expect(() => compileDocument(document)).toThrow(UnsupportedContentError);
    expect(() => compileDocument(document)).toThrow(
      "content.content[0].attrs.textAlign",
    );
    expect(() => compileDocument(document)).toThrow("start");
  });

  it("rejects unsupported header content before section compilation", () => {
    const document = createBlankDocument();
    document.header = { type: "doc", content: [{ type: "table" }] };

    expect(() => compileDocument(document)).toThrow("header.content[0]");
    expect(() => compileDocument(document)).toThrow("table");
  });
});

describe("native list render metrics", () => {
  it("rebases a deeper nested sibling marker after the prior marker removes tabs", () => {
    const document = createBlankDocument();
    document.content = {
      type: "doc",
      content: [
        {
          type: "bulletList",
          content: [
            {
              type: "listItem",
              content: [
                { type: "paragraph", content: [{ type: "text", text: "P" }] },
                {
                  type: "orderedList",
                  content: [
                    {
                      type: "listItem",
                      content: [
                        {
                          type: "paragraph",
                          content: [{ type: "text", text: "C" }],
                        },
                        {
                          type: "bulletList",
                          content: [
                            {
                              type: "listItem",
                              content: [
                                {
                                  type: "paragraph",
                                  content: [{ type: "text", text: "G1" }],
                                },
                              ],
                            },
                            {
                              type: "listItem",
                              content: [
                                {
                                  type: "paragraph",
                                  content: [{ type: "text", text: "G2" }],
                                },
                              ],
                            },
                          ],
                        },
                      ],
                    },
                  ],
                },
              ],
            },
          ],
        },
        { type: "paragraph", content: [{ type: "text", text: "After" }] },
      ],
    };
    const markers = compileDocument(document).requests.filter(
      (request) => "createParagraphBullets" in request,
    );
    expect(markers).toEqual(
      expect.arrayContaining([
        {
          createParagraphBullets: {
            range: { startIndex: 8, endIndex: 11 },
            bulletPreset: "BULLET_DISC_CIRCLE_SQUARE",
          },
        },
        {
          createParagraphBullets: {
            range: { startIndex: 9, endIndex: 12 },
            bulletPreset: "BULLET_DISC_CIRCLE_SQUARE",
          },
        },
      ]),
    );
  });
  it("does not add a blank native paragraph after a list item", () => {
    const document = createBlankDocument();
    document.content = {
      type: "doc",
      content: [
        {
          type: "bulletList",
          content: [
            {
              type: "listItem",
              content: [
                {
                  type: "paragraph",
                  content: [{ type: "text", text: "One item" }],
                },
              ],
            },
          ],
        },
      ],
    };

    const insertedText = compileDocument(document).requests.filter(
      (request) => "insertText" in request,
    );

    expect(insertedText).toEqual([
      { insertText: { location: { index: 1 }, text: "One item" } },
      { insertText: { location: { index: 9 }, text: "\n" } },
    ]);
  });

  it("sets list spacing mode explicitly for native Docs", () => {
    const document = createBlankDocument();
    document.content = {
      type: "doc",
      content: [
        {
          type: "bulletList",
          content: [
            {
              type: "listItem",
              content: [
                {
                  type: "paragraph",
                  content: [{ type: "text", text: "First item" }],
                },
              ],
            },
          ],
        },
      ],
    };

    const result = compileDocument(document);
    const paragraph = result.requests.find(
      (request) =>
        "updateParagraphStyle" in request &&
        request.updateParagraphStyle.paragraphStyle.spacingMode ===
          "COLLAPSE_LISTS",
    );

    expect(paragraph).toEqual({
      updateParagraphStyle: {
        range: { startIndex: 1, endIndex: 12 },
        paragraphStyle: {
          lineSpacing: 115,
          spaceAbove: { magnitude: 0, unit: "PT" },
          spaceBelow: { magnitude: 0, unit: "PT" },
          spacingMode: "COLLAPSE_LISTS",
          indentStart: { magnitude: 27, unit: "PT" },
          indentFirstLine: { magnitude: -18, unit: "PT" },
        },
        fields:
          "lineSpacing,spaceAbove,spaceBelow,spacingMode,indentStart,indentFirstLine",
      },
    });
  });

  it("increases native list indentation for nested levels", () => {
    const document = createBlankDocument();
    document.content = {
      type: "doc",
      content: [
        {
          type: "bulletList",
          content: [
            {
              type: "listItem",
              content: [
                {
                  type: "paragraph",
                  content: [{ type: "text", text: "Parent" }],
                },
                {
                  type: "orderedList",
                  content: [
                    {
                      type: "listItem",
                      content: [
                        {
                          type: "paragraph",
                          content: [{ type: "text", text: "Child" }],
                        },
                      ],
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    };

    const styles = compileDocument(document).requests.filter(
      (request) =>
        "updateParagraphStyle" in request &&
        request.updateParagraphStyle.paragraphStyle.indentStart,
    );

    expect(styles).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          updateParagraphStyle: expect.objectContaining({
            paragraphStyle: expect.objectContaining({
              indentStart: { magnitude: 27, unit: "PT" },
            }),
          }),
        }),
        expect.objectContaining({
          updateParagraphStyle: expect.objectContaining({
            paragraphStyle: expect.objectContaining({
              indentStart: { magnitude: 54, unit: "PT" },
            }),
          }),
        }),
      ]),
    );
  });

  it("preserves nested list levels for native Docs", () => {
    const document = createBlankDocument();
    document.content = {
      type: "doc",
      content: [
        {
          type: "bulletList",
          content: [
            {
              type: "listItem",
              content: [
                {
                  type: "paragraph",
                  content: [{ type: "text", text: "Parent" }],
                },
                {
                  type: "orderedList",
                  content: [
                    {
                      type: "listItem",
                      content: [
                        {
                          type: "paragraph",
                          content: [{ type: "text", text: "Child" }],
                        },
                      ],
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    };

    const result = compileDocument(document);
    expect(result.requests).toContainEqual({
      insertText: { location: { index: 8 }, text: "\t" },
    });
    expect(result.requests).toContainEqual({
      insertText: { location: { index: 9 }, text: "Child" },
    });
    expect(result.requests).toContainEqual({
      insertText: { location: { index: 14 }, text: "\n" },
    });
  });

  it("rebases nested sibling items after each marker removes indentation", () => {
    const document = createBlankDocument();
    document.content = {
      type: "doc",
      content: [
        {
          type: "bulletList",
          content: [
            {
              type: "listItem",
              content: [
                {
                  type: "paragraph",
                  content: [{ type: "text", text: "Parent" }],
                },
                {
                  type: "orderedList",
                  content: [
                    {
                      type: "listItem",
                      content: [
                        {
                          type: "paragraph",
                          content: [{ type: "text", text: "First" }],
                        },
                      ],
                    },
                    {
                      type: "listItem",
                      content: [
                        {
                          type: "paragraph",
                          content: [{ type: "text", text: "Second" }],
                        },
                      ],
                    },
                  ],
                },
              ],
            },
          ],
        },
        { type: "pageBreak" },
        { type: "paragraph", content: [{ type: "text", text: "After" }] },
      ],
    };

    const requests = compileDocument(document).requests;
    expect(requests).toContainEqual({
      insertText: { location: { index: 14 }, text: "\t" },
    });
    expect(requests).toContainEqual({
      insertText: { location: { index: 15 }, text: "Second" },
    });
    expect(requests).toContainEqual({
      insertPageBreak: { location: { index: 21 } },
    });
    expect(requests).toContainEqual({
      insertText: { location: { index: 22 }, text: "After" },
    });

    const nestedMarkerIndexes = requests
      .filter((request) => "createParagraphBullets" in request)
      .map((request) => request.createParagraphBullets.range.startIndex);
    expect(nestedMarkerIndexes).toEqual([9, 15, 1]);
  });

  it("scopes native bullets to each list item's own paragraph", () => {
    const document = createBlankDocument();
    document.content = {
      type: "doc",
      content: [
        {
          type: "bulletList",
          content: [
            {
              type: "listItem",
              content: [
                {
                  type: "paragraph",
                  content: [{ type: "text", text: "Parent" }],
                },
                {
                  type: "orderedList",
                  content: [
                    {
                      type: "listItem",
                      content: [
                        {
                          type: "paragraph",
                          content: [{ type: "text", text: "Child" }],
                        },
                      ],
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    };

    const bulletRequests = compileDocument(document).requests.filter(
      (request) => "createParagraphBullets" in request,
    );

    expect(bulletRequests).toEqual([
      {
        createParagraphBullets: {
          range: { startIndex: 9, endIndex: 15 },
          bulletPreset: "NUMBERED_DECIMAL_ALPHA_ROMAN",
        },
      },
      {
        createParagraphBullets: {
          range: { startIndex: 1, endIndex: 8 },
          bulletPreset: "BULLET_DISC_CIRCLE_SQUARE",
        },
      },
    ]);
  });

  it("scopes nested list paragraph styles to non-overlapping item ranges", () => {
    const document = createBlankDocument();
    document.content = {
      type: "doc",
      content: [
        {
          type: "bulletList",
          content: [
            {
              type: "listItem",
              content: [
                {
                  type: "paragraph",
                  content: [{ type: "text", text: "Parent" }],
                },
                {
                  type: "orderedList",
                  attrs: { start: 3 },
                  content: [
                    {
                      type: "listItem",
                      content: [
                        {
                          type: "paragraph",
                          content: [{ type: "text", text: "Ordered" }],
                        },
                      ],
                    },
                  ],
                },
                {
                  type: "bulletList",
                  content: [
                    {
                      type: "listItem",
                      content: [
                        {
                          type: "paragraph",
                          content: [{ type: "text", text: "Sibling" }],
                        },
                      ],
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    };

    const requests = compileDocument(document).requests;
    const paragraphRanges = requests
      .filter((request) => "updateParagraphStyle" in request)
      .filter(
        (request) =>
          request.updateParagraphStyle.paragraphStyle.spacingMode ===
          "COLLAPSE_LISTS",
      )
      .map((request) => request.updateParagraphStyle.range)
      .filter((range) => range.startIndex > 0);
    const bulletRequests = requests.filter(
      (request) => "createParagraphBullets" in request,
    );

    expect(paragraphRanges).toEqual(
      expect.arrayContaining([
        { startIndex: 1, endIndex: 8 },
        { startIndex: 9, endIndex: 17 },
        { startIndex: 17, endIndex: 25 },
      ]),
    );
    expect(bulletRequests).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          createParagraphBullets: expect.objectContaining({
            range: { startIndex: 1, endIndex: 8 },
            bulletPreset: "BULLET_DISC_CIRCLE_SQUARE",
          }),
        }),
        expect.objectContaining({
          createParagraphBullets: expect.objectContaining({
            range: { startIndex: 9, endIndex: 17 },
            bulletPreset: "NUMBERED_DECIMAL_ALPHA_ROMAN",
          }),
        }),
        expect.objectContaining({
          createParagraphBullets: expect.objectContaining({
            range: { startIndex: 17, endIndex: 25 },
            bulletPreset: "BULLET_DISC_CIRCLE_SQUARE",
          }),
        }),
      ]),
    );
  });

  it("keeps one native marker range per logical list while separating adjacent lists", () => {
    const document = createBlankDocument();
    document.content = {
      type: "doc",
      content: [
        {
          type: "orderedList",
          attrs: { start: 3 },
          content: [
            {
              type: "listItem",
              content: [
                { type: "paragraph", content: [{ type: "text", text: "One" }] },
              ],
            },
            {
              type: "listItem",
              content: [
                { type: "paragraph", content: [{ type: "text", text: "Two" }] },
              ],
            },
          ],
        },
        {
          type: "orderedList",
          attrs: { start: 9 },
          content: [
            {
              type: "listItem",
              content: [
                {
                  type: "paragraph",
                  content: [{ type: "text", text: "Restart" }],
                },
              ],
            },
          ],
        },
        {
          type: "bulletList",
          content: [
            {
              type: "listItem",
              content: [
                {
                  type: "paragraph",
                  content: [{ type: "text", text: "Separate" }],
                },
              ],
            },
          ],
        },
      ],
    };

    const markerRequests = compileDocument(document).requests.filter(
      (request) => "createParagraphBullets" in request,
    );

    expect(markerRequests).toEqual([
      {
        createParagraphBullets: {
          range: { startIndex: 1, endIndex: 9 },
          bulletPreset: "NUMBERED_DECIMAL_ALPHA_ROMAN",
        },
      },
      {
        createParagraphBullets: {
          range: { startIndex: 9, endIndex: 17 },
          bulletPreset: "NUMBERED_DECIMAL_ALPHA_ROMAN",
        },
      },
      {
        createParagraphBullets: {
          range: { startIndex: 17, endIndex: 26 },
          bulletPreset: "BULLET_DISC_CIRCLE_SQUARE",
        },
      },
    ]);
  });
});
