import { describe, expect, it } from "vitest";
import {
  BUILT_IN_TEMPLATES,
  createBlankDocument,
  createDocumentFromTemplate,
  DOCUMENT_VERSION,
  listDocumentTemplates,
  parseDocumentEnvelope,
  parseDocumentTemplate,
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

  it("provides validated, versioned built-in templates", () => {
    expect(listDocumentTemplates()).toEqual([
      { id: "blank", name: "Blank", version: 1 },
      { id: "resume", name: "Resume", version: 1 },
      { id: "meeting-notes", name: "Meeting notes", version: 1 },
      { id: "letter", name: "Letter", version: 1 },
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
