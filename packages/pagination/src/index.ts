import type { DocumentEnvelope, TiptapNode } from "@document-playground/domain";

const CONTENT_HEIGHT = 648;
const DEFAULT_BLOCK_HEIGHT = 11 * 1.15;
const HEADING_HEIGHT = 16 * 1.15;

export type PaginationPage = {
  number: number;
  content: TiptapNode[];
  breakBefore: boolean;
};

export type PaginatedDocument = {
  pageHeight: typeof CONTENT_HEIGHT;
  pages: PaginationPage[];
};

export type NodeMeasurement = (node: TiptapNode) => number;

export const PAGE_FRAGMENT_ATTR = "data-page-fragment";

function defaultMeasure(node: TiptapNode): number {
  if (node.type === "heading") {
    return HEADING_HEIGHT;
  }

  const textLength =
    node.content?.reduce(
      (length, child) => length + (child.text?.length ?? 0),
      0,
    ) ?? 0;

  return DEFAULT_BLOCK_HEIGHT * Math.max(1, Math.ceil(textLength / 90));
}

function splitTextNode(
  node: TiptapNode,
  maxHeight: number,
  fragmentId: string,
): TiptapNode[] {
  if (
    !["paragraph", "heading"].includes(node.type) ||
    !node.content?.length ||
    node.content.some((child) => child.type !== "text")
  ) {
    return [node];
  }

  const textLength = node.content.reduce(
    (length, child) => length + (child.text?.length ?? 0),
    0,
  );
  const maxCharacters = Math.max(
    1,
    Math.floor((maxHeight / DEFAULT_BLOCK_HEIGHT) * 90),
  );
  if (textLength <= maxCharacters) return [node];

  const fragments: TiptapNode[] = [];
  let current: TiptapNode[] = [];
  let currentLength = 0;

  for (const child of node.content) {
    const childText = child.text ?? "";
    let offset = 0;
    while (offset < childText.length) {
      const remaining = maxCharacters - currentLength;
      const chunk = childText.slice(offset, offset + remaining);
      current.push({ ...child, text: chunk });
      currentLength += chunk.length;
      offset += chunk.length;

      if (currentLength === maxCharacters) {
        fragments.push({
          ...node,
          attrs: { ...node.attrs, [PAGE_FRAGMENT_ATTR]: fragmentId },
          content: current,
        });
        current = [];
        currentLength = 0;
      }
    }
  }

  if (current.length) {
    fragments.push({
      ...node,
      attrs: { ...node.attrs, [PAGE_FRAGMENT_ATTR]: fragmentId },
      content: current,
    });
  }

  return fragments;
}

export function paginateDocument(
  document: DocumentEnvelope,
  measureNode: NodeMeasurement = defaultMeasure,
): PaginatedDocument {
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

    let remainingNode: TiptapNode | null = node;
    while (remainingNode) {
      const fragments = splitTextNode(
        remainingNode,
        remainingHeight,
        String(nodeIndex),
      );
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

      pages.at(-1)?.content.push(fragment);
      remainingHeight -= height;
      remainingNode =
        fragments.length > 1
          ? {
              ...remainingNode,
              content: fragments.slice(1).flatMap((item) => item.content ?? []),
            }
          : null;
    }
  }

  return { pageHeight: CONTENT_HEIGHT, pages };
}
