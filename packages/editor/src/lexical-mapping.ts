import type { DocumentMark, DocumentNode } from "@document-playground/domain";

export type LexicalSerializedNode = {
  type: string;
  children?: LexicalSerializedNode[];
  text?: string;
  tag?: string;
  format?: string | number;
  url?: string;
  listType?: string;
  start?: number;
  assetId?: string;
  altText?: string;
  width?: number;
  height?: number;
  [key: string]: unknown;
};

export type LexicalSerializedDocument = {
  root: LexicalSerializedNode;
};

export class UnsupportedLexicalNodeError extends Error {
  constructor(nodeType: string, path: string) {
    super(`Unsupported Lexical node '${nodeType}' at ${path}`);
    this.name = "UnsupportedLexicalNodeError";
  }
}

const childrenOf = (node: LexicalSerializedNode): LexicalSerializedNode[] => {
  if (!Array.isArray(node.children)) return [];
  return node.children;
};

function mapInlineChildren(
  node: LexicalSerializedNode,
  path: string,
): DocumentNode[] {
  return childrenOf(node).flatMap((child, index) => {
    const childPath = `${path}.children[${index}]`;
    if (child.type !== "link") return [mapNode(child, childPath)];
    if (typeof child.url !== "string" || child.url.length === 0) {
      throw new Error(`Lexical link node is missing url at ${childPath}`);
    }
    return childrenOf(child).map((linkChild, linkIndex) => {
      const mapped = mapNode(linkChild, `${childPath}.children[${linkIndex}]`);
      if (mapped.type !== "text") {
        throw new Error(`Lexical link child must be text at ${childPath}`);
      }
      return {
        ...mapped,
        marks: [
          ...(mapped.marks ?? []),
          { type: "link", attrs: { href: child.url } },
        ],
      };
    });
  });
}

function formatMarks(format: number): DocumentMark[] {
  const marks: DocumentMark[] = [];
  if (format & 1) marks.push({ type: "bold" });
  if (format & 2) marks.push({ type: "italic" });
  if (format & 8) marks.push({ type: "underline" });
  if (format & 4) {
    throw new Error("Unsupported Lexical text format 'strikethrough'");
  }
  if (format & 16) {
    throw new Error("Unsupported Lexical text format 'code'");
  }
  if (format & 32) {
    throw new Error("Unsupported Lexical text format 'subscript'");
  }
  if (format & 64) {
    throw new Error("Unsupported Lexical text format 'superscript'");
  }
  return marks;
}

function mapNode(node: LexicalSerializedNode, path: string): DocumentNode {
  switch (node.type) {
    case "root":
      return {
        type: "doc",
        content: childrenOf(node).map((child, index) =>
          mapNode(child, `${path}.children[${index}]`),
        ),
      };
    case "paragraph": {
      const attrs =
        typeof node.format === "string" && node.format !== ""
          ? { textAlign: node.format }
          : undefined;
      const content = mapInlineChildren(node, path);
      return {
        type: "paragraph",
        ...(attrs ? { attrs } : {}),
        ...(content.length ? { content } : {}),
      };
    }
    case "heading": {
      const level = Number.parseInt(node.tag?.replace("h", "") ?? "", 10);
      if (!Number.isInteger(level) || level < 1 || level > 6) {
        throw new Error(`Invalid Lexical heading tag at ${path}`);
      }
      const attrs =
        typeof node.format === "string" && node.format !== ""
          ? { level, textAlign: node.format }
          : { level };
      const content = mapInlineChildren(node, path);
      return {
        type: "heading",
        attrs,
        ...(content.length ? { content } : {}),
      };
    }
    case "text": {
      if (typeof node.text !== "string") {
        throw new Error(`Lexical text node is missing text at ${path}`);
      }
      const format = typeof node.format === "number" ? node.format : 0;
      const marks = formatMarks(format);
      return {
        type: "text",
        text: node.text,
        ...(marks.length ? { marks } : {}),
      };
    }
    case "link":
      throw new UnsupportedLexicalNodeError("link", path);
    case "linebreak":
      return { type: "hardBreak" };
    case "list": {
      if (node.listType !== "bullet" && node.listType !== "number") {
        throw new UnsupportedLexicalNodeError(node.listType ?? "list", path);
      }
      const content = childrenOf(node).map((child, index) =>
        mapNode(child, `${path}.children[${index}]`),
      );
      const start =
        node.listType === "number" &&
        typeof node.start === "number" &&
        Number.isInteger(node.start) &&
        node.start > 1
          ? node.start
          : undefined;
      return {
        type: node.listType === "bullet" ? "bulletList" : "orderedList",
        ...(start === undefined ? {} : { attrs: { start } }),
        ...(content.length ? { content } : {}),
      };
    }
    case "listitem": {
      const content = childrenOf(node).map((child, index) =>
        mapNode(child, `${path}.children[${index}]`),
      );
      return { type: "listItem", ...(content.length ? { content } : {}) };
    }
    case "image": {
      if (
        typeof node.assetId !== "string" ||
        typeof node.altText !== "string" ||
        typeof node.width !== "number" ||
        typeof node.height !== "number"
      ) {
        throw new Error(`Lexical image node has invalid attributes at ${path}`);
      }
      return {
        type: "image",
        attrs: {
          assetId: node.assetId,
          alt: node.altText,
          width: node.width,
          height: node.height,
        },
      };
    }
    case "pageBreak":
      return { type: "pageBreak" };
    default:
      throw new UnsupportedLexicalNodeError(node.type, path);
  }
}

