import {
  type DocumentEnvelope,
  type ImageAttributes,
  MAX_IMAGE_DIMENSION_POINTS,
  type TiptapNode,
} from "@document-playground/domain";
import { Editor, Node } from "@tiptap/core";
import Link from "@tiptap/extension-link";
import TextAlign from "@tiptap/extension-text-align";
import Underline from "@tiptap/extension-underline";
import StarterKit from "@tiptap/starter-kit";

export type { LexicalEditorAdapter } from "./lexical-editor";
export {
  createLexicalEditor,
  ImageNode,
  PageBreakNode,
} from "./lexical-editor";
export type {
  LexicalSerializedDocument,
  LexicalSerializedNode,
} from "./lexical-mapping";
export {
  fromLexicalDocument,
  fromLexicalSection,
  toLexicalDocument,
  toLexicalSection,
  UnsupportedLexicalNodeError,
} from "./lexical-mapping";

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

    addNodeView() {
      return ({ node, editor, getPos }) => {
        let currentNode = node;
        const wrapper = document.createElement("span");
        wrapper.className = "image-node-view";
        wrapper.contentEditable = "false";

        const image = document.createElement("img");
        image.className = "image-node-view-image";
        const handle = document.createElement("span");
        handle.className = "image-resize-handle";
        handle.setAttribute("role", "slider");
        handle.setAttribute("aria-label", "Resize image");
        handle.setAttribute("tabindex", "0");
        wrapper.append(image, handle);

        const render = () => {
          const attrs = currentNode.attrs as ImageAttributes;
          image.src = resolveSource?.(attrs.assetId) ?? "";
          image.alt = attrs.alt;
          image.width = attrs.width * (96 / 72);
          image.height = attrs.height * (96 / 72);
        };
        render();

        let dragStartX = 0;
        let dragStartWidth = 0;
        let dragStartHeight = 0;
        let dragging = false;

        const stopDragging = () => {
          if (!dragging) return;
          dragging = false;
          document.removeEventListener("mousemove", moveImage);
          document.removeEventListener("mouseup", stopDragging);
        };

        const moveImage = (event: MouseEvent) => {
          if (!dragging) return;
          const width = Math.min(
            MAX_IMAGE_DIMENSION_POINTS,
            Math.max(
              12,
              dragStartWidth + (event.clientX - dragStartX) * (72 / 96),
            ),
          );
          const height = width * (dragStartHeight / dragStartWidth);
          const position = getPos();
          if (typeof position !== "number") return;
          editor.view.dispatch(
            editor.state.tr.setNodeMarkup(position, undefined, {
              ...currentNode.attrs,
              width,
              height,
            }),
          );
        };

        const startDragging = (event: MouseEvent) => {
          event.preventDefault();
          event.stopPropagation();
          const attrs = currentNode.attrs as ImageAttributes;
          dragStartX = event.clientX;
          dragStartWidth = attrs.width;
          dragStartHeight = attrs.height;
          dragging = true;
          editor.commands.focus();
          document.addEventListener("mousemove", moveImage);
          document.addEventListener("mouseup", stopDragging);
        };

        handle.addEventListener("mousedown", startDragging);

        return {
          dom: wrapper,
          selectNode() {
            wrapper.classList.add("selected");
          },
          deselectNode() {
            wrapper.classList.remove("selected");
          },
          update(nextNode) {
            if (nextNode.type !== currentNode.type) return false;
            currentNode = nextNode;
            render();
            return true;
          },
          stopEvent: (event) =>
            event.type === "mousedown" || event.type === "mousemove",
          destroy() {
            stopDragging();
            handle.removeEventListener("mousedown", startDragging);
          },
        };
      };
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
