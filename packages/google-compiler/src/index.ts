import {
  DOCUMENT_TYPOGRAPHY,
  type DocumentEnvelope,
  FOOTER_DISTANCE_POINTS,
  findUnsupportedDocumentNode,
  HEADER_DISTANCE_POINTS,
  isCoreDocumentNodeType,
  parseDocumentEnvelope,
  type TiptapNode,
} from "@document-playground/domain";

type Location = { index: number; segmentId?: string };
type Range = { startIndex: number; endIndex: number; segmentId?: string };

const baseTextStyle = {
  weightedFontFamily: { fontFamily: DOCUMENT_TYPOGRAPHY.fontFamily },
  fontSize: { magnitude: DOCUMENT_TYPOGRAPHY.bodyFontSizePoints, unit: "PT" },
} as const;

function headingMetrics(node: TiptapNode) {
  const rawLevel = node.attrs?.level;
  const level =
    typeof rawLevel === "number" ? Math.min(6, Math.max(1, rawLevel)) : 1;
  return {
    level,
    metrics: DOCUMENT_TYPOGRAPHY.headings[level as 1 | 2 | 3 | 4 | 5 | 6],
  };
}

function paragraphStyle(node: TiptapNode) {
  if (node.type !== "heading") {
    return {
      paragraphStyle: {
        lineSpacing: DOCUMENT_TYPOGRAPHY.lineSpacingPercent,
        spaceAbove: { magnitude: 0, unit: "PT" },
        spaceBelow: { magnitude: 0, unit: "PT" },
      },
      fields: "lineSpacing,spaceAbove,spaceBelow",
    };
  }
  const { level, metrics } = headingMetrics(node);
  return {
    paragraphStyle: {
      namedStyleType: `HEADING_${level}`,
      lineSpacing: DOCUMENT_TYPOGRAPHY.lineSpacingPercent,
      spaceAbove: { magnitude: metrics.spaceAbovePoints, unit: "PT" },
      spaceBelow: { magnitude: metrics.spaceBelowPoints, unit: "PT" },
      keepWithNext: true,
      keepLinesTogether: true,
    },
    fields:
      "namedStyleType,lineSpacing,spaceAbove,spaceBelow,keepWithNext,keepLinesTogether",
  };
}

function textStyle(node: TiptapNode) {
  if (node.type !== "heading") {
    return {
      textStyle: { ...baseTextStyle },
      fields: "weightedFontFamily,fontSize",
    };
  }
  const { metrics } = headingMetrics(node);
  return {
    textStyle: {
      ...baseTextStyle,
      fontSize: { magnitude: metrics.fontSizePoints, unit: "PT" },
      bold: true,
    },
    fields: "weightedFontFamily,fontSize,bold",
  };
}

export type GoogleDocsRequest =
  | {
      updateDocumentStyle: {
        documentStyle: Record<string, unknown>;
        fields: string;
      };
    }
  | { createHeader: { type: "DEFAULT" } }
  | { createFooter: { type: "DEFAULT" } }
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
  | { createParagraphBullets: { range: Range; bulletPreset: string } }
  | {
      insertInlineImage: {
        location: Location;
        uri: string;
        objectSize: {
          width: { magnitude: number; unit: "PT" };
          height: { magnitude: number; unit: "PT" };
        };
      };
    };

