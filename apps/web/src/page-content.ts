import type { DocumentNode } from "@document-playground/domain";
import {
  PAGE_FRAGMENT_ATTR,
  PAGE_LIST_ITEM_CONTINUATION_ATTR,
  PAGE_VISUAL_FRAGMENT_ATTR,
  type PaginationPage,
} from "@document-playground/pagination";

function mergeListItemContinuation(
  previous: DocumentNode,
  current: DocumentNode,
): DocumentNode {
  const previousContent = previous.content ?? [];
  const currentContent = current.content ?? [];
  const previousParagraph = previousContent[0];
  const currentParagraph = currentContent[0];
  if (
    previousParagraph?.type === "paragraph" &&
    currentParagraph?.type === "paragraph" &&
    currentParagraph.content?.length
  ) {
    return {
      ...previous,
      content: [
        {
          ...previousParagraph,
          content: [
            ...(previousParagraph.content ?? []),
            ...currentParagraph.content,
          ],
        },
        ...currentContent.slice(1),
      ],
    };
  }
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
      (firstCurrent.attrs?.[PAGE_LIST_ITEM_CONTINUATION_ATTR] === true ||
        (firstCurrent.content?.[0]?.type === "paragraph" &&
          firstCurrent.content[0].content?.length === 0))
    ) {
      let mergedLastItem = mergeListItemContinuation(
        lastPrevious,
        firstCurrent,
      );
      let consumedItems = 1;
      while (consumedItems < currentItems.length) {
        const continuation = currentItems[consumedItems];
        const continuationParagraph = continuation?.content?.[0];
        if (
          continuation?.type !== "listItem" ||
          continuation.attrs?.[PAGE_LIST_ITEM_CONTINUATION_ATTR] !== true ||
          continuationParagraph?.type !== "paragraph" ||
          continuationParagraph.content?.length
        ) {
          break;
        }
        mergedLastItem = mergeListItemContinuation(
          mergedLastItem,
          continuation,
        );
        consumedItems += 1;
      }
      return {
        ...previous,
        content: [
          ...previousItems.slice(0, -1),
          mergedLastItem,
          ...currentItems.slice(consumedItems),
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
      const isList = node.type === "bulletList" || node.type === "orderedList";
      const startsWithContinuation =
        isList &&
        node.content?.[0]?.attrs?.[PAGE_LIST_ITEM_CONTINUATION_ATTR] === true;
      const sameListFragment =
        Boolean(fragmentId) && fragmentId === previousFragmentId;
      const continuationWithoutFragmentIdentity =
        startsWithContinuation && !fragmentId && !previousFragmentId;
      if (
        (isList
          ? sameListFragment || continuationWithoutFragmentIdentity
          : crossesPageBoundary || sameListFragment) &&
        previous?.type === node.type
      ) {
        content[content.length - 1] = mergeFragmentNodes(previous, node);
      } else {
        content.push({ ...node });
      }
    }
  }

  const stripFragmentAttrs = (node: DocumentNode): DocumentNode => {
    const attrs = node.attrs
      ? Object.fromEntries(
          Object.entries(node.attrs).filter(
            ([key]) =>
              key !== PAGE_FRAGMENT_ATTR &&
              key !== PAGE_VISUAL_FRAGMENT_ATTR &&
              key !== PAGE_LIST_ITEM_CONTINUATION_ATTR,
          ),
        )
      : {};
    const { content: childContent, ...nodeWithoutContent } = node;
    return {
      ...nodeWithoutContent,
      ...(Object.keys(attrs).length ? { attrs } : {}),
      ...(childContent
        ? { content: childContent.map(stripFragmentAttrs) }
        : {}),
    };
  };

  return content.map(stripFragmentAttrs);
}
