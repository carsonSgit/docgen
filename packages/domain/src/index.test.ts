import { describe, expect, it } from "vitest";
import {
  createBlankDocument,
  DOCUMENT_VERSION,
  parseDocumentEnvelope,
  validateDocumentEnvelope,
} from "./index";

describe("document envelope", () => {
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
      content: { type: "doc", content: [{ type: "paragraph" }] },
    });
    expect(validateDocumentEnvelope(document).success).toBe(true);
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
});
