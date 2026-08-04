import { describe, expect, it } from "vitest";
import { fromLexicalDocument, toLexicalDocument } from "./lexical-mapping";

describe("Lexical list mapping", () => {
  it("preserves ordered-list starts used by paginated editor fragments", () => {
    const document = {
      type: "doc" as const,
      content: [
        {
          type: "orderedList" as const,
          attrs: { start: 2 },
          content: [
            {
              type: "listItem" as const,
              content: [
                {
                  type: "paragraph" as const,
                  content: [{ type: "text" as const, text: "Second item" }],
                },
              ],
            },
          ],
        },
      ],
    };

    expect(fromLexicalDocument(toLexicalDocument(document))).toEqual(document);
  });
});

describe("Lexical document boundary validation", () => {
  it("rejects a serialized document whose root is not a root node", () => {
    expect(() =>
      fromLexicalDocument({
        root: { type: "paragraph", children: [] },
      }),
    ).toThrow("Lexical serialized document root must have type 'root'");
  });

  it("rejects unsupported text-format bits instead of dropping them", () => {
    expect(() =>
      fromLexicalDocument({
        root: {
          type: "root",
          children: [
            {
              type: "paragraph",
              children: [{ type: "text", text: "x", format: 128 }],
            },
          ],
        },
      }),
    ).toThrow("Unsupported Lexical text format bit 128");
  });
});
