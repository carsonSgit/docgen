import type { DocumentNode } from "@document-playground/domain";
import {
  PAGE_FRAGMENT_ATTR,
  PAGE_VISUAL_FRAGMENT_ATTR,
  type PaginationPage,
} from "@document-playground/pagination";

function mergeListItemContinuation(
  previous: DocumentNode,
  current: DocumentNode,
): DocumentNode {
  const previousContent = previous.content ?? [];
  const currentContent = current.content ?? [];
  const previousNested = previousContent.at(-1);
  const currentNested = currentContent.at(-1);
  if (
    previousNested &&
    currentNested &&
    previousNested?.type === currentNested?.type &&
    (currentNested?.type === "bulletList" ||
      currentNested?.type === "orderedList")
  ) {
    const mergedNested = mergeFragmentNodes(previousNested, currentNested);
    return {
      ...previous,
      content: [...previousContent.slice(0, -1), mergedNested],
    };
  }
  const visualBreak =
    current.attrs?.[PAGE_VISUAL_FRAGMENT_ATTR] &&
    previous.content?.at(-1)?.type !== "hardBreak"
      ? [{ type: "hardBreak" as const }]
      : [];
  return {
    ...previous,
    content: [...previousContent, ...visualBreak, ...currentContent.slice(1)],
  };
}

function mergeFragmentNodes(
  previous: DocumentNode,
  current: DocumentNode,
): DocumentNode {
  if (
    (previous.type === "bulletList" || previous.type === "orderedList") &&
    previous.type === current.type
  ) {
    const previousItems = previous.content ?? [];
    const currentItems = current.content ?? [];
    const firstCurrent = currentItems[0];
    const lastPrevious = previousItems.at(-1);
    if (
      lastPrevious?.type === "listItem" &&
      firstCurrent?.type === "listItem" &&
      firstCurrent.content?.[0]?.type === "paragraph" &&
      firstCurrent.content[0].content?.length === 0
    ) {
      return {
        ...previous,
        content: [
          ...previousItems.slice(0, -1),
          mergeListItemContinuation(lastPrevious, firstCurrent),
          ...currentItems.slice(1),
        ],
      };
    }
    return { ...previous, content: [...previousItems, ...currentItems] };
  }
  return {
    ...previous,
    content: [...(previous.content ?? []), ...(current.content ?? [])],
  };
}

export function flattenPages(pages: PaginationPage[]): DocumentNode[] {
  const content: DocumentNode[] = [];

  for (const [pageIndex, page] of pages.entries()) {
    if (page.number > 1 && page.breakBefore)
      content.push({ type: "pageBreak" });
    for (const [nodeIndex, node] of page.content.entries()) {
      const fragmentId = node.attrs?.[PAGE_FRAGMENT_ATTR];
      const previous = content.at(-1);
      const previousFragmentId = previous?.attrs?.[PAGE_FRAGMENT_ATTR];
      const previousPageLastNode = pages[pageIndex - 1]?.content.at(-1);
      const crossesPageBoundary =
        pageIndex > 0 &&
        nodeIndex === 0 &&
        (Boolean(fragmentId) ||
          Boolean(previousPageLastNode?.attrs?.[PAGE_FRAGMENT_ATTR]));
      if (
        (crossesPageBoundary ||
          (fragmentId && fragmentId === previousFragmentId)) &&
        previous?.type === node.type
      ) {
        content[content.length - 1] = mergeFragmentNodes(previous, node);
      } else {
        content.push({ ...node });
      }
    }
  }

  return content.map((node) => {
    if (!node.attrs?.[PAGE_FRAGMENT_ATTR]) return node;
    const {
      [PAGE_FRAGMENT_ATTR]: _fragmentId,
      [PAGE_VISUAL_FRAGMENT_ATTR]: _visualFragment,
      ...attrs
    } = node.attrs;
    return {
      ...node,
      ...(Object.keys(attrs).length ? { attrs } : { attrs: undefined }),
    };
  });
}
