import {
  DOCUMENT_TYPOGRAPHY,
  type DocumentEnvelope,
  type TiptapNode,
} from "@document-playground/domain";

const CONTENT_HEIGHT = 648;
const DEFAULT_BLOCK_HEIGHT = 11 * 1.15;

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
export const PAGE_VISUAL_FRAGMENT_ATTR = "data-page-visual-fragment";

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
    const rawLevel = node.attrs?.level;
    const level =
      typeof rawLevel === "number" ? Math.min(6, Math.max(1, rawLevel)) : 1;
    const metrics =
      DOCUMENT_TYPOGRAPHY.headings[level as 1 | 2 | 3 | 4 | 5 | 6];
    return (
      metrics.fontSizePoints * (DOCUMENT_TYPOGRAPHY.lineSpacingPercent / 100) +
      metrics.spaceAbovePoints +
      metrics.spaceBelowPoints
    );
  }

  const lineCount = (current: TiptapNode): number => {
    if (current.type === "hardBreak") return 1;
    if (current.text) {
      return current.text
        .split("\n")
        .reduce(
          (lines, line) => lines + Math.max(1, Math.ceil(line.length / 90)),
          0,
        );
    }
    return (
      current.content?.reduce((lines, child) => lines + lineCount(child), 0) ??
      0
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
      pushVisualFragment();
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

function splitNodeToFit(node: TiptapNode, maxHeight: number): TiptapNode[] {
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
      fragments.push({ ...node, content });
      content = [];
      lines = 0;
    }
    content.push(child);
    lines += child.type === "hardBreak" ? 1 : childLines;
  }
  if (content.length > 0) fragments.push({ ...node, content });
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
): TiptapNode[] {
  if (
    !["paragraph", "heading"].includes(node.type) ||
    !node.content?.length ||
    node.content.some((child) => child.type !== "text")
  ) {
    return [node];
  }

  const maxLines = Math.max(1, Math.floor(maxHeight / DEFAULT_BLOCK_HEIGHT));
  const visualLines = (text: string) =>
    text
      .split("\n")
      .reduce(
        (lines, line) => lines + Math.max(1, Math.ceil(line.length / 90)),
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
      const chunks = logicalLine.match(/.{1,90}/g) ?? [""];
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
      const textFragments = splitTextNode(
        remainingNode,
        remainingHeight,
        String(nodeIndex),
      );
      const fragmentCandidates: TiptapNode[] =
        textFragments.length === 1 &&
        measureNode(textFragments[0] ?? remainingNode) > remainingHeight
          ? splitNodeToFit(remainingNode, remainingHeight)
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

      pages.at(-1)?.content.push(fragment);
      remainingHeight -= height;
      remainingNode =
        fragments.length > 1
          ? {
              ...remainingNode,
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

  return { pageHeight: CONTENT_HEIGHT, pages };
}
