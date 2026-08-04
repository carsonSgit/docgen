import {
  type DocumentNode,
  MAX_IMAGE_DIMENSION_POINTS,
  validateImageDimensions,
} from "@document-playground/domain";
import { LinkNode, TOGGLE_LINK_COMMAND } from "@lexical/link";
import {
  INSERT_ORDERED_LIST_COMMAND,
  INSERT_UNORDERED_LIST_COMMAND,
  ListItemNode,
  ListNode,
} from "@lexical/list";
import {
  $createHeadingNode,
  HeadingNode,
  registerRichText,
} from "@lexical/rich-text";
import {
  $createParagraphNode,
  $createRangeSelection,
  $createTextNode,
  $getNodeByKey,
  $getRoot,
  $getSelection,
  $isRangeSelection,
  $setSelection,
  createEditor,
  type EditorState,
  type EditorThemeClasses,
  ElementNode,
  FORMAT_ELEMENT_COMMAND,
  FORMAT_TEXT_COMMAND,
  type LexicalEditor,
  type NodeKey,
  REDO_COMMAND,
  type SerializedElementNode,
  UNDO_COMMAND,
} from "lexical";
import {
  fromLexicalDocument,
  type LexicalSerializedDocument,
  toLexicalDocument,
} from "./lexical-mapping";

type SerializedPageBreakNode = SerializedElementNode & {
  type: "pageBreak";
  version: 1;
};
type SerializedImageNode = SerializedElementNode & {
  type: "image";
  version: 1;
  assetId: string;
  altText: string;
  width: number;
  height: number;
};

export class PageBreakNode extends ElementNode {
  static override getType(): string {
    return "pageBreak";
  }

  static override clone(node: PageBreakNode): PageBreakNode {
    return new PageBreakNode(node.__key);
  }

  static override importJSON(): PageBreakNode {
    return new PageBreakNode();
  }

  override createDOM(): HTMLElement {
    const element = document.createElement("hr");
    element.dataset.pageBreak = "true";
    return element;
  }

  override updateDOM(): false {
    return false;
  }

  override exportJSON(): SerializedPageBreakNode {
    return {
      type: "pageBreak",
      version: 1,
      children: [],
      direction: null,
      format: "",
      indent: 0,
    };
  }

  override canBeEmpty(): false {
    return false;
  }

  override isInline(): false {
    return false;
  }
}

export class ImageNode extends ElementNode {
  static override getType(): string {
    return "image";
  }

  static override clone(node: ImageNode): ImageNode {
    return new ImageNode(
      node.__assetId,
      node.__altText,
      node.__width,
      node.__height,
      node.__key,
    );
  }

  static override importJSON(serialized: SerializedImageNode): ImageNode {
    return new ImageNode(
      serialized.assetId,
      serialized.altText,
      serialized.width,
      serialized.height,
    );
  }

  constructor(
    private __assetId: string,
    private __altText: string,
    private __width: number,
    private __height: number,
    key?: NodeKey,
  ) {
    super(key);
  }

  override createDOM(): HTMLElement {
    const wrapper = document.createElement("span");
    wrapper.className = "image-node-view";
    wrapper.contentEditable = "false";
    const image = document.createElement("img");
    image.className = "image-node-view-image";
    image.dataset.assetId = this.__assetId;
    image.alt = this.__altText;
    image.width = this.__width * (96 / 72);
    image.height = this.__height * (96 / 72);
    const handle = document.createElement("span");
    handle.className = "image-resize-handle";
    handle.setAttribute("role", "slider");
    handle.setAttribute("aria-label", "Resize image");
    handle.setAttribute("tabindex", "0");
    let startX = 0;
    let startWidth = 0;
    let startHeight = 0;
    let dragging = false;
    const stopDragging = () => {
      dragging = false;
      document.removeEventListener("mousemove", moveImage);
      document.removeEventListener("mouseup", stopDragging);
    };
    const moveImage = (event: MouseEvent) => {
      if (!dragging) return;
      const width = Math.min(
        MAX_IMAGE_DIMENSION_POINTS,
        Math.max(12, startWidth + (event.clientX - startX) * (72 / 96)),
      );
      wrapper.dispatchEvent(
        new CustomEvent("document-playground-resize-image", {
          bubbles: true,
          detail: {
            key: this.getKey(),
            width,
            height: width * (startHeight / startWidth),
          },
        }),
      );
    };
    const startDragging = (event: MouseEvent) => {
      event.preventDefault();
      event.stopPropagation();
      startX = event.clientX;
      startWidth = this.__width;
      startHeight = this.__height;
      dragging = true;
      document.addEventListener("mousemove", moveImage);
      document.addEventListener("mouseup", stopDragging);
    };
    handle.addEventListener("mousedown", startDragging);
    wrapper.append(image, handle);
    return wrapper;
  }