export function fromLexicalDocument(input: unknown): DocumentNode {
  if (!input || typeof input !== "object" || !("root" in input)) {
    throw new Error("Lexical serialized document must contain a root node");
  }
  const root = (input as { root: unknown }).root;
  if (!root || typeof root !== "object" || !("type" in root)) {
    throw new Error("Lexical serialized document has an invalid root node");
  }
  return mapNode(root as LexicalSerializedNode, "root");
}

export function fromLexicalSection(input: unknown): DocumentNode {
  return fromLexicalDocument(input);
}

function markToFormat(mark: DocumentMark): number {
  if (mark.type === "bold") return 1;
  if (mark.type === "italic") return 2;
  if (mark.type === "underline") return 8;
  throw new Error(`Unsupported canonical mark '${mark.type}'`);
}

function toLexicalNode(node: DocumentNode): LexicalSerializedNode {
  if (node.type === "text") {
    const link = node.marks?.find((mark) => mark.type === "link");
    const marks = node.marks?.filter((mark) => mark.type !== "link") ?? [];
    const format = marks.reduce((value, mark) => value | markToFormat(mark), 0);
    const text: LexicalSerializedNode = {
      type: "text",
      text: node.text ?? "",
      format,
    };
    if (!link) return text;
    const href = link.attrs?.href;
    if (typeof href !== "string" || href.length === 0) {
      throw new Error("Canonical link mark is missing href");
    }
    return { type: "link", url: href, children: [text] };
  }

  const children = (node.content ?? []).map(toLexicalNode);
  switch (node.type) {
    case "doc":
      return { type: "root", version: 1, children };
    case "paragraph":
      return {
        type: "paragraph",
        ...(typeof node.attrs?.textAlign === "string"
          ? { format: node.attrs.textAlign }
          : {}),
        children,
      };
    case "heading":
      return {
        type: "heading",
        tag: `h${node.attrs?.level ?? 1}`,
        ...(typeof node.attrs?.textAlign === "string"
          ? { format: node.attrs.textAlign }
          : {}),
        children,
      };
    case "hardBreak":
      return { type: "linebreak" };
    case "bulletList":
    case "orderedList": {
      const start = node.attrs?.start;
      return {
        type: "list",
        listType: node.type === "bulletList" ? "bullet" : "number",
        indent: 0,
        start:
          node.type === "orderedList" &&
          typeof start === "number" &&
          Number.isInteger(start) &&
          start > 1
            ? start
            : 1,
        children,
      };
    }
    case "listItem":
      return { type: "listitem", value: 1, indent: 0, children };
    case "image": {
      const assetId = node.attrs?.assetId;
      const alt = node.attrs?.alt;
      const width = node.attrs?.width;
      const height = node.attrs?.height;
      if (
        typeof assetId !== "string" ||
        typeof alt !== "string" ||
        typeof width !== "number" ||
        typeof height !== "number"
      ) {
        throw new Error("Canonical image node has invalid attributes");
      }
      return {
        type: "image",
        assetId,
        altText: alt,
        width,
        height,
      };
    }
    case "pageBreak":
      return { type: "pageBreak" };
    default:
      throw new Error(`Unsupported canonical node '${node.type}'`);
  }
}

export function toLexicalDocument(
  node: DocumentNode,
): LexicalSerializedDocument {
  const root = toLexicalNode(node);
  if (root.type !== "root")
    throw new Error("Canonical document must have type 'doc'");
  return { root };
}

export function toLexicalSection(
  node: DocumentNode,
): LexicalSerializedDocument {
  return toLexicalDocument(node);
}
