import type { DocumentEnvelope, TiptapNode } from "@document-playground/domain";

const CONTENT_HEIGHT = 648;
const DEFAULT_BLOCK_HEIGHT = 24;
const HEADING_HEIGHT = 32;

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

export function paginateDocument(
  document: DocumentEnvelope,
  measureNode: NodeMeasurement = defaultMeasure,
): PaginatedDocument {
  const pages: PaginationPage[] = [
    { number: 1, content: [], breakBefore: false },
  ];
  let remainingHeight = CONTENT_HEIGHT;

  for (const node of document.content.content ?? []) {
    if (node.type === "pageBreak") {
      pages.push({ number: pages.length + 1, content: [], breakBefore: true });
      remainingHeight = CONTENT_HEIGHT;
      continue;
    }

    const height = Math.max(1, measureNode(node));
    if (pages.at(-1)?.content.length && height > remainingHeight) {
      pages.push({ number: pages.length + 1, content: [], breakBefore: false });
      remainingHeight = CONTENT_HEIGHT;
    }

    pages.at(-1)?.content.push(node);
    remainingHeight -= height;
  }

  return { pageHeight: CONTENT_HEIGHT, pages };
}