  override updateDOM(_previousNode: ImageNode, element: HTMLElement): false {
    const image = element.querySelector("img");
    if (image) {
      image.dataset.assetId = this.__assetId;
      image.alt = this.__altText;
      image.width = this.__width * (96 / 72);
      image.height = this.__height * (96 / 72);
    }
    return false;
  }

  override exportJSON(): SerializedImageNode {
    return {
      type: "image",
      version: 1,
      children: [],
      direction: null,
      format: "",
      indent: 0,
      assetId: this.__assetId,
      altText: this.__altText,
      width: this.__width,
      height: this.__height,
    };
  }

  override isInline(): true {
    return true;
  }

  resize(width: number, height: number): void {
    const writable = this.getWritable();
    writable.__width = width;
    writable.__height = height;
  }
}

export type LexicalEditorAdapter = {
  readonly lexical: LexicalEditor;
  getLexicalState(): LexicalSerializedDocument;
  getDocument(): DocumentNode;
  loadDocument(document: DocumentNode, options?: { notify?: boolean }): void;
  onChange(listener: (document: DocumentNode) => void): () => void;
  isCursorAtEnd(): boolean;
  focus(position?: "start" | "end"): void;
  toggleFormat(format: "bold" | "italic" | "underline"): void;
  setHeading(level: number): void;
  toggleList(type: "bullet" | "number"): void;
  setAlignment(alignment: "left" | "center" | "right" | "justify"): void;
  setLink(url: string | null): void;
  insertPageBreak(): void;
  insertImage(attributes: {
    assetId: string;
    alt: string;
    width: number;
    height: number;
  }): void;
  undo(): void;
  redo(): void;
  destroy(): void;
};

const editorNodes = [
  HeadingNode,
  LinkNode,
  ListNode,
  ListItemNode,
  ImageNode,
  PageBreakNode,
];

