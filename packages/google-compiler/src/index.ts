import {
  type DocumentEnvelope,
  parseDocumentEnvelope,
  type TiptapNode,
} from "@document-playground/domain";

type Location = { index: number };
type Range = { startIndex: number; endIndex: number };

export type GoogleDocsRequest =
  | { insertText: { location: Location; text: string } }
  | { insertPageBreak: { location: Location } }
  | {
      updateTextStyle: {
        range: Range;
        textStyle: Record<string, unknown>;
        fields: string;
      };
    }
  | {
      updateParagraphStyle: {
        range: Range;
        paragraphStyle: Record<string, unknown>;
        fields: string;
      };
    }
  | { createParagraphBullets: { range: Range; bulletPreset: string } };

export type CompileResult = {
  title: string;
  requests: GoogleDocsRequest[];
};

export class UnsupportedContentError extends Error {
  constructor(
    readonly path: string,
    readonly nodeType: string,
  ) {
    super(`Unsupported document content at ${path}: ${nodeType}`);
    this.name = "UnsupportedContentError";
  }
}

const supportedNodes = new Set([
  "doc",
  "paragraph",
  "heading",
  "text",
  "hardBreak",
  "bulletList",
  "orderedList",
  "listItem",
  "pageBreak",
]);

function assertSupported(node: TiptapNode, path: string): void {
  if (!supportedNodes.has(node.type)) {
    throw new UnsupportedContentError(path, node.type);
  }
  node.content?.forEach((child, index) => {
    assertSupported(child, `${path}.content[${index}]`);
  });
}

function markStyle(mark: {
  type: string;
  attrs?: Record<string, unknown>;
}): Record<string, unknown> | null {
  if (mark.type === "bold") return { bold: true };
  if (mark.type === "italic") return { italic: true };
  if (mark.type === "underline") return { underline: true };
  if (mark.type === "link" && typeof mark.attrs?.href === "string") {
    return { link: { url: mark.attrs.href } };
  }
  throw new UnsupportedContentError("mark", mark.type);
}

function compileNode(
  node: TiptapNode,
  requests: GoogleDocsRequest[],
  state: { index: number },
  listType?: "bullet" | "ordered",
): void {
  if (node.type === "hardBreak") {
    requests.push({
      insertText: { location: { index: state.index }, text: "\n" },
    });
    state.index += 1;
    return;
  }

  if (node.type === "pageBreak") {
    requests.push({ insertPageBreak: { location: { index: state.index } } });
    state.index += 1;
    return;
  }

  if (node.type === "text") {
    const text = node.text ?? "";
    const startIndex = state.index;
    requests.push({ insertText: { location: { index: startIndex }, text } });
    state.index += text.length;
    node.marks?.forEach((mark) => {
      const style = markStyle(mark);
      if (style) {
        requests.push({
          updateTextStyle: {
            range: { startIndex, endIndex: state.index },
            textStyle: style,
            fields: Object.keys(style).join(","),
          },
        });
      }
    });
    return;
  }

  if (node.type === "doc") {
    node.content?.forEach((child) => {
      compileNode(child, requests, state);
    });
    return;
  }

  if (node.type === "bulletList" || node.type === "orderedList") {
    const nextListType = node.type === "bulletList" ? "bullet" : "ordered";
    node.content?.forEach((child) => {
      compileNode(child, requests, state, nextListType);
    });
    return;
  }

  const startIndex = state.index;
  node.content?.forEach((child) => {
    compileNode(child, requests, state, listType);
  });

  if (
    node.type === "paragraph" ||
    node.type === "heading" ||
    node.type === "listItem"
  ) {
    requests.push({
      insertText: { location: { index: state.index }, text: "\n" },
    });
    state.index += 1;
    const range = { startIndex, endIndex: state.index };

    if (node.type === "heading") {
      const level = node.attrs?.level;
      const namedStyleType = `HEADING_${typeof level === "number" ? Math.min(6, Math.max(1, level)) : 1}`;
      requests.push({
        updateParagraphStyle: {
          range,
          paragraphStyle: { namedStyleType },
          fields: "namedStyleType",
        },
      });
    }

    const alignment = node.attrs?.textAlign;
    if (
      typeof alignment === "string" &&
      ["left", "center", "right", "justify"].includes(alignment)
    ) {
      requests.push({
        updateParagraphStyle: {
          range,
          paragraphStyle: { alignment: alignment.toUpperCase() },
          fields: "alignment",
        },
      });
    }

    if (listType && node.type === "listItem") {
      requests.push({
        createParagraphBullets: {
          range,
          bulletPreset:
            listType === "bullet"
              ? "BULLET_DISC_CIRCLE_SQUARE"
              : "NUMBERED_DECIMAL_ALPHA_ROMAN",
        },
      });
    }
  }
}

export function normalizeDocument(input: unknown): DocumentEnvelope {
  return parseDocumentEnvelope(input);
}

export function compileDocument(input: unknown): CompileResult {
  // Unsupported content must produce the compiler's actionable error even
  // when its node is malformed; schema validation remains the normal boundary.
  const rawContent =
    input && typeof input === "object" && "content" in input
      ? (input as { content?: { content?: unknown[] } }).content?.content
      : undefined;
  const rejectUnsupportedRawNode = (node: unknown, path: string): void => {
    if (!node || typeof node !== "object") return;
    const typed = node as { type?: unknown; content?: unknown[] };
    if (typeof typed.type === "string" && !supportedNodes.has(typed.type)) {
      throw new UnsupportedContentError(path, typed.type);
    }
    typed.content?.forEach((child, index) => {
      rejectUnsupportedRawNode(child, `${path}.content[${index}]`);
    });
  };
  rawContent?.forEach((node, index) => {
    rejectUnsupportedRawNode(node, `content.content[${index}]`);
  });
  const document = normalizeDocument(input);
  assertSupported(document.content, "content");
  const requests: GoogleDocsRequest[] = [];
  compileNode(document.content, requests, { index: 1 });
  return { title: document.title, requests };
}
