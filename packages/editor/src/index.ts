import type {
  DocumentEnvelope,
  ImageAttributes,
  TiptapNode,
} from "@document-playground/domain";
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

export type ImageSourceResolver = (assetId: string) => string | undefined;

function createImageExtension(resolveSource?: ImageSourceResolver) {
  return Node.create({
    name: "image",
    inline: true,
    group: "inline",
    atom: true,
    draggable: true,
    selectable: true,

    addAttributes() {
      return {
        assetId: { default: null },
        alt: { default: "" },
        width: { default: 1 },
        height: { default: 1 },
      };
    },

    parseHTML() {
      return [{ tag: "img[data-asset-id]" }];
    },

    renderHTML({ node }) {
      const attrs = node.attrs as ImageAttributes;
      return [
        "img",
        {
          "data-asset-id": attrs.assetId,
          src: resolveSource?.(attrs.assetId) ?? "",
          alt: attrs.alt,
          width: attrs.width * (96 / 72),
          height: attrs.height * (96 / 72),
        },
      ];
    },
  });
}

function createCoreExtensions(resolveSource?: ImageSourceResolver) {
  return [
    StarterKit.configure({ link: false, underline: false }),
    Underline,
    Link.configure({ openOnClick: false }),
    TextAlign.configure({ types: ["heading", "paragraph"] }),
    PageBreak,
    createImageExtension(resolveSource),
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
  options: { resolveImageSource?: ImageSourceResolver } = {},
): Editor {
  return new Editor({
    element,
    extensions: createCoreExtensions(options.resolveImageSource),
    content,
  });
}

function selectImage(editor: Editor): boolean {
  let imagePosition: number | undefined;
  editor.state.doc.descendants((node, position) => {
    if (imagePosition === undefined && node.type.name === "image") {
      imagePosition = position;
    }
  });
  return (
    imagePosition !== undefined &&
    editor.commands.setNodeSelection(imagePosition)
  );
}

export function replaceImage(
  editor: Editor,
  assetId: string,
  alt: string,
  width: number,
  height: number,
): boolean {
  if (!selectImage(editor)) return false;
  return editor.commands.updateAttributes("image", {
    assetId,
    alt,
    width,
    height,
  });
}

export function removeImage(editor: Editor): boolean {
  if (!selectImage(editor)) return false;
  return editor.commands.deleteSelection();
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
