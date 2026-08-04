import {
  DEFAULT_RENDER_METRICS,
  DOCUMENT_CONTENT_WIDTH_POINTS,
  DOCUMENT_TYPOGRAPHY,
  type DocumentEnvelope,
  findUnsupportedDocumentNode,
  LIST_INDENT_POINTS,
  type TiptapNode,
} from "@document-playground/domain";
import { type CursorPageRange, createCursorPageRanges } from "./cursor";

export {
  type CanonicalCursor,
  type CursorPageRange,
  createCursorPageRanges,
  cursorAtEnd,
  cursorAtStart,
  documentLength,
  type ResolvedCursor,
  resolveCursor,
} from "./cursor";

const CONTENT_HEIGHT =
  DEFAULT_RENDER_METRICS.page.heightPoints -
  DEFAULT_RENDER_METRICS.page.margins.topPoints -
  DEFAULT_RENDER_METRICS.page.margins.bottomPoints;
const DEFAULT_BLOCK_HEIGHT =
  DEFAULT_RENDER_METRICS.typography.bodyFontSizePoints *
  (DEFAULT_RENDER_METRICS.typography.lineSpacingPercent / 100);
const HEADING_WRAP_WIDTH_FACTOR = 1.6;
// Lists lose 27pt of the 468pt content width to their marker indent.
const LIST_CHARS_PER_LINE = 85;
// Nested list markers and proportional text make the width estimate less exact.
const NESTED_LIST_CHAR_COST = 5;

function listCharsPerLine(depth: number): number {
  return Math.max(
    1,
    Math.floor(
      (LIST_CHARS_PER_LINE *
        (DOCUMENT_CONTENT_WIDTH_POINTS - LIST_INDENT_POINTS * (depth - 1))) /
        DOCUMENT_CONTENT_WIDTH_POINTS -
        NESTED_LIST_CHAR_COST * Math.max(0, depth - 1),
    ),
  );
}

export type PaginationPage = {
  number: number;
  content: TiptapNode[];
  breakBefore: boolean;
};

export type PaginatedDocument = {
  pageHeight: typeof CONTENT_HEIGHT;
  pages: PaginationPage[];
  cursorRanges: CursorPageRange[];
};

export type NodeMeasurement = (node: TiptapNode) => number;

export const PAGE_FRAGMENT_ATTR = "data-page-fragment";
export const PAGE_VISUAL_FRAGMENT_ATTR = "data-page-visual-fragment";
export const PAGE_LIST_ITEM_CONTINUATION_ATTR =
  "data-page-list-item-continuation";

function headingLineMetrics(node: TiptapNode) {
  const rawLevel = node.attrs?.level;
  const level =
    typeof rawLevel === "number" ? Math.min(6, Math.max(1, rawLevel)) : 1;
  const metrics = DOCUMENT_TYPOGRAPHY.headings[level as 1 | 2 | 3 | 4 | 5 | 6];
  return {
    lineHeight:
      metrics.fontSizePoints * (DOCUMENT_TYPOGRAPHY.lineSpacingPercent / 100),
    charsPerLine: Math.max(
      1,
      Math.floor(
        (90 * DOCUMENT_TYPOGRAPHY.bodyFontSizePoints) /
          (metrics.fontSizePoints * HEADING_WRAP_WIDTH_FACTOR),
      ),
    ),
    metrics,
  };
}

export class UnsupportedPaginationContentError extends Error {
  constructor(
    readonly path: string,
    readonly nodeType: string,
  ) {
    super(`Unsupported document content at ${path}: ${nodeType}`);
    this.name = "UnsupportedPaginationContentError";
  }
}

function containsImage(node: TiptapNode): boolean {
  return (
    node.type === "image" ||
    Boolean(node.content?.some((child) => containsImage(child)))
  );
}

