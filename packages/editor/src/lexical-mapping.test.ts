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