export type CompileResult = {
  title: string;
  requests: GoogleDocsRequest[];
  sections: {
    header: GoogleDocsRequest[] | null;
    footer: GoogleDocsRequest[] | null;
  };
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

function assertSupported(node: TiptapNode, path: string): void {
  const unsupported = findUnsupportedDocumentNode(node, path);
  if (unsupported) {
    throw new UnsupportedContentError(unsupported.path, unsupported.nodeType);
  }
}

function removeFinalBodyParagraphBreak(
  requests: GoogleDocsRequest[],
  finalNode: TiptapNode | undefined,
): void {
  if (!finalNode || !["paragraph", "heading"].includes(finalNode.type)) {
    return;
  }
  for (let index = requests.length - 1; index >= 0; index -= 1) {
    const request = requests[index];
    if (
      request &&
      "insertText" in request &&
      request.insertText.text === "\n" &&
      request.insertText.location.segmentId === undefined
    ) {
      requests.splice(index, 1);
      return;
    }
  }
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
  imageUris: ReadonlyMap<string, string>,
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

  if (node.type === "image") {
    const assetId = node.attrs?.assetId;
    const uri =
      typeof assetId === "string" ? imageUris.get(assetId) : undefined;
    if (!uri) {
      throw new Error(
        `Image asset ${assetId ?? "unknown"} is not available for export`,
      );
    }
    const width = node.attrs?.width;
    const height = node.attrs?.height;
    if (typeof width !== "number" || typeof height !== "number") {
      throw new Error(`Image asset ${assetId} has invalid dimensions`);
    }
    requests.push({
      insertInlineImage: {
        location: { index: state.index },
        uri,
        objectSize: {
          width: { magnitude: width, unit: "PT" },
          height: { magnitude: height, unit: "PT" },
        },
      },
    });
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
      compileNode(child, requests, state, imageUris);
    });
    return;
  }

  if (node.type === "bulletList" || node.type === "orderedList") {
    const nextListType = node.type === "bulletList" ? "bullet" : "ordered";
    node.content?.forEach((child) => {
      compileNode(child, requests, state, imageUris, nextListType);
    });
    return;
  }

  const startIndex = state.index;
  node.content?.forEach((child) => {
    compileNode(child, requests, state, imageUris, listType);
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

    requests.push({ updateParagraphStyle: { range, ...paragraphStyle(node) } });
    if (node.type !== "listItem") {
      requests.push({ updateTextStyle: { range, ...textStyle(node) } });
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

export function compileDocument(
  input: unknown,
  imageUris: ReadonlyMap<string, string> = new Map(),
): CompileResult {
  // Unsupported content must produce the compiler's actionable error even
  // when its node is malformed; schema validation remains the normal boundary.
  const rawContent =
    input && typeof input === "object" && "content" in input
      ? (input as { content?: { content?: unknown[] } }).content?.content
      : undefined;
  const rejectUnsupportedRawNode = (node: unknown, path: string): void => {
    if (!node || typeof node !== "object") return;
    const typed = node as { type?: unknown; content?: unknown[] };
    if (typeof typed.type === "string" && !isCoreDocumentNodeType(typed.type)) {
      throw new UnsupportedContentError(path, typed.type);
    }
    typed.content?.forEach((child, index) => {
      rejectUnsupportedRawNode(child, `${path}.content[${index}]`);
    });
  };
  const rawSections =
    input && typeof input === "object"
      ? (input as { header?: unknown; footer?: unknown })
      : {};
  rawContent?.forEach((node, index) => {
    rejectUnsupportedRawNode(node, `content.content[${index}]`);
  });
  for (const section of ["header", "footer"] as const) {
    const raw = rawSections[section];
    if (raw && typeof raw === "object") {
      rejectUnsupportedRawNode(raw, section);
    }
  }
  const document = normalizeDocument(input);
  assertSupported(document.content, "content");
  if (document.header) assertSupported(document.header, "header");
  if (document.footer) assertSupported(document.footer, "footer");
  const requests: GoogleDocsRequest[] = [
    {
      updateDocumentStyle: {
        documentStyle: {
          pageSize: {
            width: { magnitude: document.page.width, unit: "PT" },
            height: { magnitude: document.page.height, unit: "PT" },
          },
          marginTop: { magnitude: document.page.margins.top, unit: "PT" },
          marginBottom: {
            magnitude: document.page.margins.bottom,
            unit: "PT",
          },
          marginLeft: { magnitude: document.page.margins.left, unit: "PT" },
          marginRight: { magnitude: document.page.margins.right, unit: "PT" },
          marginHeader: { magnitude: HEADER_DISTANCE_POINTS, unit: "PT" },
          marginFooter: { magnitude: FOOTER_DISTANCE_POINTS, unit: "PT" },
        },
        fields:
          "pageSize,marginTop,marginBottom,marginLeft,marginRight,marginHeader,marginFooter",
      },
    },
  ];
  compileNode(document.content, requests, { index: 1 }, imageUris);
  removeFinalBodyParagraphBreak(requests, document.content.content?.at(-1));
  const compileSection = (section: TiptapNode | null) => {
    if (!section) return null;
    const sectionRequests: GoogleDocsRequest[] = [];
    compileNode(section, sectionRequests, { index: 0 }, imageUris);
    return sectionRequests;
  };
  return {
    title: document.title,
    requests,
    sections: {
      header: compileSection(document.header),
      footer: compileSection(document.footer),
    },
  };
}