function defaultMeasure(node: TiptapNode): number {
  if (node.type === "image") {
    const height = node.attrs?.height;
    return typeof height === "number" && Number.isFinite(height)
      ? Math.max(1, height)
      : DEFAULT_BLOCK_HEIGHT;
  }
  if (node.type === "heading") {
    const { charsPerLine, lineHeight, metrics } = headingLineMetrics(node);
    const lineCount = (current: TiptapNode): number => {
      if (current.type === "hardBreak") return 1;
      if (current.text) {
        return current.text
          .split("\n")
          .reduce(
            (lines, line) =>
              lines + Math.max(1, Math.ceil(line.length / charsPerLine)),
            0,
          );
      }
      return (
        current.content?.reduce(
          (lines, child) => lines + lineCount(child),
          0,
        ) ?? 0
      );
    };
    return (
      lineHeight * Math.max(1, lineCount(node)) +
      metrics.spaceAbovePoints +
      metrics.spaceBelowPoints
    );
  }

  const lineCount = (
    current: TiptapNode,
    charsPerLine = 90,
    listDepth = 0,
  ): number => {
    if (current.type === "hardBreak") return 1;
    if (current.text) {
      return current.text
        .split("\n")
        .reduce(
          (lines, line) =>
            lines + Math.max(1, Math.ceil(line.length / charsPerLine)),
          0,
        );
    }
    const childCharsPerLine =
      current.type === "bulletList" || current.type === "orderedList"
        ? listCharsPerLine(listDepth + 1)
        : charsPerLine;
    const childListDepth =
      current.type === "bulletList" || current.type === "orderedList"
        ? listDepth + 1
        : listDepth;
    return (
      current.content?.reduce(
        (lines, child) =>
          lines + lineCount(child, childCharsPerLine, childListDepth),
        0,
      ) ?? 0
    );
  };

  const imageHeight = (current: TiptapNode): number => {
    if (current.type === "image") {
      const height = current.attrs?.height;
      return typeof height === "number" && Number.isFinite(height)
        ? Math.max(1, height)
        : 0;
    }
    return (
      current.content?.reduce(
        (maxHeight, child) => Math.max(maxHeight, imageHeight(child)),
        0,
      ) ?? 0
    );
  };

  const measuredImageHeight = imageHeight(node);
  // Google lays out inline images inside a paragraph line box. Reserve that
  // line box separately so near-full-page images reflow like the export.
  const inlineImageLineBox =
    measuredImageHeight > 0 && node.type === "paragraph"
      ? DEFAULT_BLOCK_HEIGHT
      : 0;

  return Math.max(
    DEFAULT_BLOCK_HEIGHT * Math.max(1, lineCount(node)),
    measuredImageHeight + inlineImageLineBox,
  );
}

function splitVisualFragment(fragment: TiptapNode): TiptapNode[] {
  if (
    !fragment.content?.some(
      (child) => child.type === "hardBreak" || child.text?.includes("\n"),
    )
  ) {
    return [fragment];
  }
  const visualFragments: TiptapNode[] = [];
  let visualContent: TiptapNode[] = [];
  const pushVisualFragment = () => {
    if (visualContent.length === 0) return;
    visualFragments.push({
      ...fragment,
      attrs: {
        ...fragment.attrs,
        [PAGE_VISUAL_FRAGMENT_ATTR]: true,
      },
      content: visualContent,
    });
    visualContent = [];
  };
  for (const child of fragment.content) {
    if (child.type === "hardBreak") {
      if (visualContent.length === 0) {
        const previous = visualFragments.at(-1);
        if (previous) {
          previous.content = [...(previous.content ?? []), child];
        } else {
          visualContent.push(child);
        }
      } else {
        pushVisualFragment();
        const previous = visualFragments.at(-1);
        if (previous) {
          previous.content = [...(previous.content ?? []), child];
        }
      }
      continue;
    }
    const textLines = child.text?.split("\n");
    if (!textLines || textLines.length === 1) {
      visualContent.push(child);
      continue;
    }
    for (const [lineIndex, line] of textLines.entries()) {
      if (line.length > 0) visualContent.push({ ...child, text: line });
      if (lineIndex < textLines.length - 1) {
        pushVisualFragment();
      }
    }
  }
  pushVisualFragment();
  return visualFragments;
}

