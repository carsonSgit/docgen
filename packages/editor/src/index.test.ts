import {
  createBlankDocument,
  type DocumentNode,
} from "@document-playground/domain";
import { $getRoot, $isElementNode, $isTextNode } from "lexical";
import { describe, expect, it } from "vitest";
import {
  createCoreEditor,
  createLexicalEditor,
  fromLexicalDocument,
  fromLexicalSection,
  removeImage,
  replaceImage,
  saveDocument,
  toLexicalDocument,
  toLexicalSection,
} from "./index";

describe("Lexical editor adapter", () => {
  it("loads and saves the canonical DocumentNode boundary through a real Lexical editor", () => {
    const host = document.createElement("div");
    const content = {
      type: "doc" as const,
      content: [
        {
          type: "paragraph" as const,
          content: [{ type: "text" as const, text: "Hello" }],
        },
        { type: "pageBreak" as const },
      ],
    };
    const editor = createLexicalEditor(host, content);

    expect(editor.getDocument()).toEqual(content);
    expect(editor.getLexicalState().root.type).toBe("root");

    editor.destroy();
  });

  it("notifies consumers with canonical content when Lexical state changes", async () => {
    const host = document.createElement("div");
    const editor = createLexicalEditor(host, {
      type: "doc",
      content: [{ type: "paragraph" }],
    });
    const changes: unknown[] = [];
    const unsubscribe = editor.onChange((document) => changes.push(document));

    editor.loadDocument({
      type: "doc",
      content: [
        { type: "paragraph", content: [{ type: "text", text: "Updated" }] },
      ],
    });
    await new Promise((resolve) => queueMicrotask(resolve));

    expect(changes.at(-1)).toEqual({
      type: "doc",
      content: [
        { type: "paragraph", content: [{ type: "text", text: "Updated" }] },
      ],
    });
    unsubscribe();
    editor.destroy();
  });

  it("propagates a user edit through the canonical boundary", async () => {
    const host = document.createElement("div");
    const editor = createLexicalEditor(host, {
      type: "doc",
      content: [
        { type: "paragraph", content: [{ type: "text", text: "Draft" }] },
      ],
    });
    const changes: DocumentNode[] = [];
    editor.onChange((nextDocument) => changes.push(nextDocument));

    editor.lexical.update(() => {
      const text = $getRoot().getFirstDescendant();
      if ($isTextNode(text)) text.setTextContent("Edited");
    });
    await new Promise((resolve) => queueMicrotask(resolve));

    expect(changes.at(-1)).toEqual({
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: "Edited" }],
        },
      ],
    });
    editor.destroy();
  });

  it("ignores malformed image resize events at the adapter boundary", async () => {
    const host = document.createElement("div");
    const editor = createLexicalEditor(host, {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            {
              type: "image",
              attrs: {
                assetId: "asset_photo",
                alt: "Photo",
                width: 120,
                height: 60,
              },
            },
          ],
        },
      ],
    });

    const imageKey = editor.lexical.getEditorState().read(() => {
      const paragraph = $getRoot().getFirstChild();
      return $isElementNode(paragraph)
        ? paragraph.getFirstChild()?.getKey()
        : undefined;
    });
    expect(imageKey).toEqual(expect.any(String));

    host.dispatchEvent(
      new CustomEvent("document-playground-resize-image", {
        bubbles: true,
        detail: { key: imageKey, width: 240, height: 120 },
      }),
    );
    await new Promise((resolve) => queueMicrotask(resolve));
    expect(editor.getDocument()).toMatchObject({
      content: [
        {
          content: [{ type: "image", attrs: { width: 240, height: 120 } }],
        },
      ],
    });

    host.dispatchEvent(
      new CustomEvent("document-playground-resize-image", {
        bubbles: true,
        detail: { key: imageKey, width: Number.NaN, height: 120 },
      }),
    );
    host.dispatchEvent(
      new CustomEvent("document-playground-resize-image", {
        bubbles: true,
        detail: { key: imageKey, width: 240, height: 1441 },
      }),
    );
    await new Promise((resolve) => queueMicrotask(resolve));

    expect(editor.getDocument()).toEqual({
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            {
              type: "image",
              attrs: {
                assetId: "asset_photo",
                alt: "Photo",
                width: 240,
                height: 120,
              },
            },
          ],
        },
      ],
    });
    editor.destroy();
  });
});