export function createLexicalEditor(
  element: Element,
  document: DocumentNode,
  options: {
    theme?: EditorThemeClasses;
    resolveImageSource?: (assetId: string) => string | undefined;
  } = {},
): LexicalEditorAdapter {
  const lexical = createEditor({
    namespace: "document-playground",
    editable: true,
    nodes: editorNodes,
    theme: options.theme,
    onError(error) {
      throw error;
    },
  });
  lexical.setEditable(true);
  element.setAttribute("contenteditable", "true");
  element.setAttribute("role", "textbox");
  element.setAttribute("aria-multiline", "true");
  lexical.setRootElement(element as HTMLElement);
  const unregisterRichText = registerRichText(lexical);
  const listeners = new Set<(document: DocumentNode) => void>();
  const handleImageResize = (event: Event) => {
    const detail = (
      event as CustomEvent<{
        key?: string;
        width?: number;
        height?: number;
      }>
    ).detail;
    if (
      typeof detail?.key !== "string" ||
      typeof detail.width !== "number" ||
      typeof detail.height !== "number"
    )
      return;
    const { key, width, height } = detail;
    try {
      validateImageDimensions(width, height);
    } catch {
      return;
    }
    lexical.update(() => {
      const node = $getNodeByKey(key);
      if (!(node instanceof ImageNode)) return;
      node.resize(width, height);
    });
  };
  element.addEventListener(
    "document-playground-resize-image",
    handleImageResize,
  );
  const renderImageSources = () => {
    if (!options.resolveImageSource) return;
    for (const image of element.querySelectorAll<HTMLElement>(
      "[data-asset-id]",
    )) {
      const assetId = image.dataset.assetId;
      if (assetId) {
        const source = options.resolveImageSource(assetId);
        if (source && image instanceof HTMLImageElement) image.src = source;
      }
    }
  };

  const loadDocument = (
    nextDocument: DocumentNode,
    options: { notify?: boolean } = {},
  ) => {
    const suppressChange = options.notify === false;
    const cursorOffset = lexical.getEditorState().read(() => {
      const selection = $getSelection();
      if (!$isRangeSelection(selection) || !selection.isCollapsed())
        return null;
      const anchorNode = selection.anchor.getNode();
      const textNodes = $getRoot().getAllTextNodes();
      let offset = selection.anchor.offset;
      for (const textNode of textNodes) {
        if (textNode.getKey() === anchorNode.getKey()) break;
        offset += textNode.getTextContentSize();
      }
      return offset;
    });
    const state = lexical.parseEditorState(
      JSON.stringify(toLexicalDocument(nextDocument)),
    );
    lexical.setEditorState(
      state,
      suppressChange ? { tag: "document-playground-load" } : undefined,
    );
    if (cursorOffset !== null) {
      lexical.update(
        () => {
          const textNodes = $getRoot().getAllTextNodes();
          let remaining = cursorOffset;
          const target =
            textNodes.find((textNode) => {
              const size = textNode.getTextContentSize();
              if (remaining <= size) return true;
              remaining -= size;
              return false;
            }) ?? textNodes.at(-1);
          if (!target) return;
          const selection = $createRangeSelection();
          selection.setTextNodeRange(
            target,
            Math.min(remaining, target.getTextContentSize()),
            target,
            Math.min(remaining, target.getTextContentSize()),
          );
          $setSelection(selection);
        },
        suppressChange ? { tag: "document-playground-load" } : undefined,
      );
      lexical.focus();
    }
    renderImageSources();
  };

  lexical.registerUpdateListener(
    ({
      editorState,
      tags,
    }: {
      editorState: EditorState;
      tags: Set<string>;
    }) => {
      if (tags.has("document-playground-load")) return;
      const serialized =
        editorState.toJSON() as unknown as LexicalSerializedDocument;
      const nextDocument = fromLexicalDocument(serialized);
      renderImageSources();
      for (const listener of listeners) listener(nextDocument);
    },
  );

  loadDocument(document);

  return {
    lexical,
    getLexicalState: () =>
      lexical.getEditorState().toJSON() as unknown as LexicalSerializedDocument,
    getDocument: () => fromLexicalDocument(lexical.getEditorState().toJSON()),
    loadDocument,
    onChange(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    isCursorAtEnd() {
      return lexical.getEditorState().read(() => {
        const selection = $getSelection();
        if (!$isRangeSelection(selection) || !selection.isCollapsed()) {
          return false;
        }
        const root = $getRoot();
        const lastBlock = root.getLastChild();
        const anchorNode = selection.anchor.getNode();
        const atLastBlock =
          lastBlock !== null &&
          anchorNode.getTopLevelElementOrThrow() === lastBlock;
        if (
          atLastBlock &&
          lastBlock instanceof ElementNode &&
          lastBlock.getLastChild()?.getType() === "linebreak"
        ) {
          return true;
        }
        return (
          lastBlock !== null &&
          atLastBlock &&
          selection.anchor.offset >= anchorNode.getTextContentSize()
        );
      });
    },
    focus(position = "end") {
      lexical.focus(undefined, {
        defaultSelection: position === "start" ? "rootStart" : "rootEnd",
      });
    },
    toggleFormat(format) {
      lexical.dispatchCommand(FORMAT_TEXT_COMMAND, format);
    },
    setHeading(level) {
      if (!Number.isInteger(level) || level < 1 || level > 6) return;
      lexical.update(() => {
        const selection = $getSelection();
        if (!$isRangeSelection(selection)) return;
        const tag = `h${level}` as "h1" | "h2" | "h3" | "h4" | "h5" | "h6";
        const replaced = new Set<string>();
        for (const node of selection.getNodes()) {
          const block = node.getTopLevelElementOrThrow();
          if (
            !(block instanceof ElementNode) ||
            replaced.has(block.getKey()) ||
            block.getType() === "list"
          )
            continue;
          const heading = $createHeadingNode(tag);
          heading.append(...block.getChildren());
          block.replace(heading);
          replaced.add(block.getKey());
        }
      });
    },
    toggleList(type) {
      lexical.dispatchCommand(
        type === "bullet"
          ? INSERT_UNORDERED_LIST_COMMAND
          : INSERT_ORDERED_LIST_COMMAND,
      );
    },
    setAlignment(alignment) {
      lexical.dispatchCommand(FORMAT_ELEMENT_COMMAND, alignment);
    },
    setLink(url) {
      lexical.dispatchCommand(TOGGLE_LINK_COMMAND, url);
    },
    insertPageBreak() {
      lexical.update(() => {
        const selection = $getSelection();
        if (!$isRangeSelection(selection)) return;
        selection.insertNodes([new PageBreakNode()]);
        const paragraph = $createParagraphNode();
        paragraph.append($createTextNode(""));
        selection.insertNodes([paragraph]);
      });
    },
    insertImage(attributes) {
      lexical.update(() => {
        const selection = $getSelection();
        if (!$isRangeSelection(selection)) return;
        selection.insertNodes([
          new ImageNode(
            attributes.assetId,
            attributes.alt,
            attributes.width,
            attributes.height,
          ),
        ]);
      });
    },
    undo() {
      lexical.dispatchCommand(UNDO_COMMAND, undefined);
    },
    redo() {
      lexical.dispatchCommand(REDO_COMMAND, undefined);
    },
    destroy() {
      element.removeEventListener(
        "document-playground-resize-image",
        handleImageResize,
      );
      unregisterRichText();
      lexical.setRootElement(null);
      listeners.clear();
    },
  };
}