function splitNodeToFit(
  node: TiptapNode,
  maxHeight: number,
  fragmentId: string,
): TiptapNode[] {
  if (node.type !== "paragraph" || !node.content?.length) return [node];

  const maxLines = Math.floor(maxHeight / DEFAULT_BLOCK_HEIGHT);
  if (maxLines < 1) return [node];

  const fragments: TiptapNode[] = [];
  let content: TiptapNode[] = [];
  let lines = 0;
  const countLines = (current: TiptapNode): number => {
    if (current.type === "hardBreak") return 1;
    if (current.text) {
      return current.text
        .split("\n")
        .reduce(
          (total, line) => total + Math.max(1, Math.ceil(line.length / 90)),
          0,
        );
    }
    return (
      current.content?.reduce((total, child) => total + countLines(child), 0) ??
      1
    );
  };
  for (const child of node.content) {
    const childLines = countLines(child);
    const nextLines =
      child.type === "hardBreak" ? lines + 1 : lines + childLines;
    if (content.length > 0 && nextLines > maxLines) {
      fragments.push({
        ...node,
        attrs: { ...node.attrs, [PAGE_FRAGMENT_ATTR]: fragmentId },
        content,
      });
      content = [];
      lines = 0;
    }
    content.push(child);
    lines += child.type === "hardBreak" ? 1 : childLines;
  }
  if (content.length > 0) {
    fragments.push({
      ...node,
      attrs: { ...node.attrs, [PAGE_FRAGMENT_ATTR]: fragmentId },
      content,
    });
  }
  if (fragments.length === 0) return [node];

  // A split paragraph is rendered by multiple editor instances and must
  // expose its visual hard-break lines as separate paragraphs. The shared
  // fragment id lets flattenPages merge these display fragments back into the
  // original canonical paragraph, including the hard-break nodes.
  return fragments.flatMap(splitVisualFragment);
}

function splitTextNode(
  node: TiptapNode,
  maxHeight: number,
  fragmentId: string,
  textCharsPerLine = 90,
): TiptapNode[] {
  if (
    !["paragraph", "heading"].includes(node.type) ||
    !node.content?.length ||
    node.content.some((child) => child.type !== "text")
  ) {
    return [node];
  }

  const { lineHeight, charsPerLine } =
    node.type === "heading"
      ? headingLineMetrics(node)
      : { lineHeight: DEFAULT_BLOCK_HEIGHT, charsPerLine: textCharsPerLine };
  const maxLines = Math.max(1, Math.floor(maxHeight / lineHeight));
  const visualLines = (text: string) =>
    text
      .split("\n")
      .reduce(
        (lines, line) =>
          lines + Math.max(1, Math.ceil(line.length / charsPerLine)),
        0,
      );
  if (
    node.content.reduce(
      (lines, child) => lines + visualLines(child.text ?? ""),
      0,
    ) <= maxLines
  )
    return [node];

  const fragments: TiptapNode[] = [];
  let current: TiptapNode[] = [];
  let currentLines = 0;
  const pushFragment = () => {
    if (current.length === 0) return;
    fragments.push({
      ...node,
      attrs: { ...node.attrs, [PAGE_FRAGMENT_ATTR]: fragmentId },
      content: current,
    });
    current = [];
    currentLines = 0;
  };

  for (const child of node.content) {
    const childText = child.text ?? "";
    const logicalLines = childText.split("\n");
    for (const [lineIndex, logicalLine] of logicalLines.entries()) {
      const chunks = logicalLine.match(
        new RegExp(`.{1,${charsPerLine}}`, "g"),
      ) ?? [""];
      for (const [chunkIndex, chunk] of chunks.entries()) {
        if (currentLines >= maxLines) pushFragment();
        const separator = lineIndex > 0 && chunkIndex === 0 ? "\n" : "";
        const previous = current.at(-1);
        if (previous?.type === "text" && separator) {
          current[current.length - 1] = {
            ...previous,
            text: `${previous.text ?? ""}${separator}${chunk}`,
          };
        } else {
          current.push({ ...child, text: `${separator}${chunk}` });
        }
        currentLines += 1;
      }
    }
  }
  pushFragment();

  return fragments.flatMap(splitVisualFragment);
}

