import { createBlankDocument } from "@document-playground/domain";
import { describe, expect, it } from "vitest";
import { createCoreEditor, saveDocument } from "./index";

describe("core editor adapter", () => {
  it("round-trips structured content through the document envelope", () => {
    const host = document.createElement("div");
    const envelope = createBlankDocument();
    envelope.content = {
      type: "doc",
      content: [
        {
          type: "heading",
          attrs: { level: 2 },
          content: [{ type: "text", text: "Title" }],
        },
      ],
    };

    const editor = createCoreEditor(host, envelope.content);

    expect(saveDocument(editor, envelope).content).toEqual(envelope.content);
    editor.destroy();
  });

  it("supports semantic manual page breaks", () => {
    const host = document.createElement("div");
    const editor = createCoreEditor(host, {
      type: "doc",
      content: [{ type: "pageBreak" }],
    });

    expect(saveDocument(editor, createBlankDocument()).content).toEqual({
      type: "doc",
      content: [{ type: "pageBreak" }],
    });
    editor.destroy();
  });
});
