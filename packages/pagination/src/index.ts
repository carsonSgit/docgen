import type { DocumentEnvelope, TiptapNode } from "@document-playground/domain";

const CONTENT_HEIGHT = 648;
const DEFAULT_BLOCK_HEIGHT = 15;
const HEADING_HEIGHT = 24;

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

  const lineCount = (current: TiptapNode): number => {
    if (current.type === "hardBreak") return 1;
    if (current.text) return Math.max(1, Math.ceil(current.text.length / 90));
    return (
      current.content?.reduce((lines, child) => lines + lineCount(child), 0) ??
      0
    );
  };

  return DEFAULT_BLOCK_HEIGHT * Math.max(1, lineCount(node));
}

function splitNodeToFit(node: TiptapNode, maxHeight: number): TiptapNode[] {
  if (node.type !== "paragraph" || !node.content?.length) return [node];

  const maxLines = Math.floor(maxHeight / DEFAULT_BLOCK_HEIGHT);
  if (maxLines < 1) return [node];

  const fragments: TiptapNode[] = [];
  let content: TiptapNode[] = [];
  let lines = 0;
  for (const child of node.content) {
    const childLines = Math.max(1, Math.ceil((child.text?.length ?? 0) / 90));
    const nextLines =
      child.type === "hardBreak" ? lines + 1 : lines + childLines;
    if (content.length > 0 && nextLines > maxLines) {
      fragments.push({ ...node, content });
      content = [];
      lines = 0;
    }
    content.push(child);
    lines += child.type === "hardBreak" ? 1 : childLines;
  }
  if (content.length > 0) fragments.push({ ...node, content });
  return fragments.length > 0 ? fragments : [node];
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

    const fragments =
      measureNode(node) > remainingHeight
        ? splitNodeToFit(node, remainingHeight)
        : [node];
    for (const fragment of fragments) {
      const height = Math.max(1, measureNode(fragment));
      if (pages.at(-1)?.content.length && height > remainingHeight) {
        pages.push({
          number: pages.length + 1,
          content: [],
          breakBefore: false,
        });
        remainingHeight = CONTENT_HEIGHT;
      }
      pages.at(-1)?.content.push(fragment);
      remainingHeight -= height;
    }
  }

  return { pageHeight: CONTENT_HEIGHT, pages };
}