function splitListToFit(
  node: TiptapNode,
  maxHeight: number,
  fragmentId: string,
  depth = 1,
  measureNode: NodeMeasurement = defaultMeasure,
): TiptapNode[] {
  if (
    !["bulletList", "orderedList"].includes(node.type) ||
    !node.content?.length ||
    node.content.some(
      (item) =>
        item.type !== "listItem" ||
        item.content?.length === 0 ||
        item.content?.[0]?.type !== "paragraph",
    )
  ) {
    return [node];
  }

  const fragments: TiptapNode[] = [];
  for (const [itemIndex, item] of node.content.entries()) {
    const itemContent = item.content ?? [];
    const paragraph = itemContent[0];
    if (!paragraph) return [node];
    const precedingItemCount = node.content
      .slice(0, itemIndex)
      .filter(
        (candidate) =>
          candidate.attrs?.[PAGE_LIST_ITEM_CONTINUATION_ATTR] !== true,
      ).length;
    const continuesPreviousItem =
      item.attrs?.[PAGE_LIST_ITEM_CONTINUATION_ATTR] !== true &&
      node.content[0]?.attrs?.[PAGE_LIST_ITEM_CONTINUATION_ATTR] === true;
    const listItemStart =
      (typeof node.attrs?.start === "number" ? node.attrs.start : 1) +
      precedingItemCount +
      (continuesPreviousItem ? 1 : 0);
    const paragraphFragments = splitTextNode(
      paragraph,
      maxHeight,
      fragmentId,
      listCharsPerLine(depth),
    );
    for (const [
      fragmentIndex,
      paragraphFragment,
    ] of paragraphFragments.entries()) {
      const isFinalFragment = fragmentIndex === paragraphFragments.length - 1;
      const trailingContent = isFinalFragment ? itemContent.slice(1) : [];
      let trailingFragments: TiptapNode[][] = [[]];
      for (const child of trailingContent) {
        const childFragments =
          child.type === "bulletList" || child.type === "orderedList"
            ? splitListToFit(
                child,
                Math.max(1, maxHeight - measureNode(paragraphFragment)),
                fragmentId,
                depth + 1,
                measureNode,
              )
            : [child];
        trailingFragments = trailingFragments.flatMap((prefix) =>
          childFragments.map((fragment) => [...prefix, fragment]),
        );
      }
      for (const [trailingIndex, trailing] of trailingFragments.entries()) {
        const parentParagraph =
          paragraphFragments.length > 1 ||
          (fragmentIndex === 0 && trailingIndex === 0)
            ? paragraphFragment
            : { ...paragraphFragment, content: [] };
        fragments.push({
          ...node,
          attrs: {
            ...node.attrs,
            [PAGE_FRAGMENT_ATTR]: fragmentId,
            ...(node.type === "orderedList" ? { start: listItemStart } : {}),
          },
          content: [
            {
              ...item,
              ...(fragmentIndex > 0 || trailingIndex > 0
                ? {
                    attrs: {
                      ...item.attrs,
                      [PAGE_LIST_ITEM_CONTINUATION_ATTR]: true,
                    },
                  }
                : {}),
              content: [parentParagraph, ...trailing],
            },
          ],
        });
      }
    }
  }
  return fragments.length > 1 ? fragments : [node];
}

