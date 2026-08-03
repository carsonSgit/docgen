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
});
