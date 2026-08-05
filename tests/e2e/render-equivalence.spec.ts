import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { expect, test } from "@playwright/test";

type RenderFixture = {
  title: string;
  content: { content?: Array<{ type: string }> };
};

type FixtureManifest = {
  expected: {
    pageCount: number;
    manualBreaks: number[];
    automaticBreaks: number[];
    page: { widthPoints: number; heightPoints: number };
    headerFooter: {
      header: string;
      footer: string;
      headerDistancePoints: number;
      footerDistancePoints: number;
    };
    typography: { fontFamily: string; bodyFontSizePoints: number };
    features: { nodeTypes: string[]; marks: string[] };
  };
};

type PdfInspection = {
  pageCount: number;
  mediaBoxes: Array<{ width: number; height: number }>;
};

function inspectPdf(pdf: Buffer): PdfInspection {
  const source = pdf.toString("latin1");
  const pageCount = (source.match(/\/Type\s*\/Page\b/g) ?? []).length;
  const mediaBoxes = Array.from(
    source.matchAll(/\/MediaBox\s*\[\s*0\s+0\s+([\d.]+)\s+([\d.]+)\s*\]/g),
  ).map((match) => ({ width: Number(match[1]), height: Number(match[2]) }));
  return { pageCount, mediaBoxes };
}

const fixturePath = "fixtures/render-equivalence/core-slice/document.json";
const manifestPath = "fixtures/render-equivalence/core-slice/manifest.json";

