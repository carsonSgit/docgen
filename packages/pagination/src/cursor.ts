import type { DocumentEnvelope, TiptapNode } from "@document-playground/domain";
import type { PaginatedDocument } from "./index";

export type CanonicalCursor = {
  offset: number;
};

export type CursorPageRange = {
  pageNumber: number;
  start: number;
  end: number;
};

export type ResolvedCursor = {
  pageNumber: number;
  offset: number;
  blankPage: boolean;
};

function nodeLength(node: TiptapNode): number {
  if (node.type === "text") return node.text?.length ?? 0;
  if (
    node.type === "hardBreak" ||
    node.type === "image" ||
    node.type === "pageBreak"
  ) {
    return 1;
  }
  const children = node.content ?? [];
  return children.length > 0
    ? children.reduce((length, child) => length + nodeLength(child), 0)
    : 1;
}

export function documentLength(document: DocumentEnvelope): number {
  return (document.content.content ?? []).reduce(
    (length, node) => length + nodeLength(node),
    0,
  );
}

export function cursorAtStart(): CanonicalCursor {
  return { offset: 0 };
}

export function cursorAtEnd(document: DocumentEnvelope): CanonicalCursor {
  return { offset: documentLength(document) };
}

/**
 * Build page ranges from the canonical stream. Pagination may split a node, but
 * it never changes these offsets. The returned ranges are intentionally separate
 * from PaginationPage so page rendering remains backwards compatible.
 */
export function createCursorPageRanges(
  document: DocumentEnvelope,
  paginated: Pick<PaginatedDocument, "pages">,
): CursorPageRange[] {
  const source = document.content.content ?? [];
  const starts: number[] = [];
  let position = 0;
  for (const node of source) {
    starts.push(position);
    position += nodeLength(node);
  }

  const consumed = new Map<number, number>();
  let previousEnd = 0;
  return paginated.pages.map((page) => {
    let start = page.breakBefore ? previousEnd + 1 : previousEnd;
    let end = start;

    for (const renderedNode of page.content) {
      const fragmentId = renderedNode.attrs?.["data-page-fragment"];
      const sourceIndex =
        typeof fragmentId === "string"
          ? Number(fragmentId)
          : source.indexOf(renderedNode);
      if (sourceIndex < 0 || !Number.isInteger(sourceIndex)) continue;

      const nodeStart =
        (starts[sourceIndex] ?? start) + (consumed.get(sourceIndex) ?? 0);
      const length = nodeLength(renderedNode);
      start = Math.min(start, nodeStart);
      end = Math.max(end, nodeStart + length);
      consumed.set(sourceIndex, (consumed.get(sourceIndex) ?? 0) + length);
    }

    previousEnd = end;
    return { pageNumber: page.number, start, end };
  });
}

export function resolveCursor(
  cursor: CanonicalCursor,
  ranges: CursorPageRange[],
): ResolvedCursor {
  const offset = Math.max(0, cursor.offset);
  const containing =
    ranges.find((range) => offset >= range.start && offset <= range.end) ??
    ranges.at(-1);
  if (!containing) return { pageNumber: 1, offset, blankPage: true };
  return {
    pageNumber: containing.pageNumber,
    offset: Math.max(0, offset - containing.start),
    blankPage: containing.start === containing.end,
  };
}
