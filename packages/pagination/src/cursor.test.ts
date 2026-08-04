import { createBlankDocument } from "@document-playground/domain";
import { describe, expect, it } from "vitest";
import {
  createCursorPageRanges,
  cursorAtEnd,
  cursorAtStart,
  documentLength,
  resolveCursor,
} from "./cursor";
import { paginateDocument } from "./index";

describe("canonical pagination cursors", () => {
  it("counts text and atomic content independently of layout", () => {
    const document = createBlankDocument();
    document.content = {
      type: "doc",
      content: [
        { type: "paragraph", content: [{ type: "text", text: "Hello" }] },
        {
          type: "image",
          attrs: { assetId: "asset_image", alt: "", width: 40, height: 40 },
        },
        { type: "pageBreak" },
      ],
    };
    expect(documentLength(document)).toBe(7);
    expect(cursorAtStart()).toEqual({ offset: 0 });
    expect(cursorAtEnd(document)).toEqual({ offset: 7 });
  });

  it("keeps a cursor on the same canonical boundary when geometry reflows pages", () => {
    const document = createBlankDocument();
    document.content = {
      type: "doc",
      content: Array.from({ length: 70 }, () => ({ type: "paragraph" })),
    };
    const first = paginateDocument(document);
    const ranges = createCursorPageRanges(document, first);
    const cursor = { offset: 10 };
    const resolved = resolveCursor(cursor, ranges);
    const reflowed = paginateDocument(document, () => 30);
    const reflowedCursor = resolveCursor(
      cursor,
      createCursorPageRanges(document, reflowed),
    );

    expect(resolved.offset).toBeGreaterThanOrEqual(0);
    expect(reflowedCursor.offset).toBeGreaterThanOrEqual(0);
    expect(cursor).toEqual({ offset: 10 });
  });

  it("represents a manual break and blank page without inventing content", () => {
    const document = createBlankDocument();
    document.content = { type: "doc", content: [{ type: "pageBreak" }] };
    const paginated = paginateDocument(document);
    expect(paginated.pages).toHaveLength(2);
    expect(paginated.cursorRanges).toEqual([
      { pageNumber: 1, start: 0, end: 0 },
      { pageNumber: 2, start: 1, end: 1 },
    ]);
    expect(resolveCursor({ offset: 0 }, paginated.cursorRanges)).toMatchObject({
      pageNumber: 1,
      blankPage: true,
    });
    expect(resolveCursor({ offset: 1 }, paginated.cursorRanges)).toMatchObject({
      pageNumber: 2,
      blankPage: true,
    });
  });
});
