import type { DocumentEnvelope, TiptapNode } from "@document-playground/domain";
import { Editor, Node } from "@tiptap/core";
import Link from "@tiptap/extension-link";
import TextAlign from "@tiptap/extension-text-align";
import Underline from "@tiptap/extension-underline";
import StarterKit from "@tiptap/starter-kit";

const PageBreak = Node.create({
  name: "pageBreak",
  group: "block",
  atom: true,
  selectable: true,

  parseHTML() {
    return [{ tag: "hr[data-page-break]" }];
  },

  renderHTML() {
    return ["hr", { "data-page-break": "true" }];
  },
});

function createCoreExtensions() {
  return [
    StarterKit.configure({ link: false, underline: false }),
    Underline,
    Link.configure({ openOnClick: false }),
    TextAlign.configure({ types: ["heading", "paragraph"] }),
    PageBreak,
  ];
}

function normalizeNode(node: TiptapNode): TiptapNode {
  return {
    ...node,
    ...(node.attrs
      ? {
          attrs: Object.fromEntries(
            Object.entries(node.attrs).filter(([, value]) => value !== null),
          ),
        }
      : {}),
    ...(node.content ? { content: node.content.map(normalizeNode) } : {}),
    ...(node.marks
      ? {
          marks: node.marks.map((mark) => ({
            ...mark,
            ...(mark.attrs
              ? {
                  attrs: Object.fromEntries(
                    Object.entries(mark.attrs).filter(
                      ([, value]) => value !== null,
                    ),
                  ),
                }
              : {}),
          })),
        }
      : {}),
  };
}

export function createCoreEditor(
  element: Element,
  content: TiptapNode,
): Editor {
  return new Editor({
    element,
    extensions: createCoreExtensions(),
    content,
  });
}

export function loadDocument(editor: Editor, document: DocumentEnvelope): void {
  editor.commands.setContent(document.content);
}

export function saveDocument(
  editor: Editor,
  document: DocumentEnvelope,
): DocumentEnvelope {
  return {
    ...document,
    content: normalizeNode(editor.getJSON() as TiptapNode),
  };
}
