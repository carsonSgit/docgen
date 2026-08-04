import { createBlankDocument } from "@document-playground/domain";
import { describe, expect, it } from "vitest";
import {
  PAGE_FRAGMENT_ATTR,
  PAGE_LIST_ITEM_CONTINUATION_ATTR,
  paginateDocument,
} from "./index";

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

  it("retains hard breaks at split paragraph edges", () => {
    const document = createBlankDocument();
    document.content = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: "First line" },
            ...Array.from({ length: 51 }, () => ({
              type: "hardBreak" as const,
            })),
            { type: "text", text: "Last line" },
          ],
        },
      ],
    };

    const result = paginateDocument(document);
    const allContent = result.pages.flatMap((page) =>
      page.content.flatMap((node) => node.content ?? []),
    );

    expect(result.pages.length).toBeGreaterThan(1);
    expect(allContent.filter((node) => node.type === "hardBreak")).toHaveLength(
      51,
    );
  });

  it("gives hard-break split fragments a shared canonical identity", () => {
    const document = createBlankDocument();
    document.content = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: "First line" },
            ...Array.from({ length: 51 }, () => ({
              type: "hardBreak" as const,
            })),
            { type: "text", text: "Last line" },
          ],
        },
      ],
    };

    const fragments = paginateDocument(document).pages.flatMap(
      (page) => page.content,
    );

    expect(fragments).toHaveLength(2);
    expect(fragments.map((node) => node.attrs?.[PAGE_FRAGMENT_ATTR])).toEqual([
      "0",
      "0",
    ]);
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

  it("splits an oversized list item across pages", () => {
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
                  content: [{ type: "text", text: "Long item ".repeat(900) }],
                },
              ],
            },
          ],
        },
      ],
    };

    const result = paginateDocument(document);

    expect(result.pages.length).toBeGreaterThan(1);
    expect(
      result.pages.every((page) => page.content[0]?.type === "bulletList"),
    ).toBe(true);
  });

  it("continues ordered-list numbering after a page split", () => {
    const document = createBlankDocument();
    document.content = {
      type: "doc",
      content: [
        {
          type: "orderedList",
          content: [
            {
              type: "listItem",
              content: [
                {
                  type: "paragraph",
                  content: [{ type: "text", text: "First item ".repeat(900) }],
                },
              ],
            },
            {
              type: "listItem",
              content: [
                {
                  type: "paragraph",
                  content: [{ type: "text", text: "Second item" }],
                },
              ],
            },
          ],
        },
      ],
    };

    const pages = paginateDocument(document).pages;

    expect(pages.length).toBeGreaterThan(1);
    expect(
      pages
        .flatMap((page) => page.content)
        .find(
          (node) =>
            node.type === "orderedList" &&
            node.content?.some((item) =>
              item.content?.some((child) =>
                child.content?.some((text) => text.text === "Second item"),
              ),
            ),
        ),
    ).toMatchObject({
      type: "orderedList",
      attrs: { start: 2 },
    });
  });

  it("marks non-empty list item continuations for canonical flattening", () => {
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
                  content: [{ type: "text", text: "Long item ".repeat(900) }],
                },
              ],
            },
          ],
        },
      ],
    };

    const pages = paginateDocument(document).pages;
    expect(pages.length).toBeGreaterThan(1);
    expect(pages[1]?.content[0]?.content?.[0]?.attrs).toMatchObject({
      [PAGE_LIST_ITEM_CONTINUATION_ATTR]: true,
    });
  });

  it("splits an oversized list item without dropping nested content", () => {
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
                  content: [{ type: "text", text: "Long item ".repeat(900) }],
                },
                {
                  type: "bulletList",
                  content: [
                    {
                      type: "listItem",
                      content: [
                        {
                          type: "paragraph",
                          content: [{ type: "text", text: "Nested item" }],
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

    const result = paginateDocument(document);
    const nestedItems = result.pages.flatMap((page) =>
      page.content.flatMap(
        (list) => list.content?.flatMap((item) => item.content ?? []) ?? [],
      ),
    );

    expect(result.pages.length).toBeGreaterThan(1);
    expect(nestedItems).toContainEqual(
      expect.objectContaining({ type: "bulletList" }),
    );
  });

  it("splits an oversized nested list paragraph across pages", () => {
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
                  type: "bulletList",
                  content: [
                    {
                      type: "listItem",
                      content: [
                        {
                          type: "paragraph",
                          content: [
                            { type: "text", text: "Nested item ".repeat(900) },
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
    };

    const result = paginateDocument(document);

    expect(result.pages.length).toBeGreaterThan(1);
  });

  it("does not duplicate a parent paragraph across nested list pages", () => {
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
                  type: "bulletList",
                  content: [
                    {
                      type: "listItem",
                      content: [
                        {
                          type: "paragraph",
                          content: [
                            { type: "text", text: "Nested item ".repeat(900) },
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
    };

    const result = paginateDocument(document);
    const parentCount = result.pages
      .flatMap((page) => page.content)
      .flatMap((list) => list.content ?? [])
      .flatMap((item) => item.content ?? [])
      .filter((node) => node.type === "paragraph")
      .flatMap((paragraph) => paragraph.content ?? [])
      .filter((node) => node.text === "Parent").length;

    expect(result.pages.length).toBeGreaterThan(1);
    expect(parentCount).toBe(1);
  });
});
