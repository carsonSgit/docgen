import type { DocumentNode } from "@document-playground/domain";
import { LinkNode } from "@lexical/link";
import { ListItemNode, ListNode } from "@lexical/list";
import { HeadingNode } from "@lexical/rich-text";
import {
  createEditor,
  type EditorState,
  type EditorThemeClasses,
  ElementNode,
  type LexicalEditor,
  type NodeKey,
  type SerializedElementNode,
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
  focus(position?: "start" | "end"): void;
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
  options: { theme?: EditorThemeClasses } = {},
): LexicalEditorAdapter {
  const lexical = createEditor({
    namespace: "document-playground",
    nodes: editorNodes,
    theme: options.theme,
    onError(error) {
      throw error;
    },
  });
  lexical.setRootElement(element as HTMLElement);
  const listeners = new Set<(document: DocumentNode) => void>();

  const loadDocument = (nextDocument: DocumentNode) => {
    const state = lexical.parseEditorState(
      JSON.stringify(toLexicalDocument(nextDocument)),
    );
    lexical.setEditorState(state, { tag: "document-playground-load" });
  };

  lexical.registerUpdateListener(
    ({ editorState }: { editorState: EditorState }) => {
      const serialized =
        editorState.toJSON() as unknown as LexicalSerializedDocument;
      const nextDocument = fromLexicalDocument(serialized);
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
    focus(position = "end") {
      lexical.focus(() => ({
        defaultSelection: position === "start" ? "rootStart" : "rootEnd",
      }));
    },
    destroy() {
      lexical.setRootElement(null);
      listeners.clear();
    },
  };
}