test("captures the Core Editor Slice with deterministic local assertions", async ({
  page,
}, testInfo) => {
  const fixture = JSON.parse(
    await readFile(fixturePath, "utf8"),
  ) as RenderFixture;
  const manifest = JSON.parse(
    await readFile(manifestPath, "utf8"),
  ) as FixtureManifest;
  const assetBytes = await readFile(
    "fixtures/render-equivalence/core-slice/assets/hero.png",
  );

  await page.addInitScript(
    async ({ document, assetBase64 }) => {
      window.localStorage.setItem(
        "document-playground:document",
        JSON.stringify(document),
      );
      const database = await new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open("document-playground-assets", 1);
        request.onupgradeneeded = () =>
          request.result.createObjectStore("images");
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      await new Promise<void>((resolve, reject) => {
        const bytes = Uint8Array.from(atob(assetBase64), (character) =>
          character.charCodeAt(0),
        );
        const request = database
          .transaction("images", "readwrite")
          .objectStore("images")
          .put(
            {
              assetId: "asset_core_slice_hero",
              blob: new Blob([bytes], { type: "image/png" }),
              mimeType: "image/png",
              size: bytes.byteLength,
              intrinsicWidthPoints: 240,
              intrinsicHeightPoints: 120,
            },
            "asset_core_slice_hero",
          );
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    },
    { document: fixture, assetBase64: assetBytes.toString("base64") },
  );
  await page.goto("/");
  await expect(page.getByLabel("Document title")).toHaveValue(fixture.title);
  await expect(page.locator(".page")).toHaveCount(manifest.expected.pageCount);
  await expect(
    page.locator("img[data-asset-id='asset_core_slice_hero']"),
  ).toHaveJSProperty("naturalWidth", 320);
  await expect
    .poll(() => page.evaluate(() => document.fonts.check("11pt Arial")))
    .toBe(true);
  await page.locator("img").evaluateAll((images) =>
    Promise.all(
      images.map((image) =>
        image.complete
          ? Promise.resolve()
          : new Promise<void>((resolve, reject) => {
              image.addEventListener("load", () => resolve(), {
                once: true,
              });
              image.addEventListener("error", () => reject(image.src), {
                once: true,
              });
            }),
      ),
    ),
  );

  const metrics = await page.locator(".page").evaluateAll((pages) =>
    pages.map((currentPage) => {
      const pageRect = currentPage.getBoundingClientRect();
      const editor = currentPage.querySelector<HTMLElement>(".editor");
      const body = currentPage.querySelector<HTMLElement>(".ProseMirror");
      const image = currentPage.querySelector<HTMLImageElement>("img");
      return {
        width: pageRect.width,
        height: pageRect.height,
        layout: {
          width: getComputedStyle(currentPage).getPropertyValue(
            "--document-page-width",
          ),
          height: getComputedStyle(currentPage).getPropertyValue(
            "--document-page-height",
          ),
          padding: getComputedStyle(currentPage).getPropertyValue(
            "--document-page-margin-left",
          ),
        },
        overflow: (body?.scrollHeight ?? 0) > (editor?.clientHeight ?? 0) + 1,
        header: currentPage.querySelector(".page-header")?.textContent?.trim(),
        footer: currentPage.querySelector(".page-footer")?.textContent?.trim(),
        sectionOffsets: (() => {
          const header = currentPage.querySelector<HTMLElement>(".page-header");
          const footer = currentPage.querySelector<HTMLElement>(".page-footer");
          return {
            headerTop: header ? getComputedStyle(header).top : null,
            footerBottom: footer ? getComputedStyle(footer).bottom : null,
          };
        })(),
        breakBefore: currentPage.getAttribute("data-break-before"),
        typography: body
          ? {
              fontFamily: getComputedStyle(body).fontFamily,
              fontSize: getComputedStyle(body).fontSize,
            }
          : null,
        image: image
          ? {
              width: image.getBoundingClientRect().width,
              height: image.getBoundingClientRect().height,
            }
          : null,
      };
    }),
  );
  expect(metrics.every((metric) => !metric.overflow)).toBe(true);
  expect(
    metrics.filter((metric) => metric.breakBefore === "manual"),
  ).toHaveLength(manifest.expected.manualBreaks.length);
  expect(
    metrics.filter((metric) => metric.breakBefore === "automatic"),
  ).toHaveLength(manifest.expected.automaticBreaks.length);
  expect(
    metrics.every((metric) =>
      metric.typography?.fontFamily.startsWith(
        manifest.expected.typography.fontFamily,
      ),
    ),
  ).toBe(true);
  expect(
    metrics.every((metric) => metric.typography?.fontSize === "14.6667px"),
  ).toBe(true);
  expect(metrics[0]?.width).toBeCloseTo(
    manifest.expected.page.widthPoints * (96 / 72),
    0,
  );
  expect(metrics[0]?.height).toBeCloseTo(
    manifest.expected.page.heightPoints * (96 / 72),
    0,
  );
  expect(metrics.every((metric) => metric.layout.width === "816px")).toBe(true);
  expect(metrics.every((metric) => metric.layout.height === "1056px")).toBe(
    true,
  );
  expect(metrics.every((metric) => metric.layout.padding === "96px")).toBe(
    true,
  );
  expect(metrics[0]?.header).toBe(manifest.expected.headerFooter.header);
  expect(metrics[0]?.footer).toBe(manifest.expected.headerFooter.footer);
  expect(
    metrics.every(
      (metric) =>
        metric.sectionOffsets.headerTop ===
          `${manifest.expected.headerFooter.headerDistancePoints * (96 / 72)}px` &&
        metric.sectionOffsets.footerBottom ===
          `${manifest.expected.headerFooter.footerDistancePoints * (96 / 72)}px`,
    ),
  ).toBe(true);
  expect(
    metrics.every(
      (metric) => metric.header === manifest.expected.headerFooter.header,
    ),
  ).toBe(true);
  expect(
    metrics.every(
      (metric) => metric.footer === manifest.expected.headerFooter.footer,
    ),
  ).toBe(true);
  expect(
    fixture.content.content?.filter((node) => node.type === "pageBreak"),
  ).toHaveLength(1);
  expect(
    page.locator("img[data-asset-id='asset_core_slice_hero']"),
  ).toHaveCount(1);
  expect(metrics.find((metric) => metric.image)).toMatchObject({
    image: { width: 320, height: 160 },
  });
  const semanticSelectors: Record<string, string> = {
    heading: "h1, h2, h3, h4, h5, h6",
    paragraph: "p",
    bulletList: "ul",
    orderedList: "ol",
    listItem: "li",
    image: "img[data-asset-id='asset_core_slice_hero']",
    hardBreak: "br",
  };
  for (const nodeType of manifest.expected.features.nodeTypes) {
    if (nodeType === "pageBreak") {
      expect(
        fixture.content.content?.filter((node) => node.type === nodeType),
      ).not.toHaveLength(0);
      continue;
    }
    expect(
      await page
        .locator(semanticSelectors[nodeType] ?? `[data-type='${nodeType}']`)
        .count(),
    ).toBeGreaterThan(0);
  }
  for (const mark of manifest.expected.features.marks) {
    expect(JSON.stringify(fixture.content)).toContain(`"type":"${mark}"`);
  }
  expect(await page.locator("[data-lexical-text]").count()).toBeGreaterThan(0);

  const outputDir = testInfo.outputPath("render-equivalence/core-editor-slice");
  await mkdir(outputDir, { recursive: true });
  for (const [index, currentPage] of (
    await page.locator(".page").all()
  ).entries()) {
    await currentPage.screenshot({
      path: join(outputDir, `page-${index + 1}.png`),
    });
  }
  const pdfPath = join(outputDir, "local.pdf");
  await page.pdf({
    path: pdfPath,
    width: `${manifest.expected.page.widthPoints / 72}in`,
    height: `${manifest.expected.page.heightPoints / 72}in`,
    margin: { top: "0in", right: "0in", bottom: "0in", left: "0in" },
    preferCSSPageSize: false,
    printBackground: true,
  });
  const pdfInspection = inspectPdf(await readFile(pdfPath));
  expect(pdfInspection.pageCount).toBe(manifest.expected.pageCount);
  expect(pdfInspection.mediaBoxes).toHaveLength(manifest.expected.pageCount);
  expect(
    pdfInspection.mediaBoxes.every(
      ({ width, height }) =>
        width === manifest.expected.page.widthPoints &&
        height === manifest.expected.page.heightPoints,
    ),
  ).toBe(true);
  await writeFile(
    join(outputDir, "geometry.json"),
    JSON.stringify(metrics, null, 2),
  );
  await writeFile(
    join(outputDir, "report.json"),
    JSON.stringify(
      {
        fixtureId: "core-editor-slice",
        browser: page.context().browser()?.version(),
        metrics,
        pdf: {
          path: "render-equivalence/core-editor-slice/local.pdf",
          ...pdfInspection,
        },
      },
      null,
      2,
    ),
  );
});

test("reserves browser list indentation during pagination", async ({
  page,
}) => {
  await page.addInitScript(() => {
    window.localStorage.setItem(
      "document-playground:document",
      JSON.stringify({
        version: 2,
        title: "List wrap",
        page: {
          size: "letter",
          width: 612,
          height: 792,
          margins: { top: 72, right: 72, bottom: 72, left: 72 },
        },
        content: {
          type: "doc",
          content: [
            ...Array.from({ length: 50 }, () => ({ type: "paragraph" })),
            {
              type: "bulletList",
              content: [
                {
                  type: "listItem",
                  content: [
                    {
                      type: "paragraph",
                      content: [
                        {
                          type: "text",
                          text: "W".repeat(90),
                        },
                      ],
                    },
                  ],
                },
              ],
            },
          ],
        },
        header: null,
        footer: null,
      }),
    );
  });
  await page.goto("/");
  await expect(page.getByLabel("Document title")).toHaveValue("List wrap");
  await expect(page.locator(".page")).toHaveCount(2);
  await expect
    .poll(() =>
      page.locator(".page-body-editor .editor").evaluateAll((editors) =>
        editors.every((editor) => {
          const body = editor.querySelector<HTMLElement>(".ProseMirror");
          return (
            (body?.scrollHeight ?? 0) <= editor.clientHeight + 1 &&
            (body?.scrollWidth ?? 0) <= editor.clientWidth + 1
          );
        }),
      ),
    )
    .toBe(true);
});

test("accounts for nested list indentation when paginating wrapped items", async ({
  page,
}) => {
  await page.addInitScript(() => {
    window.localStorage.setItem(
      "document-playground:document",
      JSON.stringify({
        version: 2,
        title: "Nested list wrap",
        page: {
          size: "letter",
          width: 612,
          height: 792,
          margins: { top: 72, right: 72, bottom: 72, left: 72 },
        },
        content: {
          type: "doc",
          content: [
            ...Array.from({ length: 48 }, () => ({ type: "paragraph" })),
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
                      type: "bulletList",
                      content: [
                        {
                          type: "listItem",
                          content: [
                            {
                              type: "paragraph",
                              content: [
                                { type: "text", text: "W".repeat(170) },
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
        header: null,
        footer: null,
      }),
    );
  });
  await page.goto("/");

  await expect(page.getByLabel("Document title")).toHaveValue(
    "Nested list wrap",
  );
  await expect(page.locator(".page")).toHaveCount(2);
  await expect
    .poll(() =>
      page.locator(".page-body-editor .editor").evaluateAll((editors) =>
        editors.every((editor) => {
          const body = editor.querySelector<HTMLElement>(".ProseMirror");
          return (body?.scrollHeight ?? 0) <= editor.clientHeight + 1;
        }),
      ),
    )
    .toBe(true);
});

test("splits an oversized list item across pages like native pagination", async ({
  page,
}) => {
  await page.addInitScript(() => {
    window.localStorage.setItem(
      "document-playground:document",
      JSON.stringify({
        version: 2,
        title: "Long list item",
        page: {
          size: "letter",
          width: 612,
          height: 792,
          margins: { top: 72, right: 72, bottom: 72, left: 72 },
        },
        content: {
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
                      content: [
                        { type: "text", text: "Long item ".repeat(900) },
                      ],
                    },
                  ],
                },
              ],
            },
          ],
        },
        header: null,
        footer: null,
      }),
    );
  });
  await page.goto("/");
  await expect(page.getByLabel("Document title")).toHaveValue("Long list item");
  await expect.poll(() => page.locator(".page").count()).toBeGreaterThan(1);
  await expect
    .poll(() =>
      page.locator(".page-body-editor .editor").evaluateAll((editors) =>
        editors.every((editor) => {
          const body = editor.querySelector<HTMLElement>(".ProseMirror");
          return (body?.scrollHeight ?? 0) <= editor.clientHeight + 1;
        }),
      ),
    )
    .toBe(true);
});

test("keeps a list item with nested content within the page body", async ({
  page,
}) => {
  await page.addInitScript(() => {
    window.localStorage.setItem(
      "document-playground:document",
      JSON.stringify({
        version: 2,
        title: "Nested oversized item",
        page: {
          size: "letter",
          width: 612,
          height: 792,
          margins: { top: 72, right: 72, bottom: 72, left: 72 },
        },
        content: {
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
                      content: [
                        { type: "text", text: "Long item ".repeat(900) },
                      ],
                    },
                    {
                      type: "bulletList",
                      content: [
                        {
                          type: "listItem",
                          content: [
                            {
                              type: "paragraph",
                              content: [
                                {
                                  type: "text",
                                  text: "Nested item ".repeat(900),
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
          ],
        },
        header: null,
        footer: null,
      }),
    );
  });
  await page.goto("/");
  await expect(page.getByLabel("Document title")).toHaveValue(
    "Nested oversized item",
  );
  await expect.poll(() => page.locator(".page").count()).toBeGreaterThan(1);
  await expect
    .poll(() =>
      page.locator(".page-body-editor .editor").evaluateAll((editors) =>
        editors.every((editor) => {
          const body = editor.querySelector<HTMLElement>(".ProseMirror");
          if ((body?.scrollHeight ?? 0) > (editor.clientHeight ?? 0) + 1) {
            throw new Error(
              JSON.stringify({
                editors: editors.length,
                clientHeight: editor.clientHeight,
                scrollHeight: body?.scrollHeight,
              }),
            );
          }
          return (body?.scrollHeight ?? 0) <= (editor.clientHeight ?? 0) + 1;
        }),
      ),
    )
    .toBe(true);
});

test("continues ordered-list numbering across paginated editor pages", async ({
  page,
}) => {
  await page.addInitScript(() => {
    window.localStorage.setItem(
      "document-playground:document",
      JSON.stringify({
        version: 2,
        title: "Ordered list continuation",
        page: {
          size: "letter",
          width: 612,
          height: 792,
          margins: { top: 72, right: 72, bottom: 72, left: 72 },
        },
        content: {
          type: "doc",
          content: [
            {
              type: "orderedList",
              content: [
                {
                  type: "listItem",
                  content: [
                    {
                      type: "paragraph",
                      content: [
                        { type: "text", text: "First item ".repeat(900) },
                      ],
                    },
                  ],
                },
                {
                  type: "listItem",
                  content: [
                    {
                      type: "paragraph",
                      content: [{ type: "text", text: "Second item" }],
                    },
                  ],
                },
              ],
            },
          ],
        },
        header: null,
        footer: null,
      }),
    );
  });

  await page.goto("/");
  await expect.poll(() => page.locator(".page").count()).toBeGreaterThan(1);
  await expect(
    page.locator(".page ol").filter({ hasText: "Second item" }),
  ).toHaveAttribute("start", "2");
});
