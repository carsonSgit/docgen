import { createBlankDocument } from "@document-playground/domain";
import { paginateDocument } from "@document-playground/pagination";
import { describe, expect, it } from "vitest";
import { flattenPages } from "./page-content";

describe("flattenPages", () => {
  it("does not merge adjacent ordered lists with distinct starts", () => {
    const pages = [
      {
        number: 1,
        breakBefore: false,
        content: [
          {
            type: "orderedList" as const,
            attrs: { "data-page-fragment": "first", start: 3 },
            content: [
              {
                type: "listItem" as const,
                content: [
                  {
                    type: "paragraph" as const,
                    content: [{ type: "text" as const, text: "First" }],
                  },
                ],
              },
            ],
          },
        ],
      },
      {
        number: 2,
        breakBefore: false,
        content: [
          {
            type: "orderedList" as const,
            attrs: { "data-page-fragment": "second", start: 9 },
            content: [
              {
                type: "listItem" as const,
                content: [
                  {
                    type: "paragraph" as const,
                    content: [{ type: "text" as const, text: "Second" }],
                  },
                ],
              },
            ],
          },
        ],
      },
    ];

    const lists = flattenPages(pages);

    expect(lists).toHaveLength(2);
    expect(lists.map((list) => list.attrs?.start)).toEqual([3, 9]);
  });

  it("preserves mixed nested list identity when the nested ordered list splits", () => {
    const document = createBlankDocument();
    document.content = {
      type: "doc",
      content: [
        {
          type: "bulletList",
          content: [
            {
              type: "listItem",
              content: [
                {
                  type: "paragraph",
                  content: [{ type: "text", text: "Parent" }],
                },
                {
                  type: "orderedList",
                  attrs: { start: 3 },
                  content: [
                    {
                      type: "listItem",
                      content: [
                        {
                          type: "paragraph",
                          content: [
                            { type: "text", text: "Nested long ".repeat(900) },
                          ],
                        },
                      ],
                    },
                    {
                      type: "listItem",
                      content: [
                        {
                          type: "paragraph",
                          content: [{ type: "text", text: "Nested second" }],
                        },
                      ],
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    };

    const pages = paginateDocument(document).pages;
    const [list] = flattenPages(pages);
    const nested = list?.content?.[0]?.content?.[1];
    expect(nested?.type).toBe("orderedList");
    expect(nested?.attrs?.start).toBe(3);
    expect(nested?.content).toHaveLength(2);
    expect(nested?.content?.[1]?.content?.[0]?.content?.[0]?.text).toBe(
      "Nested second",
    );
  });

  it("merges a nested-list continuation into its parent list item", () => {
    const pages = [
      {
        number: 1,
        breakBefore: false,
        content: [
          {
            type: "bulletList" as const,
            attrs: { "data-page-fragment": "0" },
            content: [
              {
                type: "listItem" as const,
                content: [
                  {
                    type: "paragraph" as const,
                    content: [{ type: "text" as const, text: "Parent" }],
                  },
                  {
                    type: "bulletList" as const,
                    content: [
                      {
                        type: "listItem" as const,
                        content: [
                          {
                            type: "paragraph" as const,
                            content: [{ type: "text" as const, text: "First" }],
                          },
                        ],
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },
      {
        number: 2,
        breakBefore: false,
        content: [
          {
            type: "bulletList" as const,
            attrs: { "data-page-fragment": "0" },
            content: [
              {
                type: "listItem" as const,
                content: [
                  { type: "paragraph" as const, content: [] },
                  {
                    type: "bulletList" as const,
                    content: [
                      {
                        type: "listItem" as const,
                        content: [
                          {
                            type: "paragraph" as const,
                            content: [
                              { type: "text" as const, text: "Second" },
                            ],
                          },
                        ],
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },
    ];

    const [list] = flattenPages(pages);
    expect(list?.content).toHaveLength(1);
    expect(list?.content?.[0]?.content).toHaveLength(2);
    expect(list?.content?.[0]?.content?.[1]?.content).toHaveLength(2);
  });

  it("merges a non-empty list item paragraph continuation", () => {
    const pages = [
      {
        number: 1,
        breakBefore: false,
        content: [
          {
            type: "bulletList" as const,
            attrs: { "data-page-fragment": "0" },
            content: [
              {
                type: "listItem" as const,
                content: [
                  {
                    type: "paragraph" as const,
                    content: [{ type: "text" as const, text: "First " }],
                  },
                ],
              },
            ],
          },
        ],
      },
      {
        number: 2,
        breakBefore: false,
        content: [
          {
            type: "bulletList" as const,
            attrs: { "data-page-fragment": "0" },
            content: [
              {
                type: "listItem" as const,
                attrs: { "data-page-list-item-continuation": true },
                content: [
                  {
                    type: "paragraph" as const,
                    content: [{ type: "text" as const, text: "continued" }],
                  },
                ],
              },
            ],
          },
        ],
      },
    ];

    const [list] = flattenPages(pages);
    expect(list?.content).toHaveLength(1);
    expect(list?.content?.[0]?.content?.[0]?.content).toEqual([
      { type: "text", text: "First " },
      { type: "text", text: "continued" },
    ]);
    expect(list?.content?.[0]?.attrs).toBeUndefined();
  });
});
