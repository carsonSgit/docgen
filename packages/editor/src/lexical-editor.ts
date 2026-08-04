import type { DocumentNode } from "@document-playground/domain";
import { LinkNode, TOGGLE_LINK_COMMAND } from "@lexical/link";
import {
  INSERT_ORDERED_LIST_COMMAND,
  INSERT_UNORDERED_LIST_COMMAND,
  ListItemNode,
  ListNode,
} from "@lexical/list";
import { $createHeadingNode, HeadingNode } from "@lexical/rich-text";
import {
  $createParagraphNode,
  $createTextNode,
  $getRoot,
  $getSelection,
  $isRangeSelection,
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
    const element = document.createElement("img");
    element.dataset.assetId = this.__assetId;
    element.alt = this.__altText;
    element.width = this.__width * (96 / 72);
    element.height = this.__height * (96 / 72);
    return element;
  }

  override updateDOM(): false {
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
}

export type LexicalEditorAdapter = {
  readonly lexical: LexicalEditor;
  getLexicalState(): LexicalSerializedDocument;
  getDocument(): DocumentNode;
  loadDocument(document: DocumentNode): void;
  onChange(listener: (document: DocumentNode) => void): () => void;
  isCursorAtEnd(): boolean;
  focus(position?: "start" | "end"): void;
  toggleFormat(format: "bold" | "italic" | "underline"): void;
  setHeading(level: number): void;
  toggleList(type: "bullet" | "number"): void;
  setAlignment(alignment: "left" | "center"): void;
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
  const listeners = new Set<(document: DocumentNode) => void>();
  const syncNativeText = (domText: string) => {
    const lexicalText = lexical
      .getEditorState()
      .read(() => $getRoot().getTextContent());
    if (!domText || domText === lexicalText) return;
    lexical.update(() => {
      const root = $getRoot();
      root.clear();
      for (const paragraphText of domText.split(/\\n/)) {
        const paragraph = $createParagraphNode();
        if (paragraphText) paragraph.append($createTextNode(paragraphText));
        root.append(paragraph);
      }
    });
  };
  const handleNativeInput = () => {
    syncNativeText(
      (element as HTMLElement).innerText ?? element.textContent ?? "",
    );
  };
  const handleNativeBeforeInput = (event: Event) => {
    const input = event as InputEvent;
    if (!input.data || !input.inputType.startsWith("insert")) return;
    const domText =
      (element as HTMLElement).innerText ?? element.textContent ?? "";
    const lexicalText = lexical
      .getEditorState()
      .read(() => $getRoot().getTextContent());
    if (domText || lexicalText) return;
    event.preventDefault();
    syncNativeText(input.data);
  };
  element.addEventListener("beforeinput", handleNativeBeforeInput, true);
  element.addEventListener("input", handleNativeInput, true);
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

  const loadDocument = (nextDocument: DocumentNode) => {
    const state = lexical.parseEditorState(
      JSON.stringify(toLexicalDocument(nextDocument)),
    );
    lexical.setEditorState(state, { tag: "document-playground-load" });
    renderImageSources();
  };

  lexical.registerUpdateListener(
    ({ editorState }: { editorState: EditorState }) => {
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
        return (
          lastBlock !== null &&
          anchorNode.getTopLevelElementOrThrow() === lastBlock &&
          selection.anchor.offset >= anchorNode.getTextContentSize()
        );
      });
    },
    focus(position = "end") {
      lexical.focus(() => ({
        defaultSelection: position === "start" ? "rootStart" : "rootEnd",
      }));
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
      element.removeEventListener("beforeinput", handleNativeBeforeInput, true);
      element.removeEventListener("input", handleNativeInput, true);
      lexical.setRootElement(null);
      listeners.clear();
    },
  };
}