export function paginateDocument(
  document: DocumentEnvelope,
  measureNode: NodeMeasurement = defaultMeasure,
): PaginatedDocument {
  const unsupported = findUnsupportedDocumentNode(document.content, "content");
  if (unsupported) {
    throw new UnsupportedPaginationContentError(
      unsupported.path,
      unsupported.nodeType,
    );
  }
  const pages: PaginationPage[] = [
    { number: 1, content: [], breakBefore: false },
  ];
  let remainingHeight = CONTENT_HEIGHT;

  for (const [nodeIndex, node] of (document.content.content ?? []).entries()) {
    if (node.type === "pageBreak") {
      pages.push({ number: pages.length + 1, content: [], breakBefore: true });
      remainingHeight = CONTENT_HEIGHT;
      continue;
    }

    const nextNode = document.content.content?.[nodeIndex + 1];
    // Lexical inserts an image after the initial empty paragraph. Treat that
    // placeholder as the image's inline insertion point so a near-full-page
    // image stays on the first page instead of being pushed by an empty line.
    if (
      node.type === "paragraph" &&
      !node.content?.length &&
      nextNode &&
      containsImage(nextNode) &&
      !pages.at(-1)?.content.length
    ) {
      continue;
    }
    const keepsNextTogether =
      node.type === "heading" &&
      nextNode &&
      Boolean(pages.at(-1)?.content.length) &&
      measureNode(node) + measureNode(nextNode) > remainingHeight;
    if (keepsNextTogether) {
      pages.push({
        number: pages.length + 1,
        content: [],
        breakBefore: false,
      });
      remainingHeight = CONTENT_HEIGHT;
    }

    let remainingNode: TiptapNode | null = node;
    while (remainingNode) {
      if (
        (remainingNode.type === "bulletList" ||
          remainingNode.type === "orderedList") &&
        pages.at(-1)?.content.length &&
        measureNode(remainingNode) > remainingHeight
      ) {
        pages.push({
          number: pages.length + 1,
          content: [],
          breakBefore: false,
        });
        remainingHeight = CONTENT_HEIGHT;
        continue;
      }
      const textFragments = splitTextNode(
        remainingNode,
        remainingHeight,
        String(nodeIndex),
      );
      const fragmentCandidates: TiptapNode[] =
        textFragments.length === 1 &&
        measureNode(textFragments[0] ?? remainingNode) > remainingHeight
          ? remainingNode.type === "bulletList" ||
            remainingNode.type === "orderedList"
            ? splitListToFit(
                remainingNode,
                remainingHeight,
                String(nodeIndex),
                1,
                measureNode,
              )
            : splitNodeToFit(remainingNode, remainingHeight, String(nodeIndex))
          : textFragments;
      const fragments = fragmentCandidates;
      const fragment = fragments[0];
      if (!fragment) break;
      const height = Math.max(1, measureNode(fragment));

      if (pages.at(-1)?.content.length && height > remainingHeight) {
        pages.push({
          number: pages.length + 1,
          content: [],
          breakBefore: false,
        });
        remainingHeight = CONTENT_HEIGHT;
        continue;
      }

      const firstItem = fragment.content?.[0];
      const startsWithContinuation =
        fragment.type === "orderedList" &&
        firstItem?.attrs?.[PAGE_LIST_ITEM_CONTINUATION_ATTR] === true;
      const containsNewItem = fragment.content?.some(
        (item) => item.attrs?.[PAGE_LIST_ITEM_CONTINUATION_ATTR] !== true,
      );
      const renderedFragment =
        startsWithContinuation && containsNewItem
          ? {
              ...fragment,
              attrs: {
                ...fragment.attrs,
                start:
                  (typeof fragment.attrs?.start === "number"
                    ? fragment.attrs.start
                    : 1) + 1,
              },
            }
          : fragment;
      pages.at(-1)?.content.push(renderedFragment);
      remainingHeight -= height;
      remainingNode =
        fragments.length > 1
          ? {
              ...remainingNode,
              attrs: fragments[1]?.attrs ?? remainingNode.attrs,
              content: fragments
                .slice(1)
                .flatMap((item: TiptapNode) => item.content ?? []),
            }
          : null;
    }
  }

  const finalNode = document.content.content?.at(-1);
  if (
    pages.length === 1 &&
    remainingHeight < 0 &&
    finalNode?.type === "paragraph" &&
    containsImage(finalNode)
  ) {
    pages.push({ number: 2, content: [], breakBefore: false });
  }

  const result: Omit<PaginatedDocument, "cursorRanges"> = {
    pageHeight: CONTENT_HEIGHT,
    pages,
  };
  return { ...result, cursorRanges: createCursorPageRanges(document, result) };
}
