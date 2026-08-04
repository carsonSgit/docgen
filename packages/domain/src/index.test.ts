import { describe, expect, it } from "vitest";
import {
  BUILT_IN_TEMPLATES,
  createBlankDocument,
  createDocumentFromTemplate,
  createImageNode,
  DEFAULT_RENDER_METRICS,
  DOCUMENT_VERSION,
  findUnsupportedDocumentNode,
  fitImageToWidth,
  isEmptyDocumentSection,
  listDocumentTemplates,
  normalizeRenderMetrics,
  parseDocumentEnvelope,
  parseDocumentTemplate,
  resizeImageDimensions,
  validateDocumentEnvelope,
  validateImageDimensions,
} from "./index";

describe("document envelope", () => {
  it("normalizes partial render metrics with explicit inherited defaults", () => {
    const metrics = normalizeRenderMetrics({
      typography: { headings: { 2: { fontSizePoints: 18 } } },
      page: { margins: { leftPoints: 54 } },
    });

    expect(metrics.typography.headings[2]).toEqual({
      fontSizePoints: 18,
      spaceAbovePoints: 12,
      spaceBelowPoints: 6,
    });
    expect(metrics.page.margins).toEqual({
      topPoints: 72,
      rightPoints: 72,
      bottomPoints: 72,
      leftPoints: 54,
    });
    expect(metrics.alignment.default).toBe(
      DEFAULT_RENDER_METRICS.alignment.default,
    );
  });

  it("rejects unknown render metric fields at the normalization boundary", () => {
    expect(() =>
      normalizeRenderMetrics({ typography: { family: "Arial" } }),
    ).toThrow();
  });

  it("reserves tables and other future nodes outside the core vocabulary", () => {
    expect(
      findUnsupportedDocumentNode(
        { type: "doc", content: [{ type: "table" }] },
        "content",
      ),
    ).toEqual({ path: "content.content[0]", nodeType: "table" });
  });
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
      header: null,
      footer: null,
      content: { type: "doc", content: [{ type: "paragraph" }] },
    });
    expect(validateDocumentEnvelope(document).success).toBe(true);
  });

  it("normalizes a v1 document to empty header and footer sections", () => {
    const v1 = {
      version: 1,
      title: "Legacy document",
      page: createBlankDocument().page,
      content: createBlankDocument().content,
    };

    expect(parseDocumentEnvelope(v1)).toEqual({
      ...v1,
      version: 2,
      header: null,
      footer: null,
    });
  });

  it("normalizes omitted v2 sections to empty sections", () => {
    const {
      header: _header,
      footer: _footer,
      ...withoutSections
    } = createBlankDocument();

    expect(parseDocumentEnvelope(withoutSections)).toEqual(
      createBlankDocument(),
    );
  });

  it("round-trips structured header and footer content", () => {
    const document = {
      ...createBlankDocument(),
      header: {
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [
              { type: "text", text: "Header", marks: [{ type: "bold" }] },
            ],
          },
        ],
      },
      footer: {
        type: "doc",
        content: [
          { type: "paragraph", content: [{ type: "text", text: "Footer" }] },
        ],
      },
    };

    expect(parseDocumentEnvelope(JSON.parse(JSON.stringify(document)))).toEqual(
      document,
    );
  });

  it("rejects malformed header and footer sections", () => {
    expect(
      validateDocumentEnvelope({
        ...createBlankDocument(),
        header: { type: "doc", unexpected: true },
      }).success,
    ).toBe(false);
    expect(
      validateDocumentEnvelope({
        ...createBlankDocument(),
        footer: { type: "doc", content: [{ type: "text", text: 42 }] },
      }).success,
    ).toBe(false);
  });

  it("treats null, omitted, and structurally empty sections as absent", () => {
    expect(isEmptyDocumentSection(null)).toBe(true);
    expect(isEmptyDocumentSection(undefined)).toBe(true);
    expect(
      isEmptyDocumentSection({ type: "doc", content: [{ type: "paragraph" }] }),
    ).toBe(true);
    expect(
      isEmptyDocumentSection({
        type: "doc",
        content: [
          { type: "paragraph", content: [{ type: "text", text: "Header" }] },
        ],
      }),
    ).toBe(false);
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

  it("keeps intrinsic aspect ratio when choosing or resizing rendered points", () => {
    expect(fitImageToWidth(1200, 600, 468)).toEqual({
      width: 468,
      height: 234,
    });
    expect(resizeImageDimensions({ width: 468, height: 234 }, 234)).toEqual({
      width: 234,
      height: 117,
    });
  });

  it("provides validated, versioned built-in templates", () => {
    expect(listDocumentTemplates()).toEqual([
      {
        id: "blank",
        name: "Blank",
        description: "Start with an empty document.",
        version: 1,
      },
      {
        id: "resume",
        name: "Resume",
        description: "A polished starting point for your experience.",
        version: 1,
      },
      {
        id: "meeting-notes",
        name: "Meeting notes",
        description: "Capture an agenda, notes, and action items.",
        version: 1,
      },
      {
        id: "letter",
        name: "Letter",
        description: "A simple structure for writing a letter.",
        version: 1,
      },
    ]);

    for (const template of BUILT_IN_TEMPLATES) {
      expect(validateDocumentEnvelope(template.document).success).toBe(true);
      expect(template.document.page).toEqual({
        size: "letter",
        width: 612,
        height: 792,
        margins: { top: 72, right: 72, bottom: 72, left: 72 },
      });
      expect(parseDocumentTemplate(template)).toEqual(template);
    }
  });

  it("rejects malformed template data at the domain boundary", () => {
    expect(() =>
      parseDocumentTemplate({
        id: "resume",
        name: "Resume",
        version: 1,
        document: { version: 999 },
      }),
    ).toThrow();
  });

  it("creates independent fresh document instances from templates", () => {
    const first = createDocumentFromTemplate("resume");
    const second = createDocumentFromTemplate("resume");

    expect(first).toEqual(second);
    expect(first).not.toBe(second);
    expect(first.content).not.toBe(second.content);
    expect(first.page).not.toBe(second.page);

    const firstParagraph = first.content.content?.[0];
    const secondParagraph = second.content.content?.[0];
    const firstText = firstParagraph?.content?.[0];
    if (firstText) firstText.text = "Changed";
    expect(secondParagraph?.content?.[0]?.text).not.toBe("Changed");
  });
});
