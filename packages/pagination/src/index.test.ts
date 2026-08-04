import { createBlankDocument } from "@document-playground/domain";
import { describe, expect, it } from "vitest";
import { paginateDocument } from "./index";

describe("pagination adapter", () => {
  it("flows long content onto another fixed-layout page", () => {
    const document = createBlankDocument();
    document.content = {
      type: "doc",
      content: Array.from({ length: 52 }, () => ({ type: "paragraph" })),
    };

    const result = paginateDocument(document);

    expect(result.pageHeight).toBe(648);
    expect(result.pages).toHaveLength(2);
    expect(result.pages[0]?.number).toBe(1);
    expect(result.pages[1]?.content).toHaveLength(1);
    expect(result.pages[1]?.breakBefore).toBe(false);
  });

  it("starts a new page at a semantic manual page break", () => {
    const document = createBlankDocument();
    document.content = {
      type: "doc",
      content: [
        { type: "paragraph" },
        { type: "pageBreak" },
        { type: "paragraph" },
      ],
    };

    const result = paginateDocument(document);

    expect(result.pages).toEqual([
      {
        number: 1,
        content: [{ type: "paragraph" }],
        breakBefore: false,
      },
      {
        number: 2,
        content: [{ type: "paragraph" }],
        breakBefore: true,
      },
    ]);
  });

  it("splits an oversized paragraph across pages", () => {
    const document = createBlankDocument();
    document.content = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: "wrapped line ".repeat(500) }],
        },
      ],
    };

    const result = paginateDocument(document);

    expect(result.pages.length).toBeGreaterThan(1);
    expect(
      result.pages.every((page) =>
        page.content.every(
          (node) => (node.content?.[0]?.text?.length ?? 0) < 5000,
        ),
      ),
    ).toBe(true);
  });

  it("moves a wrapped paragraph child when its first line crosses the boundary", () => {
    const document = createBlankDocument();
    document.content = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: "a".repeat(92) }],
        },
        ...Array.from({ length: 50 }, () => ({
          type: "paragraph",
          content: [{ type: "text", text: "line" }],
        })),
      ],
    };

    const result = paginateDocument(document);

    expect(result.pages).toHaveLength(2);
    expect(result.pages[0]?.content).toHaveLength(50);
    expect(result.pages[1]?.content[0]).toMatchObject({
      type: "paragraph",
      content: [{ type: "text", text: "line" }],
    });
  });

  it("keeps measured hard-break lines on the current page", () => {
    const document = createBlankDocument();
    document.content = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: Array.from({ length: 50 }, (_, index) => ({
            type: index === 0 ? "text" : "hardBreak",
            ...(index === 0 ? { text: "Paragraph 1" } : {}),
          })),
        },
      ],
    };

    const result = paginateDocument(document);

    expect(result.pages).toHaveLength(1);
    expect(result.pages[0]?.content[0]?.content).toHaveLength(50);
  });

  it("uses persisted image height in points for deterministic pagination", () => {
    const document = createBlankDocument();
    document.content = {
      type: "doc",
      content: [
        {
          type: "image",
          attrs: { assetId: "asset_image", alt: "", width: 300, height: 640 },
        },
        { type: "paragraph" },
      ],
    };

    expect(paginateDocument(document).pages).toHaveLength(2);
  });

  it("reserves the paragraph line box around an inline image", () => {
    const document = createBlankDocument();
    document.content = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            {
              type: "image",
              attrs: {
                assetId: "asset_image",
                alt: "",
                width: 468,
                height: 640,
              },
            },
          ],
        },
      ],
    };

    expect(paginateDocument(document).pages).toHaveLength(2);
  });

  it("moves an image nested in a paragraph when it cannot fit", () => {
    const document = createBlankDocument();
    document.content = {
      type: "doc",
      content: [
        ...Array.from({ length: 45 }, () => ({ type: "paragraph" })),
        {
          type: "paragraph",
          content: [
            {
              type: "image",
              attrs: {
                assetId: "asset_image",
                alt: "",
                width: 120,
                height: 120,
              },
            },
          ],
        },
      ],
    };

    const result = paginateDocument(document);

    expect(result.pages).toHaveLength(2);
    expect(result.pages[0]?.content.at(-1)).not.toMatchObject({
      content: [{ type: "image" }],
    });
    expect(result.pages[1]?.content[0]).toMatchObject({
      content: [{ type: "image", attrs: { height: 120 } }],
    });
  });

  it("keeps a heading with its following paragraph at a page boundary", () => {
    const document = createBlankDocument();
    document.content = {
      type: "doc",
      content: [
        ...Array.from({ length: 49 }, () => ({ type: "paragraph" })),
        {
          type: "heading",
          attrs: { level: 2 },
          content: [{ type: "text", text: "Heading" }],
        },
        { type: "paragraph", content: [{ type: "text", text: "Body" }] },
      ],
    };

    const result = paginateDocument(document);

    expect(result.pages).toHaveLength(2);
    expect(result.pages[1]?.content[0]).toMatchObject({
      type: "heading",
      attrs: { level: 2 },
    });
  });
});
