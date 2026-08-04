import { describe, expect, it } from "vitest";
import { flattenPages } from "./page-content";

describe("flattenPages", () => {
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