describe("core editor adapter", () => {
  it("maps supported Lexical nodes and marks to canonical document content", () => {
    const lexical = {
      root: {
        type: "root",
        version: 1,
        children: [
          {
            type: "heading",
            tag: "h2",
            children: [
              {
                type: "text",
                text: "Title",
                format: 3,
                style: "",
              },
            ],
          },
          {
            type: "paragraph",
            children: [
              {
                type: "link",
                url: "https://example.test",
                children: [{ type: "text", text: "Read more", format: 0 }],
              },
              { type: "linebreak" },
            ],
          },
          {
            type: "list",
            listType: "bullet",
            start: 1,
            children: [
              {
                type: "listitem",
                value: 1,
                children: [{ type: "paragraph", children: [] }],
              },
            ],
          },
          {
            type: "image",
            assetId: "asset_01",
            altText: "Diagram",
            width: 240,
            height: 120,
          },
          { type: "pageBreak" },
        ],
      },
    };

    expect(fromLexicalDocument(lexical)).toEqual({
      type: "doc",
      content: [
        {
          type: "heading",
          attrs: { level: 2 },
          content: [
            {
              type: "text",
              text: "Title",
              marks: [{ type: "bold" }, { type: "italic" }],
            },
          ],
        },
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: "Read more",
              marks: [
                {
                  type: "link",
                  attrs: { href: "https://example.test" },
                },
              ],
            },
            { type: "hardBreak" },
          ],
        },
        {
          type: "bulletList",
          content: [{ type: "listItem", content: [{ type: "paragraph" }] }],
        },
        {
          type: "image",
          attrs: {
            assetId: "asset_01",
            alt: "Diagram",
            width: 240,
            height: 120,
          },
        },
        { type: "pageBreak" },
      ],
    });
  });

  it("rejects tables and unknown Lexical nodes at the adapter boundary", () => {
    expect(() =>
      fromLexicalDocument({
        root: {
          type: "root",
          version: 1,
          children: [{ type: "table", children: [] }],
        },
      }),
    ).toThrow("Unsupported Lexical node 'table' at root.children[0]");
  });

  it("round-trips canonical content through a Lexical-neutral shape", () => {
    const canonical = {
      type: "doc" as const,
      content: [
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: "Hello",
              marks: [{ type: "bold" }],
            },
          ],
        },
        { type: "pageBreak" },
      ],
    };

    expect(fromLexicalDocument(toLexicalDocument(canonical))).toEqual(
      canonical,
    );
  });

  it("uses the same mapping contract for document-level headers and footers", () => {
    const header = {
      root: {
        type: "root",
        version: 1,
        children: [
          { type: "paragraph", children: [{ type: "text", text: "Header" }] },
        ],
      },
    };
    const footer = {
      type: "doc" as const,
      content: [
        { type: "paragraph", content: [{ type: "text", text: "Footer" }] },
      ],
    };

    expect(fromLexicalSection(header)).toEqual({
      type: "doc",
      content: [
        { type: "paragraph", content: [{ type: "text", text: "Header" }] },
      ],
    });
    expect(fromLexicalSection(toLexicalSection(footer))).toEqual(footer);
  });

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

  it("supports replacing and removing an inline image", () => {
    const host = document.createElement("div");
    const editor = createCoreEditor(host, {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            {
              type: "image",
              attrs: {
                assetId: "asset_original",
                alt: "Old",
                width: 40,
                height: 20,
              },
            },
          ],
        },
      ],
    });

    expect(replaceImage(editor, "asset_replacement", "New", 80, 40)).toBe(true);
    expect(
      saveDocument(editor, createBlankDocument()).content.content?.[0],
    ).toMatchObject({
      content: [
        { type: "image", attrs: { assetId: "asset_replacement", width: 80 } },
      ],
    });
    expect(removeImage(editor)).toBe(true);
    expect(
      saveDocument(editor, createBlankDocument()).content.content?.[0],
    ).toEqual({
      type: "paragraph",
      attrs: {},
    });
    editor.destroy();
  });

  it("resizes an image through its visible resize handle", () => {
    const host = document.createElement("div");
    const editor = createCoreEditor(host, {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            {
              type: "image",
              attrs: {
                assetId: "asset_original",
                alt: "Photo",
                width: 40,
                height: 20,
              },
            },
          ],
        },
      ],
    });

    const handle = host.querySelector(".image-resize-handle");
    expect(handle).not.toBeNull();
    handle?.dispatchEvent(
      new MouseEvent("mousedown", { bubbles: true, clientX: 100 }),
    );
    document.dispatchEvent(
      new MouseEvent("mousemove", { bubbles: true, clientX: 140 }),
    );
    document.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));

    expect(
      saveDocument(editor, createBlankDocument()).content.content?.[0],
    ).toMatchObject({
      content: [{ type: "image", attrs: { width: 70, height: 35 } }],
    });
    editor.destroy();
  });
});
